# QuantumChat — Frontend Documentation

This document explains the full **frontend** codebase: what it contains, how the apps are structured, how they talk to the backend, and how to run and extend them.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Shared Package](#shared-package)
7. [Widget App](#widget-app)
8. [Admin App](#admin-app)
9. [SDK](#sdk)
10. [API Layer](#api-layer)
11. [Real-Time (Socket.IO)](#real-time-socketio)
12. [State Management](#state-management)
13. [Theming & Styling](#theming--styling)
14. [Build & Deploy](#build--deploy)
15. [Common Workflows](#common-workflows)

---

## Overview

The frontend lives in the `frontend/` folder and is split into **three packages**:

| Package | Purpose | Dev URL | Port |
|---------|---------|---------|------|
| **widget** | User-facing chat UI (login, messaging, embeddable widget) | http://localhost:5173 | 5173 |
| **admin** | Admin dashboard (analytics, users, sites, live chat) | http://localhost:5174 | 5174 |
| **sdk** | JavaScript loader for embedding the widget on external websites | — | — |

Both **widget** and **admin** are React 18 + TypeScript + Vite apps. They depend on the backend API at `http://localhost:4000` (configurable via env).

```
┌─────────────────────────────────────────────────────────────┐
│                     frontend/                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   widget/   │  │   admin/    │  │    sdk/     │         │
│  │  (users)    │  │  (admins)   │  │  (embed)    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          ▼                                  │
│              @quantum-chat/shared (backend/shared)          │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
              Backend API + Socket.IO (port 4000)
```

---

## Project Structure

```
frontend/
├── package.json          # Root scripts: dev, build (runs admin + widget + sdk)
├── README.md
│
├── admin/                # Admin dashboard
│   ├── src/
│   │   ├── App.tsx           # Routes & auth guard
│   │   ├── api.ts            # REST client for admin APIs
│   │   ├── socket.ts         # Socket.IO client for live chat
│   │   ├── config.ts         # Widget URL helpers
│   │   ├── theme.ts          # Color tokens per theme
│   │   ├── context/
│   │   │   └── ThemeContext.tsx   # Light/Dark/Midnight/Ocean themes
│   │   ├── components/
│   │   │   ├── Layout.tsx         # Top nav, breadcrumbs, logout
│   │   │   ├── ThemeSwitcher.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   └── pages/
│   │       ├── LoginPage.tsx      # Admin login
│   │       ├── DashboardPage.tsx  # Analytics charts (Recharts)
│   │       ├── ChatPage.tsx       # Admin live chat
│   │       ├── WebsitesPage.tsx   # Manage tenant sites
│   │       ├── UsersPage.tsx      # User management
│   │       └── MessagesPage.tsx   # Message moderation
│   ├── .env.example
│   └── vite.config.ts        # Port 5174, shared alias
│
├── widget/               # Chat widget & user portal
│   ├── src/
│   │   ├── dev.tsx           # Dev entry: AuthPage → AppShell
│   │   ├── index.ts          # Production embed API (QuantumChat.init)
│   │   ├── QuantumChatWidget.tsx  # Core widget component
│   │   ├── api.ts            # REST client (widget/user APIs)
│   │   ├── socket.ts         # Socket.IO client
│   │   ├── theme.ts          # Navy/blue design tokens
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx       # User login & signup
│   │   │   └── AppShell.tsx       # Post-login shell + widget
│   │   ├── context/
│   │   │   ├── WidgetContext.tsx  # React context for widget tree
│   │   │   └── types.ts           # ChatState + chatReducer
│   │   ├── components/
│   │   │   ├── Launcher.tsx       # Floating chat button
│   │   │   ├── ChatWindow.tsx     # Main chat panel
│   │   │   ├── conversations/     # ConversationList, ConversationItem
│   │   │   ├── messages/          # MessageList, MessageBubble, MessageInput
│   │   │   └── ui/                # Button, Input, Avatar, Logo
│   │   ├── hooks/
│   │   │   └── useSdkBridge.ts    # postMessage bridge for SDK
│   │   └── utils/
│   │       ├── authApi.ts         # Login, register, profile
│   │       ├── authSession.ts     # localStorage session
│   │       ├── branding.ts        # Dynamic CSS from website config
│   │       ├── helpers.ts
│   │       ├── notifications.ts   # Browser notifications
│   │       └── siteConfigCache.ts # Cache website branding in sessionStorage
│   ├── .env.example
│   └── vite.config.ts        # Port 5173, library build for embed
│
└── sdk/                  # Embed loader for third-party sites
    └── src/
        └── index.ts          # createQuantumChat(), script loader
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI framework | React 18 |
| Language | TypeScript |
| Build tool | Vite 6 |
| Routing (admin) | React Router v7 |
| Styling (admin) | Tailwind CSS |
| Styling (widget) | Tailwind + inline styles + `styles.css` |
| Charts (admin) | Recharts |
| Real-time | Socket.IO Client |
| Shared types | `@quantum-chat/shared` (from `backend/shared`) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Backend running on port **4000** (see `backend/README.md`)
- MongoDB seeded (`npm run seed` in backend)

### Install dependencies

Each app has its own `node_modules`. The shared package is **local**, not on npm.

```powershell
# Shared package (used by admin, widget, backend)
cd backend/shared
npm install

# Backend
cd ../backend
npm install file:./shared

# Frontend root (concurrently only)
cd ../../frontend
npm install

# Admin
cd admin
npm install file:../../backend/shared
npm install

# Widget
cd ../widget
npm install file:../../backend/shared
npm install
```

### Run development servers

**Terminal 1 — Backend**
```powershell
cd backend
npm run dev
```

**Terminal 2 — Frontend (both apps)**
```powershell
cd frontend
npm run dev
```

Or run individually:
```powershell
npm run dev:admin    # http://localhost:5174
npm run dev:widget   # http://localhost:5173
```

---

## Environment Variables

### Widget (`frontend/widget/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend base URL | `http://localhost:4000` |
| `VITE_API_KEY` | Website API key (from `npm run seed`) | `qc_...` |
| `VITE_WEBSITE_ID` | Website MongoDB ID (from seed) | `6a4276d7...` |
| `VITE_ADMIN_URL` | Admin panel URL (link from widget) | `http://localhost:5174` |

### Admin (`frontend/admin/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend base URL | `http://localhost:4000` |
| `VITE_WIDGET_URL` | Widget URL (logout redirect, login links) | `http://localhost:5173` |

> Vite only exposes variables prefixed with `VITE_`.

---

## Shared Package

Types, constants, and Socket event names come from `@quantum-chat/shared` in `backend/shared/`.

Vite resolves it via alias in both apps:

```ts
// vite.config.ts (admin & widget)
resolve: {
  alias: {
    '@quantum-chat/shared': resolve(__dirname, '../../backend/shared/src/index.ts'),
  },
},
```

Exports include: `IUser`, `IMessage`, `IConversation`, `WidgetConfig`, `SOCKET_EVENTS`, `USER_ROLES`, etc.

---

## Widget App

The widget serves two roles:

1. **Standalone dev app** (`dev.tsx`) — full-page login/signup portal for users
2. **Embeddable widget** (`index.ts`) — floating chat loaded on any website

### User flow (standalone)

```
dev.tsx
  │
  ├─ No session? → AuthPage (login / register)
  │                    └─ authApi.ts → POST /api/v1/auth/login | /auth/register
  │
  └─ Has session?  → AppShell
                       ├─ Header (profile, logout, link to admin)
                       └─ QuantumChatWidget (floating chat)
```

**AuthPage** features:
- Split-screen layout with portal bar (User Sign In / Create Account / Admin Login)
- Admin Login redirects to `VITE_ADMIN_URL/login`
- White inputs with placeholders (`.qc-auth-input` in `styles.css`)

**AppShell** passes the user's JWT into `QuantumChatWidget` via `WidgetConfig.token`.

### Widget initialization (`QuantumChatWidget.tsx`)

On mount, the widget:

1. Validates `apiKey` from config
2. Authenticates (widget auth or existing token)
3. Loads website branding/settings
4. Connects Socket.IO
5. Fetches conversations and unread count
6. Renders `Launcher` + `ChatWindow` when open

### Key components

| Component | Role |
|-----------|------|
| `Launcher` | Floating button; shows unread badge |
| `ChatWindow` | Conversation list + active thread |
| `ConversationList` | Sidebar of chats |
| `MessageList` | Scrollable messages with pagination |
| `MessageBubble` | Single message (text, attachments, reactions) |
| `MessageInput` | Compose, attach files, typing indicator |

### Widget config (`WidgetConfig`)

Used when embedding on external sites:

```ts
{
  websiteId: string;
  apiKey: string;
  apiUrl?: string;
  token?: string;           // Pre-authenticated JWT
  user?: { email, displayName, externalId?, avatarUrl? };
  brandName?: string;
  theme?: Partial<WebsiteBranding>;
  onReady?: () => void;
  onMessage?: (msg) => void;
  onUnreadCount?: (count) => void;
}
```

### Session storage

| Key | Purpose |
|-----|---------|
| `qc_session` | User login session (token + user) in standalone mode |
| `qc_token_{apiKey}_{email}` | Widget JWT per site/user |
| `qc_site_{apiKey}` | Cached website branding |

---

## Admin App

The admin panel is for **super admins** and **admins** to manage the platform.

### Routes (`App.tsx`)

| Path | Page | Description |
|------|------|-------------|
| `/login` | `LoginPage` | Admin email/password login |
| `/` | `DashboardPage` | Stats, charts (users, messages, signups) |
| `/chat` | `ChatPage` | Real-time admin chat with users |
| `/websites` | `WebsitesPage` | Create/edit sites, API keys, branding |
| `/users` | `UsersPage` | List users, block/unblock |
| `/messages` | `MessagesPage` | Moderate/delete messages |

Auth is stored in `localStorage` as `qc_admin_token`. Unauthenticated users are redirected to `/login`.

### Layout

- **Top command bar** with logo, pill navigation, theme switcher, logout
- **Breadcrumb** for current section
- **Workspace card** wrapping page content
- Logout clears token and redirects to widget login (`VITE_WIDGET_URL`)

### Themes

`ThemeContext` supports four themes: **Light**, **Dark**, **Midnight**, **Ocean**.

Theme choice is persisted in `localStorage` and applied via CSS variables from `theme.ts`.

### Dashboard

Uses **Recharts** for:
- Messages per day (line chart)
- Signups per day (bar chart)
- Users by role (pie chart)
- Activity overview

Data from `GET /api/v1/admin/websites/:id/analytics`.

### Live Chat (`ChatPage`)

Admin joins conversations as a user via the same `/conversations` and `/messages` APIs, with real-time updates through `admin/src/socket.ts`.

---

## SDK

The SDK (`frontend/sdk/`) loads the widget on **any website** without a full React setup.

### Usage

```html
<script src="https://your-api.com/sdk/quantum-chat-sdk.js"></script>
<script>
  const chat = createQuantumChat({
    apiKey: 'qc_...',
    websiteId: '...',
    apiUrl: 'https://your-api.com',
    user: { email: 'user@site.com', displayName: 'Jane' },
    autoOpen: false,
    onReady: () => console.log('Widget ready'),
    onUnreadCount: (n) => console.log('Unread:', n),
  });

  chat.open();
  chat.close();
  chat.toggle();
  chat.destroy();
</script>
```

### How it works

1. Injects widget CSS from `{apiUrl}/widget/quantum-chat-widget.css`
2. Loads React + ReactDOM from unpkg
3. Loads widget UMD bundle from `{apiUrl}/widget/quantum-chat-widget.umd.cjs`
4. Calls `QuantumChat.init(config)`
5. Communicates via `window.postMessage` (`useSdkBridge` in widget)

---

## API Layer

All REST calls go to `{API_URL}/api/v1/...`.

### Widget (`widget/src/api.ts` — `ApiClient`)

| Method | Endpoint | Auth |
|--------|----------|------|
| `widgetAuth` | `POST /auth/widget` | `X-Api-Key` |
| `getWebsiteConfig` | `GET /websites/config` | `X-Api-Key` |
| `getMe` | `GET /auth/me` | Bearer + Api-Key |
| `getConversations` | `GET /conversations` | Bearer + Api-Key |
| `getMessages` | `GET /conversations/:id/messages` | Bearer + Api-Key |
| `sendMessage` | `POST /messages` | Bearer + Api-Key |
| `searchUsers` | `GET /users/search` | Bearer + Api-Key |

### Widget auth (`widget/src/utils/authApi.ts`)

Standalone login/register (no embed):

| Function | Endpoint |
|----------|----------|
| `loginUser` | `POST /auth/login` |
| `registerUser` | `POST /auth/register` |
| `loginAdmin` | `POST /auth/admin/login` |
| `fetchCurrentUser` | `GET /auth/me` |
| `updateProfile` | `PATCH /auth/profile` |
| `uploadAvatar` | `POST /attachments` |

### Admin (`admin/src/api.ts` — `AdminApi`)

| Method | Endpoint |
|--------|----------|
| `login` | `POST /auth/admin/login` |
| `getWebsites` | `GET /admin/websites` |
| `createWebsite` | `POST /admin/websites` |
| `getUsers` | `GET /admin/users` |
| `getMessages` | `GET /admin/messages` |
| `getAnalytics` | `GET /admin/websites/:id/analytics` |
| `getConversations` | `GET /conversations` |
| `sendMessage` | `POST /messages` |

---

## Real-Time (Socket.IO)

Both widget and admin use Socket.IO clients that connect to the backend with JWT auth.

### Events (from `@quantum-chat/shared`)

| Event | Direction | Purpose |
|-------|-----------|---------|
| `MESSAGE_NEW` | Server → Client | New message received |
| `MESSAGE_EDITED` | Server → Client | Message updated |
| `MESSAGE_DELETED` | Server → Client | Message removed |
| `MESSAGE_REACTED` | Server → Client | Reaction added |
| `TYPING_UPDATE` | Server → Client | User typing |
| `PRESENCE_UPDATE` | Server → Client | Online/offline status |
| `UNREAD_COUNT` | Server → Client | Unread badge update |
| `CONVERSATION_UPDATED` | Server → Client | Conversation list refresh |
| `MESSAGE_SEND` | Client → Server | Send message |
| `CONVERSATION_JOIN` | Client → Server | Join room for live updates |

Widget: `widget/src/socket.ts`  
Admin: `admin/src/socket.ts`

---

## State Management

### Widget

Uses **React `useReducer`** with `chatReducer` in `context/types.ts`.

State includes: conversations, messages per conversation, active thread, unread count, typing users, online presence, branding, settings.

Access via `WidgetContext` in child components:

```ts
const { state, dispatch, api, socket, theme } = useContext(WidgetContext);
```

### Admin

Uses **local component state** + `useState` in `App.tsx` for auth. Pages fetch their own data on mount. Theme via `ThemeContext`.

---

## Theming & Styling

### Widget

- Navy/blue palette in `widget/src/theme.ts`
- Website branding (colors, logo, position) from backend overrides defaults
- `branding.ts` injects CSS variables on the widget root
- Positions: `bottom-right`, `bottom-left`, `top-right`, `top-left`

### Admin

- Tailwind CSS with custom `navy` color scale in `tailwind.config.js`
- Four switchable themes via `ThemeContext`
- `ThemeSwitcher` in the layout header

---

## Build & Deploy

From `frontend/`:

```powershell
npm run build
```

This runs, in order:
1. `widget` → `dist/quantum-chat-widget.js`, `.umd.cjs`, `.css`
2. `admin` → `admin/dist/`
3. `sdk` → SDK bundle for script-tag install

Production widget is served by the backend at `/widget/*` after build.

---

## Common Workflows

### Add a new admin page

1. Create `admin/src/pages/MyPage.tsx`
2. Add route in `admin/src/App.tsx`
3. Add nav item in `admin/src/components/Layout.tsx`
4. Add API methods in `admin/src/api.ts` if needed

### Add a widget feature

1. Extend `ChatState` / `chatReducer` in `context/types.ts` if state is needed
2. Build UI in `components/`
3. Add API method in `api.ts`
4. Wire Socket handler in `socket.ts` if real-time

### Fix "Failed to fetch" on signup

1. Ensure backend is running: `cd backend && npm run dev`
2. Check `widget/.env` has correct `VITE_API_URL`, `VITE_API_KEY`, `VITE_WEBSITE_ID`
3. Re-run `npm run seed` if API key is invalid

### Embed widget on a client site

1. Build frontend: `npm run build` in `frontend/`
2. Deploy backend with widget static files
3. Use SDK or script tag with `apiKey` + `websiteId`

---

## Ports Summary

| Service | Port |
|---------|------|
| Backend API | 4000 |
| Widget | 5173 |
| Admin | 5174 |

---

## Related Docs

- `INSTALLATION.md` — Full project setup
- `API.md` — Backend API reference
- `backend/README.md` — Server setup
- `frontend/README.md` — Quick start
