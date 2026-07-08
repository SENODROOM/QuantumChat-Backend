import mongoose from 'mongoose';
import Message from '../models/Message.js';

export async function sendMessage(req, res) {
  try {
    const { to, ciphertext, nonce } = req.body;
    if (!to || !ciphertext || !nonce) {
      return res.status(400).json({ success: false, error: 'to, ciphertext and nonce are required' });
    }
    if (!mongoose.isValidObjectId(to)) {
      return res.status(400).json({ success: false, error: 'Invalid recipient id' });
    }

    const message = await Message.create({
      from: req.user._id,
      to,
      ciphertext,
      nonce,
    });

    const io = req.app.get('io');
    io.to(to.toString()).emit('message:new', {
      id: message._id,
      from: message.from,
      to: message.to,
      ciphertext: message.ciphertext,
      nonce: message.nonce,
      createdAt: message.createdAt,
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getConversation(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ success: false, error: 'Invalid user id' });
  }

  const messages = await Message.find({
    $or: [
      { from: req.user._id, to: userId },
      { from: userId, to: req.user._id },
    ],
  }).sort({ createdAt: 1 });

  res.json({ success: true, data: messages });
}
