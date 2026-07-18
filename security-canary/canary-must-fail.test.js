// Intentional failing canary — proves the Security Detection gate can go red.
// NOT discovered by default `npm test` (lives outside test/). Run via:
//   npm run test:security:canary
// CI expects this command to FAIL.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('CANARY: security gate is armed (this assertion must fail)', () => {
  assert.equal(
    true,
    false,
    'If you see this pass, the vulnerability detector canary is disarmed'
  );
});
