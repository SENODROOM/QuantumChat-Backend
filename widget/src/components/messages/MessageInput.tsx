import { useState, useRef } from 'react';
import { useWidget } from '../../context/WidgetContext';
import { prepareOutgoingContent } from '../../utils/messageCrypto';
import type { IMessage, IAttachment } from '@quantum-chat/shared';

interface MessageInputProps {
  replyTo: IMessage | null;
  onClearReply: () => void;
}

interface PendingFile {
  id: string;
  name: string;
}

export function MessageInput({ replyTo, onClearReply }: MessageInputProps) {
  const { api, socket, state, theme: uiTheme } = useWidget();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const convId = state.activeConversationId!;

  const handleTyping = () => {
    socket?.startTyping(convId);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket?.stopTyping(convId), 2000);
  };

  const handleSend = async () => {
    if (!content.trim() && attachments.length === 0) return;
    const plaintext = content.trim();

    try {
      if (plaintext) {
        const { encrypted, keyExchange } = await prepareOutgoingContent(convId, plaintext);
        if (keyExchange) {
          await socket?.sendMessage({ conversationId: convId, content: keyExchange });
        }
        await socket?.sendMessage({
          conversationId: convId,
          content: encrypted,
          replyTo: replyTo?._id,
          attachmentIds: attachments.length ? attachments : undefined,
        });
      } else {
        await socket?.sendMessage({
          conversationId: convId,
          content: '',
          replyTo: replyTo?._id,
          attachmentIds: attachments.length ? attachments : undefined,
        });
      }
    } catch {
      if (plaintext) {
        const { encrypted, keyExchange } = await prepareOutgoingContent(convId, plaintext);
        if (keyExchange) {
          await api.sendMessage({ conversationId: convId, content: keyExchange });
        }
        await api.sendMessage({
          conversationId: convId,
          content: encrypted,
          replyTo: replyTo?._id,
          attachmentIds: attachments.length ? attachments : undefined,
        });
      } else {
        await api.sendMessage({
          conversationId: convId,
          content: '',
          replyTo: replyTo?._id,
          attachmentIds: attachments.length ? attachments : undefined,
        });
      }
    }
    setContent('');
    setAttachments([]);
    setPendingFiles([]);
    onClearReply();
    socket?.stopTyping(convId);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxBytes = state.settings.maxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`File too large. Max ${state.settings.maxFileSizeMb}MB`);
      return;
    }
    setIsUploading(true);
    try {
      const attachment: IAttachment = await api.uploadFile(file);
      setAttachments((prev) => [...prev, attachment._id]);
      setPendingFiles((prev) => [...prev, { id: attachment._id, name: file.name }]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a !== id));
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const canSend = content.trim() || attachments.length > 0;
  const allowUploads = state.settings.allowFileUploads;

  return (
    <div
      style={{
        padding: '12px 14px',
        borderTop: `1px solid ${uiTheme.colors.border}`,
        background: uiTheme.colors.navy950,
        flexShrink: 0,
      }}
    >
      {replyTo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: uiTheme.colors.navy800,
            borderRadius: 10,
            padding: '8px 12px',
            marginBottom: 10,
            borderLeft: `3px solid ${uiTheme.colors.accent}`,
          }}
        >
          <span style={{ fontSize: 12, color: uiTheme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ↩ {replyTo.content.slice(0, 60)}
          </span>
          <button type="button" onClick={onClearReply} style={{ background: 'none', border: 'none', color: uiTheme.colors.textMuted, cursor: 'pointer', fontSize: 16, marginLeft: 8 }}>×</button>
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {pendingFiles.map((file) => (
            <span
              key={file.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: uiTheme.colors.accentLight,
                background: uiTheme.colors.navy800,
                border: `1px solid ${uiTheme.colors.border}`,
                borderRadius: 10,
                padding: '4px 10px',
              }}
            >
              📎 {file.name}
              <button type="button" onClick={() => removeAttachment(file.id)} style={{ background: 'none', border: 'none', color: uiTheme.colors.textMuted, cursor: 'pointer', fontSize: 14 }}>×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {allowUploads && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 12px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: `1px solid ${uiTheme.colors.border}`,
                color: uiTheme.colors.accentLight,
                cursor: isUploading ? 'wait' : 'pointer',
                borderRadius: 12,
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 600,
              }}
              title={`Attach file (max ${state.settings.maxFileSizeMb}MB)`}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {isUploading ? '...' : 'Attach'}
            </button>
            <input ref={fileRef} type="file" onChange={handleFile} accept="image/*,video/*,.pdf,.doc,.docx,.txt" style={{ display: 'none' }} />
          </>
        )}

        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); handleTyping(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={allowUploads ? 'Type a message or attach a file...' : 'Type a message...'}
          rows={1}
          className="qc-search-input"
          style={{
            flex: 1,
            resize: 'none',
            borderRadius: 14,
            padding: '10px 14px',
            fontSize: 14,
            maxHeight: 96,
            lineHeight: 1.4,
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            padding: 11,
            background: canSend ? `linear-gradient(135deg, ${uiTheme.colors.accent} 0%, ${uiTheme.colors.accentDark} 100%)` : uiTheme.colors.navy700,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: canSend ? 'pointer' : 'not-allowed',
            opacity: canSend ? 1 : 0.5,
            flexShrink: 0,
            boxShadow: canSend ? '0 4px 12px rgba(37, 99, 235, 0.4)' : 'none',
          }}
          aria-label="Send message"
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
