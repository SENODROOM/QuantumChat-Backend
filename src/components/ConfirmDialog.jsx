/**
 * ConfirmDialog.jsx
 * 
 * A modal confirmation dialog with backdrop blur.
 * Supports 'danger' and 'default' variants for the confirm button styling.
 * Includes scale-in animation and keyboard accessibility.
 */
import { useEffect, useCallback } from 'react';

/**
 * ConfirmDialog component
 * 
 * @param {Object}   props
 * @param {boolean}  props.isOpen       - Whether the dialog is visible
 * @param {string}   props.title        - Dialog title text
 * @param {string}   props.message      - Dialog body / description text
 * @param {string}   props.confirmLabel - Text for the confirm button (default: 'Confirm')
 * @param {string}   props.cancelLabel  - Text for the cancel button (default: 'Cancel')
 * @param {function} props.onConfirm    - Callback when the user confirms
 * @param {function} props.onCancel     - Callback when the user cancels or dismisses
 * @param {string}   props.variant      - 'danger' (red confirm) or 'default' (accent confirm)
 */
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}) {
  /**
   * Close the dialog on Escape key press.
   */
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  // Bind keyboard listener and lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Don't render anything when closed
  if (!isOpen) return null;

  /**
   * Close when clicking the overlay backdrop, not the dialog itself.
   */
  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="confirm-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div className="confirm-dialog">
        {/* Dialog title */}
        <h2 id="confirm-dialog-title" className="confirm-title">
          {title}
        </h2>

        {/* Dialog message / description */}
        <p id="confirm-dialog-message" className="confirm-message">
          {message}
        </p>

        {/* Action buttons */}
        <div className="confirm-actions">
          <button
            className="confirm-btn-cancel"
            onClick={onCancel}
            type="button"
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>

          <button
            className={variant === 'danger' ? 'confirm-btn-danger' : 'confirm-btn-confirm'}
            onClick={onConfirm}
            type="button"
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
