import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Server only ever sees ciphertext + nonce, both produced client-side via nacl.box.
    // It cannot decrypt messages — it has no private keys.
    ciphertext: { type: String, required: true },
    nonce: { type: String, required: true },
  },
  { timestamps: true }
);

messageSchema.index({ from: 1, to: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
