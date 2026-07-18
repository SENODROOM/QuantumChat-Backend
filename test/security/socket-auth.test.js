// [AUTH] Socket.IO handshake abuse — missing/forged tokens must not connect.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { startTestServer, registerUser } from '../helpers/testServer.js';

let ctx;
let user;

function connectOnce(url, auth, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const socket = ioClient(url, {
      auth,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: timeoutMs,
    });
    const done = (result) => {
      socket.removeAllListeners();
      socket.close();
      resolve(result);
    };
    socket.on('connect', () => done({ ok: true }));
    socket.on('connect_error', (err) => done({ ok: false, message: err.message }));
    setTimeout(() => done({ ok: false, message: 'timeout' }), timeoutMs + 500);
  });
}

before(async () => {
  ctx = await startTestServer({ withSockets: true });
  user = await registerUser(ctx.base, `socket_${Date.now()}`);
});

after(async () => {
  await ctx.stop();
});

test('[AUTH] Socket.IO rejects connection without token', async () => {
  const result = await connectOnce(ctx.origin, {});
  assert.equal(result.ok, false);
});

test('[AUTH] Socket.IO rejects forged JWT', async () => {
  const forged = jwt.sign({ id: user.user.id }, 'wrong-secret', { algorithm: 'HS256' });
  const result = await connectOnce(ctx.origin, { token: forged });
  assert.equal(result.ok, false);
});

test('[AUTH] Socket.IO accepts a valid participant token', async () => {
  const result = await connectOnce(ctx.origin, { token: user.token });
  assert.equal(result.ok, true, result.message);
});

test('[AUTH] Socket.IO rejects alg-confusion HS384 token', async () => {
  const bad = jwt.sign({ id: user.user.id }, process.env.JWT_SECRET, { algorithm: 'HS384' });
  // HTTP pins HS256; socket currently may accept HS384 — document if it connects.
  const result = await connectOnce(ctx.origin, { token: bad });
  // Prefer reject; if accepted, still record as soft finding via assert on preferred path.
  // Pin expected secure behavior: reject.
  assert.equal(result.ok, false, 'VULNERABILITY DETECTED: Socket.IO accepted non-HS256 JWT');
});
