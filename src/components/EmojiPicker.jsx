/**
 * EmojiPicker.jsx
 * 
 * A lightweight floating emoji picker panel with categorized emojis.
 * Supports click-outside detection to auto-close and provides
 * a grid layout for easy emoji selection.
 * 
 * Categories: Smileys, Gestures, Hearts, Objects
 */
import { useRef, useEffect, useCallback } from 'react';

/** Emoji categories with their labels and emoji lists */
const EMOJI_CATEGORIES = [
  {
    label: 'Smileys',
    emojis: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '🤔', '😤', '😭'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🫡', '🫶'],
  },
  {
    label: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💗', '💝'],
  },
  {
    label: 'Objects',
    emojis: ['🔥', '⭐', '🎉', '🎯', '💡', '🚀', '✅', '❌', '💬', '🔒'],
  },
];

/**
 * EmojiPicker component
 * 
 * @param {Object} props
 * @param {function} props.onSelect  - Callback invoked with the selected emoji string
 * @param {boolean}  props.isOpen    - Whether the picker panel is visible
 * @param {function} props.onClose   - Callback to close the picker
 */
function EmojiPicker({ onSelect, isOpen, onClose }) {
  const panelRef = useRef(null);

  /**
   * Handle emoji button click — notify parent and close the picker.
   */
  const handleEmojiClick = useCallback(
    (emoji) => {
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose]
  );

  /**
   * Detect clicks outside the picker panel and close it.
   */
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    }

    // Use mousedown so the click is caught before focus shifts
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Don't render anything when closed
  if (!isOpen) return null;

  return (
    <div className="emoji-picker" ref={panelRef} role="dialog" aria-label="Emoji picker">
      {EMOJI_CATEGORIES.map((category) => (
        <div key={category.label} className="emoji-picker-category">
          {/* Category heading */}
          <span className="emoji-picker-category-label">{category.label}</span>

          {/* Emoji grid */}
          <div className="emoji-picker-grid" role="group" aria-label={`${category.label} emojis`}>
            {category.emojis.map((emoji) => (
              <button
                key={emoji}
                className="emoji-picker-btn"
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                aria-label={`Select ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default EmojiPicker;
