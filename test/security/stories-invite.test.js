// [IDOR] [ABUSE] Stories + invite-link abuse checks.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer,
  registerUser,
  createGroup,
} from '../helpers/testServer.js';
import { authHeaders, fetchJson } from '../helpers/attacks.js';

let ctx;
let alice;
let bob;
let group;

before(async () => {
  ctx = await startTestServer();
  const stamp = Date.now();
  alice = await registerUser(ctx.base, `story_a_${stamp}`);
  bob = await registerUser(ctx.base, `story_b_${stamp}`);
  group = await createGroup(ctx.base, alice.token, {
    name: 'Invite Abuse',
    memberIds: [bob.user.id],
  });
});

after(async () => {
  await ctx.stop();
});

test('[IDOR] non-admin cannot enable group invite link', async () => {
  const { status } = await fetchJson(`${ctx.base}/groups/${group.id}/invite`, {
    method: 'POST',
    headers: authHeaders(bob.token),
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(status, 403);
});

test('[ABUSE] guessing a random invite code does not leak group membership', async () => {
  const { status, body } = await fetchJson(`${ctx.base}/groups/invite/NOTAREALCODE99`, {
    headers: authHeaders(bob.token),
  });
  assert.ok([404, 400].includes(status));
  assert.equal(body?.success, false);
});

test('[IDOR] stories list requires auth', async () => {
  const { status } = await fetchJson(`${ctx.base}/stories`);
  assert.equal(status, 401);
});

test('[UPLOAD] story create without file is rejected', async () => {
  const { status } = await fetchJson(`${ctx.base}/stories`, {
    method: 'POST',
    headers: authHeaders(alice.token),
    body: JSON.stringify({ caption: 'no file' }),
  });
  assert.ok([400, 415].includes(status));
});
