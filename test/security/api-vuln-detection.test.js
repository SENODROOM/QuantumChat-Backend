// [IDOR] [PRIVILEGE] [INJECTION] [ABUSE] [UPLOAD]
// API vulnerability detection — ethical-hacking algorithms against the
// ephemeral test app. Any successful privilege escalation / IDOR / injection
// fails CI (vulnerability detected).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer,
  registerUser,
  createGroup,
  sendGroupMessage,
  sealGroupEnvelopes,
} from '../helpers/testServer.js';
import {
  NOSQL_OPERATOR_PAYLOADS,
  assertRejected,
  assertNoPlaintextLeak,
  authHeaders,
  fetchJson,
} from '../helpers/attacks.js';
import { sealMessage } from '../helpers/crypto.js';

let ctx;
let owner;
let member;
let outsider;
let group;

before(async () => {
  ctx = await startTestServer();
  const stamp = Date.now();
  owner = await registerUser(ctx.base, `api_owner_${stamp}`);
  member = await registerUser(ctx.base, `api_member_${stamp}`);
  outsider = await registerUser(ctx.base, `api_out_${stamp}`);
  group = await createGroup(ctx.base, owner.token, {
    name: 'SecVuln Group',
    memberIds: [member.user.id],
  });
});

after(async () => {
  await ctx.stop();
});

test('[IDOR] non-member cannot GET group details', async () => {
  const { status } = await fetchJson(`${ctx.base}/groups/${group.id}`, {
    headers: authHeaders(outsider.token),
  });
  assert.equal(status, 403);
});

test('[IDOR] non-member cannot list group messages', async () => {
  const { status } = await fetchJson(`${ctx.base}/groups/${group.id}/messages`, {
    headers: authHeaders(outsider.token),
  });
  assert.equal(status, 403);
});

test('[IDOR] non-member cannot send group messages', async () => {
  const envelopes = await sealGroupEnvelopes('SECRET_GROUP_LEAK', [owner, member, outsider]);
  const { status } = await sendGroupMessage(ctx.base, outsider.token, group.id, envelopes);
  assert.ok([403, 400].includes(status), `expected reject, got ${status}`);
});

test('[PRIVILEGE] non-admin cannot promote themselves', async () => {
  const { status } = await fetchJson(`${ctx.base}/groups/${group.id}/admins/${member.user.id}`, {
    method: 'POST',
    headers: authHeaders(member.token),
  });
  assert.equal(status, 403);
});

test('[PRIVILEGE] non-admin cannot kick another member', async () => {
  const { status } = await fetchJson(`${ctx.base}/groups/${group.id}/members/${owner.user.id}`, {
    method: 'DELETE',
    headers: authHeaders(member.token),
  });
  assert.equal(status, 403);
});

test('[PRIVILEGE] non-admin cannot change quantumAI group settings', async () => {
  const { status, body } = await fetchJson(`${ctx.base}/groups/${group.id}`, {
    method: 'PATCH',
    headers: authHeaders(member.token),
    body: JSON.stringify({
      quantumAI: { enabled: true, invocationPolicy: 'members', maxContextMessages: 10, dailyLimit: 50 },
    }),
  });
  assert.equal(status, 403);
  assert.equal(body.success, false);
});

test('[PRIVILEGE] outsider cannot patch group name', async () => {
  const { status } = await fetchJson(`${ctx.base}/groups/${group.id}`, {
    method: 'PATCH',
    headers: authHeaders(outsider.token),
    body: JSON.stringify({ name: 'Hijacked' }),
  });
  assert.equal(status, 403);
});

test('[ABUSE] PATCH /users/me rejects mass-assigned system identity fields', async () => {
  const { status, body } = await fetchJson(`${ctx.base}/users/me`, {
    method: 'PATCH',
    headers: authHeaders(outsider.token),
    body: JSON.stringify({
      displayName: 'Normal',
      isSystemUser: true,
      systemRole: 'quantum_ai',
      verified: true,
      emailVerified: true,
    }),
  });
  assert.ok([200, 400].includes(status));
  if (status === 200 && body?.data) {
    assert.equal(body.data.isSystemUser, false);
    assert.notEqual(body.data.systemRole, 'quantum_ai');
    assert.equal(body.data.verified, false);
  }
});

test('[IDOR] user cannot PATCH another user by id', async () => {
  const { status } = await fetchJson(`${ctx.base}/users/${owner.user.id}`, {
    method: 'PATCH',
    headers: authHeaders(outsider.token),
    body: JSON.stringify({ displayName: 'pwned' }),
  });
  assert.ok([404, 405, 403].includes(status));
});

test('[INJECTION] NoSQL operator payloads rejected as message "to"', async () => {
  for (const payload of NOSQL_OPERATOR_PAYLOADS) {
    const forRecipient = sealMessage('x', member.keySet[0].publicKey);
    const forSender = sealMessage('x', owner.keySet[0].publicKey);
    const { status } = await fetchJson(`${ctx.base}/messages`, {
      method: 'POST',
      headers: authHeaders(owner.token),
      body: JSON.stringify({ to: payload, forRecipient, forSender }),
    });
    await assertRejected(
      { status },
      [400, 401, 403, 404, 422]
    );
  }
});

test('[INJECTION] NoSQL-shaped group id is rejected safely', async () => {
  const { status } = await fetchJson(`${ctx.base}/groups/${encodeURIComponent('{"$ne":null}')}`, {
    headers: authHeaders(owner.token),
  });
  assert.ok([400, 404].includes(status));
});

test('[ABUSE] HTTP verb tampering on /users/me does not silently succeed with DELETE via GET', async () => {
  const { status } = await fetchJson(`${ctx.base}/users/me`, {
    method: 'PUT',
    headers: authHeaders(owner.token),
    body: JSON.stringify({ displayName: 'put-attack' }),
  });
  assert.ok([404, 405].includes(status));
});

test('[ABUSE] parameter pollution / array "to" is rejected', async () => {
  const forRecipient = sealMessage('x', member.keySet[0].publicKey);
  const forSender = sealMessage('x', owner.keySet[0].publicKey);
  const { status } = await fetchJson(`${ctx.base}/messages`, {
    method: 'POST',
    headers: authHeaders(owner.token),
    body: JSON.stringify({
      to: [member.user.id, outsider.user.id],
      forRecipient,
      forSender,
    }),
  });
  assert.equal(status, 400);
});

test('[CRYPTO][IDOR] control: member can send sealed group message; outsider cannot read it', async () => {
  const secret = `SECRET_API_GROUP_${Date.now()}`;
  const envelopes = await sealGroupEnvelopes(secret, [owner, member]);
  const sent = await sendGroupMessage(ctx.base, owner.token, group.id, envelopes);
  assert.ok([200, 201].includes(sent.status), `send failed: ${sent.body?.error}`);

  const listed = await fetchJson(`${ctx.base}/groups/${group.id}/messages`, {
    headers: authHeaders(outsider.token),
  });
  assert.equal(listed.status, 403);
  assertNoPlaintextLeak(listed.body, secret, 'outsider group messages');
});

test('[UPLOAD][IDOR] stories: outsider cannot delete another user story by guessing id', async () => {
  const fakeId = '507f1f77bcf86cd799439011';
  const { status } = await fetchJson(`${ctx.base}/stories/${fakeId}`, {
    method: 'DELETE',
    headers: authHeaders(outsider.token),
  });
  assert.ok([403, 404].includes(status));
});
