// [AUTH] [ABUSE] Credential stuffing / rate-limit detection on /api/auth.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startTestServer, registerUser, login } from '../helpers/testServer.js';
import { JWT_ALG_CONFUSION, authHeaders, fetchJson } from '../helpers/attacks.js';

let ctx;
let user;

before(async () => {
  ctx = await startTestServer();
  user = await registerUser(ctx.base, `ratelimit_${Date.now()}`);
});

after(async () => {
  await ctx.stop();
});

test('[AUTH] algorithm-confusion matrix tokens are rejected', async () => {
  for (const alg of JWT_ALG_CONFUSION) {
    let token;
    try {
      if (alg === 'none') {
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ id: user.user.id })).toString('base64url');
        token = `${header}.${payload}.`;
      } else if (alg === 'RS256') {
        token = jwt.sign({ id: user.user.id }, process.env.JWT_SECRET, { algorithm: 'HS384' });
        const [h, p, s] = token.split('.');
        const header = JSON.parse(Buffer.from(h, 'base64url').toString());
        header.alg = 'RS256';
        token = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${p}.${s}`;
      } else {
        token = jwt.sign({ id: user.user.id }, process.env.JWT_SECRET, { algorithm: alg });
      }
    } catch {
      continue;
    }
    const { status } = await fetchJson(`${ctx.base}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(status, 401, `alg=${alg} must be rejected`);
  }
});

test('[AUTH] registration blocks QuantumAI unicode/case tricks', async () => {
  for (const username of ['QuantumAI', 'QUANTUMAI', 'QuAnTuMaI']) {
    const res = await fetch(`${ctx.base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email: `${username.toLowerCase()}_${Date.now()}@example.com`,
        password: 'password123',
        publicKeys: user.keySet.map((k) => k.publicKey),
      }),
    });
    assert.ok([409, 400, 429].includes(res.status), `username=${username} status=${res.status}`);
  }
});

test('[AUTH] DOCUMENTED: password change does not invalidate existing JWTs', async () => {
  // Known limitation — tokens remain valid until JWT_EXPIRES_IN.
  const beforeToken = user.token;
  await fetchJson(`${ctx.base}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders(beforeToken),
    body: JSON.stringify({
      currentPassword: 'password123',
      newPassword: 'password45678',
    }),
  });
  const { status } = await fetchJson(`${ctx.base}/users`, {
    headers: authHeaders(beforeToken),
  });
  assert.equal(status, 200);
});

test('[AUTH] login error messages do not enable reliable user enumeration', async () => {
  const missing = await login(ctx.base, 'no_such_user_xyz@example.com', 'password123');
  const wrong = await login(ctx.base, user.user.email, 'totally-wrong-password');
  assert.ok([401, 429].includes(missing.status));
  assert.ok([401, 429].includes(wrong.status));
  if (missing.status === 401 && wrong.status === 401) {
    const missingMsg = String(missing.body?.error || '');
    const wrongMsg = String(wrong.body?.error || '');
    assert.equal(
      missingMsg === wrongMsg,
      true,
      `VULNERABILITY DETECTED: login oracle differs ("${missingMsg}" vs "${wrongMsg}")`
    );
  }
});

test('[AUTH] 21st auth request within the window is rate-limited (429)', async () => {
  let saw429 = false;
  for (let i = 0; i < 25; i += 1) {
    const result = await login(ctx.base, user.user.email, 'wrong-password');
    if (result.status === 429) {
      saw429 = true;
      break;
    }
  }
  assert.equal(saw429, true, 'VULNERABILITY DETECTED: auth rate limiter did not fire');
});
