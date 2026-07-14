import { useState, useMemo } from 'react';
import AttachmentBubble from './AttachmentBubble.jsx';
import ImageLightbox from './ImageLightbox.jsx';

// Relative timestamp formatting
function formatRelativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Read receipt checkmark SVGs
function ReadReceipt({ status }) {
  if (!status) return null;

  // Single check for sent
  if (status === 'sent') {
    return (
      <span className="read-receipt sent" title="Sent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }

  // Double check for delivered / read
  return (
    <span className={`read-receipt ${status}`} title={status === 'read' ? 'Read' : 'Delivered'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 6 7 17 2 12" />
        <polyline points="24 6 13 17 10 14" />
      </svg>
    </span>
  );
}

export default function MessageBubble({ message, isMine, resolveAttachmentKey, grouped }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // Determine read receipt status for own messages
  const receiptStatus = useMemo(() => {
    if (!isMine) return null;
    if (message.readAt) return 'read';
    if (message.deliveredAt) return 'delivered';
    return 'sent';
  }, [isMine, message.readAt, message.deliveredAt]);

  const relativeTime = useMemo(() => formatRelativeTime(message.createdAt), [message.createdAt]);
  const fullTime = useMemo(() => new Date(message.createdAt).toLocaleString(), [message.createdAt]);

  // Handle empty text for attachment-only messages
  const hasTextContent = message.text && message.text.length > 0;
  const isDecryptionFail = message.text === null;

  return (
    <>
      <div className={`message-row ${isMine ? 'mine' : 'theirs'} ${grouped ? 'grouped' : ''}`}>
        <div className={`message-bubble ${isMine ? 'mine' : 'theirs'} ${grouped ? 'grouped' : ''}`}>
          {message.attachment && (
            <AttachmentBubble
              attachment={message.attachment}
              isMine={isMine}
              resolveAttachmentKey={resolveAttachmentKey}
              onImagePreview={setLightboxSrc}
            />
          )}
          {hasTextContent ? message.text : isDecryptionFail ? <em>[Unable to decrypt message]</em> : null}
          <div className="message-time" title={fullTime}>
            {relativeTime}
            {isMine && <ReadReceipt status={receiptStatus} />}
          </div>
        </div>
      </div>
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={message.attachment?.filename || 'Image preview'}
          isOpen={true}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}
