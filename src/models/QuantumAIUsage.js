import mongoose from 'mongoose';

// Tracks how many messages each user has sent to QuantumAI, per calendar day.
// One document per (user, date) pair — keeps rate-limit checks to a single lookup.
const quantumAIUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD', in UTC
    messageCount: { type: Number, default: 0 },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
  },
  { timestamps: true }
);

quantumAIUsageSchema.index({ user: 1, date: 1 }, { unique: true });

function todayKey() {
  return new Date().toISOString().slice(0, 10); 
}

quantumAIUsageSchema.statics.todayKey = todayKey;

// Atomically bumps today's counters for a user. Creates the doc if it
// doesn't exist yet. Returns the updated document.
quantumAIUsageSchema.statics.recordUsage = async function recordUsage(userId, { tokensIn = 0, tokensOut = 0 } = {}) {
  return this.findOneAndUpdate(
    { user: userId, date: todayKey() },
    { $inc: { messageCount: 1, tokensIn, tokensOut } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Returns how many messages this user has sent to the bot today.
quantumAIUsageSchema.statics.getTodayCount = async function getTodayCount(userId) {
  const doc = await this.findOne({ user: userId, date: todayKey() }).select('messageCount');
  return doc ? doc.messageCount : 0;
};

export default mongoose.model('QuantumAIUsage', quantumAIUsageSchema, 'quantum_ai_usage');
