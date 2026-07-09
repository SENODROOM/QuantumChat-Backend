# QuantumChat — Backend

Express/Mongoose/Socket.IO API for QuantumChat. It never sees a private key or plaintext message — every message and attachment arrives already sealed with `nacl.box` (see [`frontend/src/crypto/keys.js`](../frontend/src/crypto/keys.js)), so the server's job is limited to auth, storage, and relaying ciphertext.

Full architecture and crypto design: see the [root README](../README.md).

## Scripts

```bash
npm install
cp .env.example .env    # set MONGODB_URI and JWT_SECRET at minimum
npm run dev              # nodemon, local dev — persistent server + Socket.IO, http://localhost:5000
npm start                # plain node, same entry point
```

There is no build step — it's plain ESM Node, run directly.

## Project structure

```
server.js              # local-dev entry point: connects DB, starts HTTP + Socket.IO server
api/index.js             # Vercel serverless entry point — no Socket.IO, cached DB connection
vercel.json               # rewrites all paths to api/index for Vercel deployment
src/
  app.js                 # createApp(): express instance, middleware, routes (used by both entry points)
  config/db.js             # connectDB(): caches the mongoose connection promise (safe to call repeatedly)
  models/
    User.js               # username/email/password, publicKeys[5] (KEY_SET_SIZE, fixed at registration), lastLoginAt
    Message.js             # from/to, forRecipient + forSender sealed-box envelopes, optional attachment ref
    Attachment.js           # owner/recipient, storagePath on disk, single sealed-box envelope (recipient only)
  controllers/
    authController.js       # register (creates the 5-key pool once), login (auth only, doesn't touch keys)
    userController.js       # listUsers, getUser, updatePublicKeys (manual device-recovery only)
    messageController.js     # sendMessage (validates both envelopes), getConversation
    attachmentController.js  # uploadAttachment (multer), downloadAttachment (sender/recipient only)
  routes/                   # one file per resource, mounted under /api/<resource> in app.js
  middleware/
    auth.js                 # requireAuth: verifies JWT, attaches req.user
    upload.js                # multer disk storage config, resolveUploadPath()
    rateLimiter.js            # authLimiter: 20 req/min on /api/auth/*
  socket/index.js             # attachSocket(io): JWT-authenticated Socket.IO, per-user rooms (local dev only)
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | HTTP/Socket.IO port — local dev only, unused on Vercel |
| `MONGODB_URI` | — | **Required.** Mongo connection string, including the database name |
| `JWT_SECRET` | — | **Required.** JWT signing secret — set a long random value |
| `JWT_EXPIRES_IN` | 7d | Token lifetime |
| `UPLOAD_DIR` | `uploads` (or `/tmp/uploads` if `VERCEL` is set) | Where encrypted attachment blobs are stored on disk |

`.env` is git-ignored — never commit real credentials. On Vercel, set these in the project dashboard (Settings → Environment Variables); a local `.env` file has no effect there.

## API summary

See the [root README](../README.md#api-reference) for the full request/response shapes. Quick reference:

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/register` | — | body needs `publicKeys` (5 keys), fixed thereafter |
| POST | `/api/auth/login` | — | just `{ email, password }` — doesn't touch keys |
| GET | `/api/auth/me` | JWT | |
| GET | `/api/users` | JWT | |
| GET | `/api/users/:id` | JWT | |
| PATCH | `/api/users/me/public-keys` | JWT | manual device-recovery only, replaces the whole pool |
| POST | `/api/messages` | JWT | body needs `forRecipient` + `forSender` envelopes |
| GET | `/api/messages/:userId` | JWT | full history with that user |
| POST | `/api/attachments` | JWT | `multipart/form-data`, pre-sealed file bytes |
| GET | `/api/attachments/:id/raw` | JWT | sender or recipient only |

## Deploying to Vercel

Deploy this repo directly (it's its own GitHub repo, not the monorepo root) with **Root Directory left blank**. Required env vars: `MONGODB_URI`, `JWT_SECRET`. See the [root README's deployment section](../README.md#deploying-to-vercel) for the Socket.IO and attachment-storage limitations that apply on serverless hosting.
