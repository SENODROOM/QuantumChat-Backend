import type { IMessage } from '@quantum-chat/shared';
import {
  createKeyEnvelope,
  decryptContent,
  encryptPlaintext,
  generateConversationKey,
  getStoredKey,
  isE2EContent,
  parseEnvelope,
  storeKey,
} from './e2eCrypto';

export const E2E_PREVIEW = '🔒 Encrypted message';
export const E2E_DECRYPT_FAILED = '🔒 Unable to decrypt message';

export async function prepareOutgoingContent(
  conversationId: string,
  plaintext: string
): Promise<{ encrypted: string; keyExchange?: string }> {
  let key = getStoredKey(conversationId);
  let keyExchange: string | undefined;

  if (!key) {
    key = await generateConversationKey();
    storeKey(conversationId, key);
    keyExchange = createKeyEnvelope(key);
  }

  const encrypted = await encryptPlaintext(key, plaintext);
  return { encrypted, keyExchange };
}

/** Returns null when the message is a hidden key-exchange envelope. */
export async function processIncomingMessage(msg: IMessage): Promise<IMessage | null> {
  if (msg.isDeleted || !msg.content) return msg;
  if (!isE2EContent(msg.content)) return msg;

  const envelope = parseEnvelope(msg.content);
  if (!envelope) return { ...msg, content: E2E_DECRYPT_FAILED };

  if (envelope.t === 'key') {
    storeKey(msg.conversationId, envelope.k);
    return null;
  }

  const plaintext = await decryptContent(msg.conversationId, msg.content);
  if (plaintext === null) return { ...msg, content: E2E_DECRYPT_FAILED };
  return { ...msg, content: plaintext };
}

export async function processMessageList(messages: IMessage[]): Promise<IMessage[]> {
  const visible: IMessage[] = [];

  for (const msg of messages) {
    if (msg.isDeleted) {
      visible.push(msg);
      continue;
    }

    if (!isE2EContent(msg.content)) {
      visible.push(msg);
      continue;
    }

    const envelope = parseEnvelope(msg.content);
    if (envelope?.t === 'key') {
      storeKey(msg.conversationId, envelope.k);
      continue;
    }

    const processed = await processIncomingMessage(msg);
    if (processed) visible.push(processed);
  }

  return visible;
}

export async function getMessagePreview(conversationId: string, content: string): Promise<string> {
  if (!content) return '';
  if (!isE2EContent(content)) return content;
  const plaintext = await decryptContent(conversationId, content);
  if (plaintext === null) return E2E_PREVIEW;
  return plaintext;
}

export async function encryptEditedContent(conversationId: string, plaintext: string): Promise<string> {
  const key = getStoredKey(conversationId);
  if (!key) throw new Error('Missing encryption key for this conversation');
  return encryptPlaintext(key, plaintext);
}
