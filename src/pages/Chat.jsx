import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';
import { connectSocket, getSocket } from '../api/socket.js';
import { sealMessage, unsealMessage, sealBytes, pickRandom } from '../crypto/keys.js';
import { getCurrentKeySet, findSecretKeyForPublicKey } from '../crypto/keyStorage.js';
import UserList from '../components/UserList.jsx';
import MessageBubble from '../components/MessageBubble.jsx';
import ThemeSwitcher from '../components/ThemeSwitcher.jsx';
import TypingIndicator from '../components/TypingIndicator.jsx';
import EmojiPicker from '../components/EmojiPicker.jsx';
import DateSeparator from '../components/DateSeparator.jsx';
import DragDropOverlay from '../components/DragDropOverlay.jsx';
import MessageSearch from '../components/MessageSearch.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/ToastProvider.jsx';

// Notification sound — a short sine-wave beep using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Silently fail if Web Audio is not available
  }
}

// File size limit in bytes (15 MB — matches backend upload.js)
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function formatLastSeen(iso) {
  if (!iso) return 'never logged in';
  return `last seen ${new Date(iso).toLocaleString()}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Check if two ISO dates fall on the same calendar day
function isSameDay(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Chat() {
  const { user, logout, regenerateKeys, hasLocalKeyring } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // UI loading states
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Scroll tracking states
  const [hasUnread, setHasUnread] = useState(false);

  // Feature states
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUser, setTypingUser] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Unread tracking per user
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  const messageListRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const selectedUserRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const dragCountRef = useRef(0);
  selectedUserRef.current = selectedUser;

  // Dynamic page title
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    const prefix = totalUnread > 0 ? `(${totalUnread}) ` : '';
    document.title = selectedUser
      ? `${prefix}${selectedUser.username} — QuantumChat`
      : `${prefix}QuantumChat`;
  }, [selectedUser, unreadCounts]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messageListRef.current) {
      const el = messageListRef.current;
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
    }
    setHasUnread(false);
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (!messageListRef.current) return;
    const el = messageListRef.current;
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
    if (!isUp) {
      setHasUnread(false);
    }
  }, []);

  const resolveMySecretKey = useCallback((targetPublicKeyHex) => findSecretKeyForPublicKey(user.id, targetPublicKeyHex), [user]);

  const decorate = useCallback(
    (raw) => {
      const isMine = raw.from === user.id;
      const envelope = isMine ? raw.forSender : raw.forRecipient;
      const mySecretKey = resolveMySecretKey(envelope.targetPublicKey);
      const text = mySecretKey ? unsealMessage(envelope, mySecretKey) : null;
      return { ...raw, text };
    },
    [user, resolveMySecretKey]
  );

  // Fetch users
  useEffect(() => {
    if (!hasLocalKeyring) return;
    setLoadingUsers(true);
    client
      .get('/users')
      .then((res) => setUsers(res.data.data))
      .finally(() => setLoadingUsers(false));
  }, [hasLocalKeyring]);

  // Socket event handlers
  useEffect(() => {
    if (!hasLocalKeyring) return;
    connectSocket();
    const socket = getSocket();

    function handleIncoming(raw) {
      const current = selectedUserRef.current;
      const otherId = raw.from === user.id ? raw.to : raw.from;

      // Update last message preview
      const decorated = decorate(raw);
      setLastMessages((prev) => ({
        ...prev,
        [otherId]: decorated.text || '📎 Attachment',
      }));

      if (!current || current.id !== otherId) {
        // Increment unread count for off-screen conversations
        setUnreadCounts((prev) => ({ ...prev, [otherId]: (prev[otherId] || 0) + 1 }));
        playNotificationSound();
        return;
      }

      setMessages((prev) => {
        const next = [...prev, decorated];

        if (messageListRef.current) {
          const el = messageListRef.current;
          const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
          if (isUp) {
            setHasUnread(true);
            if (raw.from !== user.id) playNotificationSound();
          } else {
            setTimeout(() => scrollToBottom('smooth'), 50);
          }
        }
        return next;
      });
    }

    // Online/offline presence
    function handleUserOnline({ userId }) {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    }
    function handleUserOffline({ userId }) {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }

    // Typing indicators
    function handleTypingStart({ from }) {
      const current = selectedUserRef.current;
      if (current && current.id === from) {
        setTypingUser(from);
      }
    }
    function handleTypingStop({ from }) {
      setTypingUser((prev) => (prev === from ? null : prev));
    }

    // Read receipts
    function handleMessageRead({ messageId, readAt }) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId || m._id === messageId ? { ...m, readAt } : m))
      );
    }

    socket.on('message:new', handleIncoming);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('message:read', handleMessageRead);

    return () => {
      socket.off('message:new', handleIncoming);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('message:read', handleMessageRead);
    };
  }, [hasLocalKeyring, user, decorate, scrollToBottom]);

  // Fetch conversation on user select
  useEffect(() => {
    if (!selectedUser || !hasLocalKeyring) return;
    setLoadingMessages(true);
    setTypingUser(null);
    // Clear unread for this user
    setUnreadCounts((prev) => ({ ...prev, [selectedUser.id]: 0 }));

    client
      .get(`/messages/${selectedUser.id}`)
      .then((res) => {
        setMessages(res.data.data.map(decorate));
        setTimeout(() => scrollToBottom('auto'), 50);
      })
      .finally(() => setLoadingMessages(false));
  }, [selectedUser, hasLocalKeyring, decorate, scrollToBottom]);

  // Emit read receipts when messages become visible
  useEffect(() => {
    if (!selectedUser || !messages.length) return;
    const socket = getSocket();
    if (!socket) return;

    // Mark unread messages from the other user as read
    messages.forEach((m) => {
      if (m.from !== user.id && !m.readAt) {
        socket.emit('message:read', { messageId: m.id || m._id, by: m.from });
      }
    });
  }, [messages, selectedUser, user]);

  const canChat = hasLocalKeyring;

  function handleSelectUser(u) {
    setSelectedUser(u);
    setSidebarOpen(false);
  }

  // Typing indicator emit
  function handleDraftChange(e) {
    setDraft(e.target.value);
    if (!selectedUser) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing:start', { to: selectedUser.id });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { to: selectedUser.id });
    }, 2000);
  }

  // Textarea auto-resize
  function handleTextareaInput(e) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // Handle send with Enter / Shift+Enter for newline
  function handleTextareaKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  // Keyboard shortcut: Ctrl+K for search
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !selectedUser) return;

    const socket = getSocket();
    if (socket) socket.emit('typing:stop', { to: selectedUser.id });
    clearTimeout(typingTimeoutRef.current);

    try {
      const myKey = pickRandom(getCurrentKeySet(user.id));
      const recipientPublicKey = pickRandom(selectedUser.publicKeys);
      const forRecipient = sealMessage(draft, recipientPublicKey);
      const forSender = sealMessage(draft, myKey.publicKey);
      const { data } = await client.post('/messages', { to: selectedUser.id, forRecipient, forSender });
      const decorated = decorate(data.data);
      setMessages((prev) => [...prev, decorated]);
      setLastMessages((prev) => ({ ...prev, [selectedUser.id]: decorated.text || '' }));
      setDraft('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send message', 'error');
    }
  }

  async function handleFileUpload(file) {
    if (!file || !selectedUser) return;

    // File size check BEFORE upload
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File too large (${formatFileSize(file.size)}). Maximum is ${formatFileSize(MAX_FILE_SIZE)}.`, 'error');
      return;
    }

    try {
      const myKey = pickRandom(getCurrentKeySet(user.id));
      const recipientPublicKey = pickRandom(selectedUser.publicKeys);
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const sealed = sealBytes(fileBytes, recipientPublicKey);

      const formData = new FormData();
      formData.append('file', new Blob([sealed.cipherBytes]), file.name);
      formData.append('recipientId', selectedUser.id);
      formData.append('nonce', sealed.nonce);
      formData.append('ephemeralPublicKey', sealed.ephemeralPublicKey);
      formData.append('targetPublicKey', sealed.targetPublicKey);
      const uploadRes = await client.post('/attachments', formData);

      const forRecipient = sealMessage('', recipientPublicKey);
      const forSender = sealMessage('', myKey.publicKey);
      const { data } = await client.post('/messages', {
        to: selectedUser.id,
        forRecipient,
        forSender,
        attachmentId: uploadRes.data.data.id,
      });
      setMessages((prev) => [...prev, decorate(data.data)]);
      setLastMessages((prev) => ({ ...prev, [selectedUser.id]: '📎 Attachment' }));
      setTimeout(() => scrollToBottom('smooth'), 50);
      showToast('File sent & encrypted successfully', 'success', 3000);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send attachment', 'error');
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    handleFileUpload(file);
  }

  // Drag and drop handlers
  function handleDragEnter(e) {
    e.preventDefault();
    dragCountRef.current += 1;
    if (dragCountRef.current === 1) setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setIsDragging(false);
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCountRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }

  async function handleGenerateKeys() {
    await regenerateKeys();
    showToast('New encryption keys generated successfully', 'success');
  }

  function handleLogout() {
    setLogoutConfirmOpen(true);
  }

  function confirmLogout() {
    setLogoutConfirmOpen(false);
    logout();
  }

  // Emoji selection
  function handleEmojiSelect(emoji) {
    setDraft((prev) => prev + emoji);
    textareaRef.current?.focus();
  }

  // Message search result handler
  function handleSearchResult(messageId) {
    setSearchOpen(false);
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.animation = 'none';
      el.offsetHeight; // trigger reflow
      el.style.animation = 'msgIn 400ms ease both';
    }
  }

  const title = useMemo(() => selectedUser?.username || 'Select a conversation', [selectedUser]);
  const filteredUsers = useMemo(
    () => users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  );

  // Build message list with date separators
  const messagesWithSeparators = useMemo(() => {
    const items = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      if (!prev || !isSameDay(prev.createdAt, m.createdAt)) {
        items.push({ type: 'separator', date: m.createdAt, key: `sep-${m.createdAt}` });
      }
      items.push({ type: 'message', data: m, key: m.id || m._id });
    });
    return items;
  }, [messages]);

  // Floating chat bubble icons for empty state
  const floatingBubbles = useMemo(() => {
    const sizes = [28, 22, 32, 18, 26];
    return sizes.map((size, i) => (
      <div key={i} className="chat-empty-floater">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    ));
  }, []);

  return (
    <div className="chat-page">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user.username}</div>
              <div className="sidebar-lastseen">{formatLastSeen(user.lastLoginAt)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeSwitcher />
            <button className="link-button" onClick={handleLogout} aria-label="Log out of session">
              Log out
            </button>
          </div>
        </div>
        {canChat && (
          <div className="sidebar-search">
            <input placeholder="Search people..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users list" />
          </div>
        )}
        {canChat ? (
          <UserList
            users={filteredUsers}
            selectedUserId={selectedUser?.id}
            onSelect={handleSelectUser}
            loading={loadingUsers}
            onlineUsers={onlineUsers}
            unreadCounts={unreadCounts}
            lastMessages={lastMessages}
          />
        ) : (
          <p className="empty-hint">Setup dynamic keypair required.</p>
        )}
      </aside>

      <main
        className="chat-main"
        onDragEnter={canChat && selectedUser ? handleDragEnter : undefined}
        onDragLeave={canChat && selectedUser ? handleDragLeave : undefined}
        onDragOver={canChat && selectedUser ? handleDragOver : undefined}
        onDrop={canChat && selectedUser ? handleDrop : undefined}
      >
        {!canChat && (
          <div className="key-warning">
            <div className="key-warning-header">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Security Check Required</span>
            </div>
            <p>
              No private keys found on this device. Your local storage may have been cleared. Previous messages encrypted under your old keys cannot be read here, but you can generate a new keyset to continue messaging securely.
            </p>
            <button onClick={handleGenerateKeys}>Generate new device keys</button>
          </div>
        )}

        {canChat && (
          <>
            <header className="chat-header">
              <div className="chat-header-left">
                <button
                  className="mobile-menu-btn"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open conversation menu"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
                <span>{title}</span>
                {selectedUser && typingUser && <TypingIndicator isTyping={true} />}
              </div>
              <div className="chat-header-actions">
                {selectedUser && (
                  <button
                    className="chat-header-btn"
                    onClick={() => setSearchOpen(!searchOpen)}
                    title="Search messages (Ctrl+K)"
                    aria-label="Search messages"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </button>
                )}
                {selectedUser && <span className="last-seen-badge">{formatLastSeen(selectedUser.lastLoginAt)}</span>}
              </div>
            </header>

            {/* Message search panel */}
            {searchOpen && selectedUser && (
              <MessageSearch
                messages={messages}
                onResultSelect={handleSearchResult}
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
              />
            )}

            {!selectedUser ? (
              <div className="chat-empty-state">
                {floatingBubbles}
                <div className="chat-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h2>No conversation selected</h2>
                <p>Choose a contact from the sidebar to begin messaging</p>
              </div>
            ) : (
              <>
                {/* Drag and drop overlay */}
                {isDragging && (
                  <DragDropOverlay isVisible={true} onFileDrop={handleFileUpload} />
                )}

                <div
                  className="message-list"
                  ref={messageListRef}
                  onScroll={handleScroll}
                >
                  {loadingMessages ? (
                    <>
                      <div className="skeleton-message-bubble theirs skeleton" />
                      <div className="skeleton-message-bubble mine skeleton" />
                      <div className="skeleton-message-bubble theirs skeleton" style={{ width: '45%' }} />
                      <div className="skeleton-message-bubble mine skeleton" style={{ width: '35%' }} />
                    </>
                  ) : (
                    messagesWithSeparators.map((item, index) => {
                      if (item.type === 'separator') {
                        return <DateSeparator key={item.key} date={item.date} />;
                      }

                      const m = item.data;
                      const prevMsg = index > 0 && messagesWithSeparators[index - 1].type === 'message'
                        ? messagesWithSeparators[index - 1].data
                        : null;
                      const isGrouped =
                        prevMsg &&
                        prevMsg.from === m.from &&
                        new Date(m.createdAt) - new Date(prevMsg.createdAt) < 120000;

                      return (
                        <div key={item.key} id={`msg-${m.id || m._id}`}>
                          <MessageBubble
                            message={m}
                            isMine={m.from === user.id}
                            resolveAttachmentKey={(attachment) =>
                              resolveMySecretKey(attachment.targetPublicKey)
                            }
                            grouped={isGrouped}
                          />
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {hasUnread && (
                  <button
                    className="scroll-bottom-pill"
                    onClick={() => scrollToBottom('smooth')}
                    aria-label="Scroll to bottom"
                  >
                    <span>New messages</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                  </button>
                )}

                <div className="composer-hint">
                  <span><kbd>Enter</kbd> send</span>
                  <span><kbd>Shift</kbd>+<kbd>Enter</kbd> new line</span>
                  <span><kbd>Ctrl</kbd>+<kbd>K</kbd> search</span>
                  <span style={{ marginLeft: 'auto', opacity: 0.6 }}>Max file: 15 MB</span>
                </div>

                <form className="composer" onSubmit={handleSend}>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="attach-button"
                      onClick={() => setEmojiOpen(!emojiOpen)}
                      aria-label="Open emoji picker"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </button>
                    {emojiOpen && (
                      <EmojiPicker
                        isOpen={emojiOpen}
                        onSelect={handleEmojiSelect}
                        onClose={() => setEmojiOpen(false)}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    className="attach-button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach file"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
                  <textarea
                    ref={textareaRef}
                    placeholder="Type an encrypted message…"
                    value={draft}
                    onChange={handleDraftChange}
                    onInput={handleTextareaInput}
                    onKeyDown={handleTextareaKeyDown}
                    aria-label="Type message"
                    rows={1}
                  />
                  <button type="submit" className="send-button" aria-label="Send message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </main>

      {/* Logout confirmation dialog */}
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Log out of QuantumChat?"
        message="Your encryption keys are stored in this browser's local storage. If you clear your browser data after logging out, you won't be able to decrypt your message history."
        confirmLabel="Log out"
        cancelLabel="Stay"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
        variant="danger"
      />
    </div>
  );
}
