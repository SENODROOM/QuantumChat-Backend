// [CRYPTO] Structured key-fuzz battery. PR uses 128 keys; nightly can raise
// SECURITY_FUZZ_KEYS=1000 for deeper sampling.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, registerUser } from '../helpers/testServer.js';
import { generateKeySet, sealMessage, unsealMessage } from '../helpers/crypto.js';

const FUZZ = Number(process.env.SECURITY_FUZZ_KEYS || 128);

let ctx;
let alice;
let bob;
let envelope;
const PLAIN = `FUZZ_SECRET_${Date.now()}`;

before(async () => {
  ctx = await startTestServer();
  alice = await registerUser(ctx.base, `fuzz_a_${Date.now()}`);
  bob = await registerUser(ctx.base, `fuzz_b_${Date.now()}`);
  envelope = sealMessage(PLAIN, bob.keySet[2].publicKey);

  const forSender = sealMessage(PLAIN, alice.keySet[0].publicKey);
  const sendRes = await fetch(`${ctx.base}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${alice.token}`,
    },
    body: JSON.stringify({ to: bob.user.id, forRecipient: envelope, forSender }),
  }).then((r) => r.json());
  assert.equal(sendRes.success, true);
});

after(async () => {
  await ctx.stop();
});

test(`[CRYPTO] control: recipient key opens fuzz envelope`, () => {
  assert.equal(unsealMessage(envelope, bob.keySet[2].secretKey), PLAIN);
});

test(`[CRYPTO] FAIL GATE: ${FUZZ} random private keys never open the envelope`, () => {
  for (let i = 0; i < FUZZ; i += 1) {
    assert.equal(unsealMessage(envelope, generateKeySet(1)[0].secretKey), null);
  }
});

test('[CRYPTO] FAIL GATE: peer and sender wrong-slot keys never open recipient envelope', () => {
  for (const key of alice.keySet) {
    assert.equal(unsealMessage(envelope, key.secretKey), null);
  }
  for (const key of bob.keySet.filter((k) => k.publicKey !== envelope.targetPublicKey)) {
    assert.equal(unsealMessage(envelope, key.secretKey), null);
  }
});
