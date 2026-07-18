import { ensureQuantumAIUser } from './quantumAIUser.js';
import QuantumAIUsage from '../models/QuantumAIUsage.js';
import QuantumAIConversation from '../models/QuantumAIConversation.js';
import Message from '../models/Message.js';

// Change these two to match your actual rate limit and AI provider.
const DAILY_MESSAGE_LIMIT = 20;
const AI_MODEL = 'actual ai model name here';

class QuantumAIRateLimitError extends Error {
  constructor() {
    super('Daily message limit reached for QuantumAI');
    this.code = 'RATE_LIMIT';
  }
}
// `plaintext` must be supplied by the client for bot conversations only —
// see the note in QuantumAIConversation.js for why.
export async function maybeRespondAsQuantumAI(io, { fromUserId, toUserId, plaintext, sourceMessageId }) {
  const bot = await ensureQuantumAIUser();
  if (String(toUserId) !== String(bot._id)) return null;

  if (!plaintext || typeof plaintext !== 'string' || !plaintext.trim()) {
    return null;
  }

  const todayCount = await QuantumAIUsage.getTodayCount(fromUserId);
  if (todayCount >= DAILY_MESSAGE_LIMIT) {
    throw new QuantumAIRateLimitError();
  }

  // Log the user's turn before generating a reply, so it's included in context.
  await QuantumAIConversation.create({
    user: fromUserId,
    role: 'user',
    text: plaintext.trim(),
    message: sourceMessageId || null,
  });

  const context = await QuantumAIConversation.getRecentContext(fromUserId, 10);
  const { text: replyText, tokensIn, tokensOut } = await generateAIReply(context);

  await QuantumAIConversation.create({ user: fromUserId, role: 'assistant', text: replyText });
  await QuantumAIUsage.recordUsage(fromUserId, { tokensIn, tokensOut });

  const botMessage = await Message.create({
    from: bot._id,
    to: fromUserId,
    body: replyText,
    isBotReply: true,
  });

  if (io) {
    io.to(String(fromUserId)).emit('message:new', {
      id: botMessage._id,
      from: bot._id,
      to: fromUserId,
      body: replyText,
      isBotReply: true,
      createdAt: botMessage.createdAt,
    });
  }

  return botMessage;
}

async function generateAIReply(context) {
  const response = await fetch('original api key here', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1000,
      system: 'You are QuantumAI, a helpful assistant inside a chat app. Keep replies concise.',
      messages: context.map((turn) => ({ role: turn.role, content: turn.content })),
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider error: ${response.status}`);
  }

  const data = await response.json();
  const text = (data.content || [])
    .map((block) => (block.type === 'text' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();

  const tokensIn = data.usage?.input_tokens || 0;
  const tokensOut = data.usage?.output_tokens || 0;

  return { text: text || "Sorry, I couldn't come up with a reply just now.", tokensIn, tokensOut };
}

export { QuantumAIRateLimitError };
