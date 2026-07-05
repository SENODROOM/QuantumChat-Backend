import { useState } from 'react';
import { useWidget } from '../../context/WidgetContext';
import { Avatar } from '../ui/Avatar';
import { formatMessageTime } from '../../utils/helpers';
import { encryptEditedContent } from '../../utils/messageCrypto';
import type { IMessage, IAttachment } from '@quantum-chat/shared';

const REACTIONS = ['👍', '❤️', '😂', '🔥', '👏'];

interface MessageBubbleProps {
  message: IMessage & {
    senderId: { _id: string; displayName: string; avatarUrl?: string };
    attachments?: Array<IAttachment | string>;
  };
  isOwn: boolean;
  onReply: (message: IMessage) => void;
}

function isPopulatedAttachment(a: IAttachment | string): a is IAttachment {
  return typeof a === 'object' && a !== null && '_id' in a;
}

function ActionBtn({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        fontSize: 11,
        color: color || 'inherit',
        background: 'rgba(255,255,255,0.08)',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 8,
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

export function MessageBubble({ message, isOwn, onReply }: MessageBubbleProps) {
  const { state, api, dispatch, theme: uiTheme, config } = useWidget();
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const attachments = (message.attachments || []).filter(isPopulatedAttachment);

  if (message.isDeleted) {
    return (
      <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
        <p style={{ fontSize: 12, color: uiTheme.colors.textMuted, fontStyle: 'italic', margin: 0 }}>Message deleted</p>
      </div>
    );
  }

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    const encrypted = await encryptEditedContent(message.conversationId, editContent);
    await api.editMessage(message._id, encrypted);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await api.deleteMessage(message._id);
    dispatch({ type: 'DELETE_MESSAGE', payload: { conversationId: message.conversationId, messageId: message._id } });
  };

  const handleReact = async (emoji: string) => {
    await api.reactMessage(message._id, emoji);
    setShowReactions(false);
  };

  const isRead = message.readBy?.length > 1;
  const baseUrl = config.apiUrl || 'http://localhost:4000';

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 14,
        flexDirection: isOwn ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
      }}
    >
      {!isOwn && <Avatar name={message.senderId.displayName} src={message.senderId.avatarUrl} size="sm" />}

      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
        {!isOwn && (
          <span style={{ fontSize: 11, fontWeight: 600, color: uiTheme.colors.textSecondary, marginBottom: 4, marginLeft: 4 }}>
            {message.senderId.displayName}
          </span>
        )}

        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="qc-search-input"
              style={{ borderRadius: 12, padding: '10px 12px', fontSize: 13, minWidth: 200, minHeight: 60, resize: 'vertical' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionBtn label="Save" onClick={handleEdit} color={uiTheme.colors.accentLight} />
              <ActionBtn label="Cancel" onClick={() => setIsEditing(false)} />
            </div>
          </div>
        ) : (
          <div
            className={isOwn ? 'qc-bubble-own' : 'qc-bubble-other'}
            style={{
              padding: '10px 14px',
              borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {message.replyTo && typeof message.replyTo === 'object' && (
              <div style={{ fontSize: 11, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.15)', opacity: 0.85 }}>
                ↩ Replying to a message
              </div>
            )}
            {message.content && (
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
            )}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: message.content ? 8 : 0 }}>
                {attachments.map((file) => {
                  const fileUrl = file.url?.startsWith('http') ? file.url : `${baseUrl}${file.url}`;
                  const isImage = file.mimeType?.startsWith('image/');
                  return isImage ? (
                    <a key={file._id} href={fileUrl} target="_blank" rel="noreferrer">
                      <img src={fileUrl} alt={file.originalName} style={{ maxWidth: '100%', borderRadius: 10, maxHeight: 180, objectFit: 'cover' }} />
                    </a>
                  ) : (
                    <a
                      key={file._id}
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: '#fff', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      📎 {file.originalName || 'Attachment'}
                    </a>
                  );
                })}
              </div>
            )}
            {message.isEdited && <span style={{ fontSize: 10, opacity: 0.7 }}> (edited)</span>}
          </div>
        )}

        {message.reactions && message.reactions.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {message.reactions.map((r, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  background: uiTheme.colors.navy700,
                  border: `1px solid ${uiTheme.colors.border}`,
                  borderRadius: 12,
                  padding: '2px 8px',
                }}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexDirection: isOwn ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: uiTheme.colors.textMuted }}>{formatMessageTime(message.createdAt)}</span>
          {isOwn && (
            <span style={{ fontSize: 10, color: isRead ? uiTheme.colors.accentLight : uiTheme.colors.textMuted }}>
              {isRead ? '✓✓' : '✓'}
            </span>
          )}
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
            <ActionBtn label="Reply" onClick={() => onReply(message)} />
            {state.settings.allowReactions && (
              <ActionBtn label="React" onClick={() => setShowReactions((v) => !v)} />
            )}
            {isOwn && state.settings.allowEditing && (
              <ActionBtn label="Edit" onClick={() => setIsEditing(true)} color={uiTheme.colors.accentLight} />
            )}
            {isOwn && <ActionBtn label="Delete" onClick={handleDelete} color={uiTheme.colors.error} />}
          </div>
        )}

        {showReactions && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, padding: '4px 8px', background: uiTheme.colors.navy800, borderRadius: 12, border: `1px solid ${uiTheme.colors.border}` }}>
            {REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => handleReact(emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
