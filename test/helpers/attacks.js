// Shared ethical-hacking payload banks and assertion helpers for the
// Security and Vulnerability Detection System. Attack the ephemeral test
// app only — never production.
import assert from 'node:assert/strict';

export const NOSQL_OPERATOR_PAYLOADS = [
  { $ne: null },
  { $gt: '' },
  { $where: '1==1' },
  { $regex: '.*' },
  '{"$ne":null}',
  '$where:1==1',
];

export const PATH_TRAVERSAL_NAMES = [
  '../etc/passwd',
  '..\\..\\windows\\win.ini',
  '....//....//etc/passwd',
  '%2e%2e%2fetc%2fpasswd',
  'file.txt/../../secret',
];

export const PROTOTYPE_POLLUTION_KEYS = {
  __proto__: { admin: true },
  constructor: { prototype: { admin: true } },
  'prototype.polluted': true,
};

export const JWT_ALG_CONFUSION = ['none', 'HS384', 'RS256', 'ES256'];

/** @param {Response} response */
export async function assertRejected(response, allowedStatuses = [400, 401, 403, 404, 405, 409, 413, 429]) {
  assert.ok(
    allowedStatuses.includes(response.status),
    `expected rejection in [${allowedStatuses.join(', ')}] but got ${response.status}`
  );
}

export function assertNoPlaintextLeak(payload, secretMarker, context = 'response') {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  assert.equal(
    text.includes(secretMarker),
    false,
    `VULNERABILITY DETECTED: plaintext leaked in ${context}`
  );
  const b64 = Buffer.from(secretMarker, 'utf8').toString('base64');
  assert.equal(
    text.includes(b64),
    false,
    `VULNERABILITY DETECTED: base64(plaintext) leaked in ${context}`
  );
}

export function authHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body, status: response.status, text };
}
