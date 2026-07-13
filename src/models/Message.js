import mongoose from 'mongoose';

const HEX_64 = /^[0-9a-f]{64}$/i;

// A sealed-box envelope: ciphertext produced with a one-time ephemeral
// keypair + the target's long-term public key. Only the private half of
// targetPublicKey can open it — see frontend/src/crypto/keys.js.
const envelopeSchema = new mongoose.Schema(
  {
    ciphertext: { type: String, required: true },
    nonce: { type: String, required: true },
    ephemeralPublicKey: { type: String, required: true, match: HEX_64 },
    targetPublicKey: { type: String, required: true, match: HEX_64 },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // A sealed-box envelope encrypts to exactly one public key, so the same
    // plaintext is sealed twice at send time: once to the recipient's
    // current key (so they can read it) and once to the sender's own
    // current key (so the sender can read their own sent history back —
    // the ephemeral key used to seal is discarded immediately and can't be
    // recovered, so without this second copy the sender couldn't reopen
    // their own message either).
    forRecipient: { type: envelopeSchema, required: true },
    forSender: { type: envelopeSchema, required: true },
    attachment: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
  },
  { timestamps: true }
);

messageSchema.index({ from: 1, to: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema, 'messages');
