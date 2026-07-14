// Simple string hash to pick a consistent gradient class per username
function hashUsername(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // force 32-bit int
  }
  return Math.abs(hash) % 10;
}

function isRecentlyActive(iso) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}

function formatShortLastSeen(iso) {
  if (!iso) return 'offline';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function UserList({ users, selectedUserId, onSelect, loading, onlineUsers = new Set(), unreadCounts = {}, lastMessages = {} }) {
  if (loading) {
    return (
      <div className="user-list">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="user-list-item" style={{ pointerEvents: 'none' }}>
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton-user-info">
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-line medium" style={{ marginTop: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="user-list">
      {users.map((u) => {
        const online = onlineUsers.has(u.id) || isRecentlyActive(u.lastLoginAt);
        const unread = unreadCounts[u.id] || 0;
        const lastMsg = lastMessages[u.id];

        return (
          <button
            key={u.id}
            className={`user-list-item ${u.id === selectedUserId ? 'active' : ''}`}
            onClick={() => onSelect(u)}
            aria-label={`Chat with ${u.username}, ${online ? 'online' : 'offline'}${unread ? `, ${unread} unread` : ''}`}
          >
            <span className={`avatar avatar-gradient-${hashUsername(u.username)}`}>
              {u.username.slice(0, 2).toUpperCase()}
              {online && <span className="online-dot" />}
            </span>
            <span className="user-list-meta">
              <span className="user-list-name">{u.username}</span>
              {lastMsg ? (
                <span className="user-list-preview">{lastMsg}</span>
              ) : (
                <span className="user-list-lastseen">{formatShortLastSeen(u.lastLoginAt)}</span>
              )}
            </span>
            {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
        );
      })}
      {users.length === 0 && <p className="empty-hint">No other users yet.</p>}
    </div>
  );
}
