import { ensureQuantumAIUser } from '../services/quantumAIUser.js';
import QuantumAIConversation from '../models/QuantumAIConversation.js';
import QuantumAIUsage from '../models/QuantumAIUsage.js';

export async function getQuantumAIProfile(req, res) {
  try {
    const bot = await ensureQuantumAIUser();
    res.json({
      success: true,
      data: {
        id: bot._id,
        username: bot.username,
        displayName: bot.displayName,
        isSystemUser: true,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function resetQuantumAIContext(req, res) {
  try {
    await QuantumAIConversation.clearForUser(req.user._id);
    res.json({ success: true, data: { reset: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getQuantumAIUsage(req, res) {
  try {
    const count = await QuantumAIUsage.getTodayCount(req.user._id);
    res.json({ success: true, data: { messageCount: count, date: QuantumAIUsage.todayKey() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
