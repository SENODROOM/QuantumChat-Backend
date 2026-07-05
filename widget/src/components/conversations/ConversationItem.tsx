import { useEffect, useState } from 'react';
import { useWidget } from '../../context/WidgetContext';
import { Avatar } from '../ui/Avatar';
import { formatMessageTime, getOtherParticipant, getUnreadForUser, normalizeId } from '../../utils/helpers';
import { getMessagePreview, E2E_PREVIEW } from '../../utils/messageCrypto';
import { theme } from '../../theme';
import type { IConversation } from '@quantum-chat/shared';

interface ConversationItemProps {
  conversation: IConversation & {
    participants: { _id: string; displayName: string; avatarUrl?: string; isOnline?: boolean }[];
    lastMessage?: { content: string; senderId: { displayName: string } | string; createdAt: Date };
  };
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const { state } = useWidget();
  const other = getOtherParticipant(conversation, state.user!._id);
  const unread = getUnreadForUser(conversation.unreadCounts, state.user!._id);
  const otherId = other ? normalizeId(other._id) : '';
  const lastMsg = conversation.lastMessage;
  const [preview, setPreview] = useState('');

  useEffect(() => {
    let active = true;
    const raw =
      lastMsg && typeof lastMsg === 'object' && lastMsg !== null && 'content' in lastMsg
        ? (lastMsg as { content: string }).content
        : '';
    if (!raw) {
      setPreview('');
      return;
    }
    getMessagePreview(conversation._id, raw).then((text) => {
      if (active) setPreview(text || E2E_PREVIEW);
    });
    return () => {
      active = false;
    };
  }, [conversation._id, lastMsg]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`qc-conv-item w-full flex items-center gap-3 px-4 py-3.5 text-left ${isActive ? 'qc-conv-item-active' : ''}`}
      style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
    >
      <Avatar
        name={other?.displayName || '?'}
        src={other?.avatarUrl}
        isOnline={state.onlineUsers[otherId] ?? other?.isOnline}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            style={{
              fontWeight: unread > 0 ? 700 : 600,
              fontSize: 14,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {other?.displayName}
          </span>
          {lastMsg && (
            <span style={{ fontSize: 11, color: theme.colors.textMuted, flexShrink: 0 }}>
              {formatMessageTime(lastMsg.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-1 gap-2">
          <p
            style={{
              fontSize: 13,
              color: unread > 0 ? theme.colors.textSecondary : theme.colors.textMuted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
              fontWeight: unread > 0 ? 500 : 400,
            }}
          >
            {lastMsg ? preview || E2E_PREVIEW : 'Start a conversation'}
          </p>
          {unread > 0 && (
            <span
              style={{
                flexShrink: 0,
                background: theme.colors.accent,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
              }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
