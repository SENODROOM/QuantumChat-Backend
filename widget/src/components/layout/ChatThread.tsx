import { useState, useEffect } from 'react';
import { useWidget } from '../../context/WidgetContext';
import { MessageList } from '../messages/MessageList';
import { MessageInput } from '../messages/MessageInput';
import { Avatar } from '../ui/Avatar';
import { getOtherParticipant, normalizeId } from '../../utils/helpers';
import { theme } from '../../theme';
import type { IMessage, IConversation } from '@quantum-chat/shared';

export function ChatThread() {
  const { state, dispatch, api, socket } = useWidget();
  const [replyTo, setReplyTo] = useState<IMessage | null>(null);
  const convId = state.activeConversationId;

  useEffect(() => {
    if (!convId || !socket) return;
    socket.joinConversation(convId);

    const loadMessages = async () => {
      if (state.messages[convId]) return;
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const result = await api.getMessages(convId);
        dispatch({
          type: 'SET_MESSAGES',
          payload: { conversationId: convId, messages: result.data, hasMore: result.hasMore },
        });
        socket.markRead(convId);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadMessages();
    return () => {
      socket.leaveConversation(convId);
    };
  }, [convId, socket, api, dispatch, state.messages]);

  if (!convId) return null;

  const activeConv = state.conversations.find((c) => c._id === convId) as
    | (IConversation & { participants: { _id: unknown; displayName: string; avatarUrl?: string }[] })
    | undefined;
  const other = activeConv && state.user ? getOtherParticipant(activeConv, state.user._id) : null;
  const otherId = other ? normalizeId(other._id) : '';

  return (
    <div className="qc-thread">
      <header className="qc-thread-header">
        {other && (
          <>
            <Avatar name={other.displayName} src={other.avatarUrl} size="md" isOnline={state.onlineUsers[otherId]} />
            <div className="qc-thread-header-info">
              <h3>{other.displayName}</h3>
              <p>{state.onlineUsers[otherId] ? 'Online' : 'Offline'}</p>
            </div>
          </>
        )}
      </header>

      <div className="qc-thread-body">
        {state.isLoading ? (
          <div className="qc-thread-loading">
            <div className="qc-spinner" />
          </div>
        ) : (
          <MessageList onReply={setReplyTo} />
        )}
      </div>

      <MessageInput replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
    </div>
  );
}

export function ChatEmptyState() {
  return (
    <div className="qc-thread-empty">
      <div className="qc-thread-empty-card">
        <div className="qc-thread-empty-icon">
          <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <h2>QuantumChat Web</h2>
        <p>Select a conversation from the left, or search for someone to start a new chat.</p>
        <ul>
          <li>End-to-end secure messaging</li>
          <li>Real-time delivery and read status</li>
          <li>Share files and stay connected with your team</li>
        </ul>
      </div>
    </div>
  );
}
