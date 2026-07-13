import mongoose from 'mongoose';

const HEX_64 = /^[0-9a-f]{64}$/i;

const attachmentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    // Path to the encrypted bytes on disk. The server never has the key to
    // open them — nacl.box ciphertext in, nacl.box ciphertext out.
    storagePath: { type: String, required: true },
    nonce: { type: String, required: true },
    // Sealed-box envelope metadata: a one-time ephemeral keypair was used to
    // seal the file to the recipient's public key (targetPublicKey). Only
    // the recipient's matching private key can open it — including the
    // sender, who deliberately can't re-decrypt their own upload afterward
    // (they already have the original file locally when they chose to send
    // it, and sealing a second copy to themselves would double the upload
    // cost for every attachment).
    ephemeralPublicKey: { type: String, required: true, match: HEX_64 },
    targetPublicKey: { type: String, required: true, match: HEX_64 },
  },
  { timestamps: true }
);

export default mongoose.model('Attachment', attachmentSchema, 'attachments');
