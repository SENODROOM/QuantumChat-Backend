import { useState, useEffect } from 'react';
import { useWidget } from '../../context/WidgetContext';
import { Input } from '../ui/Input';
import { ConversationItem } from './ConversationItem';
import { Avatar } from '../ui/Avatar';
import { theme } from '../../theme';

export function ConversationList() {
  const { state, dispatch, api } = useWidget();
  const [searchResults, setSearchResults] = useState<typeof state.conversations>([]);
  const [userResults, setUserResults] = useState<{ _id: string; displayName: string; avatarUrl?: string }[]>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!state.searchQuery.trim() || state.searchQuery.trim().length < 2) {
        setSearchResults([]);
        setUserResults([]);
        return;
      }
      try {
        const [convResults, userRes] = await Promise.all([
          api.searchConversations(state.searchQuery),
          api.searchUsers(state.searchQuery),
        ]);
        setSearchResults(convResults);
        setUserResults(userRes.data);
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state.searchQuery]);

  const handleSelect = (conversationId: string) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conversationId });
  };

  const handleNewChat = async (participantId: string) => {
    const conv = await api.createConversation(participantId);
    dispatch({ type: 'SET_CONVERSATIONS', payload: [conv as typeof state.conversations[0], ...state.conversations] });
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conv._id });
    dispatch({ type: 'SET_SEARCH', payload: '' });
  };

  const displayConversations = state.searchQuery ? searchResults : state.conversations;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: theme.colors.navy900 }}>
      {state.user && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            borderBottom: `1px solid ${theme.colors.border}`,
            background: 'rgba(59, 130, 246, 0.06)',
          }}
        >
          <Avatar name={state.user.displayName} src={state.user.avatarUrl} size="md" isOnline />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: theme.colors.text }}>{state.user.displayName}</p>
            <p style={{ margin: 0, fontSize: 12, color: theme.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.user.email}</p>
          </div>
        </div>
      )}

      <div style={{ padding: '16px 18px 12px', flexShrink: 0 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: theme.colors.text, letterSpacing: '-0.02em' }}>
          Chats
        </h2>
        <Input
          placeholder="Search people or messages..."
          value={state.searchQuery}
          onChange={(e) => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      </div>

      <div className="qc-scrollbar" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {state.searchQuery && userResults.length > 0 && (
          <div style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
            <p style={{ padding: '10px 18px 6px', fontSize: 11, fontWeight: 600, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              People
            </p>
            {userResults.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => handleNewChat(user._id)}
                className="qc-conv-item"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 18px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              >
                <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
                <span style={{ fontSize: 14, fontWeight: 500, color: theme.colors.text }}>{user.displayName}</span>
              </button>
            ))}
          </div>
        )}

        {displayConversations.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${theme.colors.navy700} 0%, ${theme.colors.navy800} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <svg width="28" height="28" fill="none" stroke={theme.colors.accentLight} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: theme.colors.text, margin: '0 0 6px' }}>No conversations yet</p>
            <p style={{ fontSize: 13, color: theme.colors.textMuted, margin: 0, lineHeight: 1.5 }}>
              Search for someone to start chatting · attach files · edit your messages
            </p>
          </div>
        ) : (
          displayConversations.map((conv) => (
            <ConversationItem
              key={conv._id}
              conversation={conv as Parameters<typeof ConversationItem>[0]['conversation']}
              isActive={state.activeConversationId === conv._id}
              onClick={() => handleSelect(conv._id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
