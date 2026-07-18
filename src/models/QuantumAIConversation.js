import mongoose from 'mongoose';

// IMPORTANT: This collection stores PLAINTEXT, unlike your main Message
// collection which stores only sealed envelopes. This is a deliberate,
// narrow exception: QuantumAI needs to read what was said to reply to it,
// and it needs past turns to hold context across a conversation.
//
// Only messages sent TO or FROM the bot ever land here. Every other
// conversation in the app stays end-to-end encrypted as before.
const quantumAIConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true, maxlength: 4000 },
    // Link back to the real Message doc (which still holds the sealed
    // envelope copy for the user's own message history/UI).
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  },
  { timestamps: true }
);

quantumAIConversationSchema.index({ user: 1, createdAt: -1 });

// Returns the last `limit` turns for a user, oldest first — ready to hand
// straight to an AI provider's `messages` array.
quantumAIConversationSchema.statics.getRecentContext = async function getRecentContext(userId, limit = 10) {
  const turns = await this.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean();
  return turns.reverse().map((t) => ({ role: t.role, content: t.text }));
};

quantumAIConversationSchema.statics.clearForUser = async function clearForUser(userId) {
  return this.deleteMany({ user: userId });
};

export default mongoose.model('QuantumAIConversation', quantumAIConversationSchema, 'quantum_ai_conversations');
