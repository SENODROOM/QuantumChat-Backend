const E2E_PREFIX = '__QC_E2E__';
const STORAGE_KEY = 'qc_e2e_keys';

export type E2EEnvelope =
  | { v: 1; t: 'key'; k: string }
  | { v: 1; t: 'msg'; c: string; i: string };

function loadKeyStore(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveKeyStore(store: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getStoredKey(conversationId: string): string | null {
  return loadKeyStore()[conversationId] ?? null;
}

export function storeKey(conversationId: string, keyBase64: string) {
  const store = loadKeyStore();
  store[conversationId] = keyBase64;
  saveKeyStore(store);
}

export function isE2EContent(content: string): boolean {
  return content.startsWith(E2E_PREFIX);
}

export function parseEnvelope(content: string): E2EEnvelope | null {
  if (!isE2EContent(content)) return null;
  try {
    const parsed = JSON.parse(content.slice(E2E_PREFIX.length)) as E2EEnvelope;
    if (parsed?.v !== 1 || (parsed.t !== 'key' && parsed.t !== 'msg')) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function wrapEnvelope(envelope: E2EEnvelope): string {
  return `${E2E_PREFIX}${JSON.stringify(envelope)}`;
}

function b64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function b64Decode(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(keyBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64Decode(keyBase64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function generateConversationKey(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64Encode(bytes);
}

export function createKeyEnvelope(keyBase64: string): string {
  return wrapEnvelope({ v: 1, t: 'key', k: keyBase64 });
}

export async function encryptPlaintext(keyBase64: string, plaintext: string): Promise<string> {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return wrapEnvelope({ v: 1, t: 'msg', c: b64Encode(new Uint8Array(ciphertext)), i: b64Encode(iv) });
}

export async function decryptEnvelope(keyBase64: string, envelope: E2EEnvelope): Promise<string | null> {
  if (envelope.t !== 'msg') return null;
  try {
    const key = await importKey(keyBase64);
    const iv = b64Decode(envelope.i);
    const ciphertext = b64Decode(envelope.c);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function decryptContent(conversationId: string, content: string): Promise<string | null> {
  const envelope = parseEnvelope(content);
  if (!envelope) return content;
  if (envelope.t === 'key') {
    storeKey(conversationId, envelope.k);
    return null;
  }
  const key = getStoredKey(conversationId);
  if (!key) return null;
  return decryptEnvelope(key, envelope);
}
