import { ConversationList } from '../conversations/ConversationList';
import { ChatThread, ChatEmptyState } from './ChatThread';
import { useWidget } from '../../context/WidgetContext';
import { Logo } from '../ui/Logo';
import { clearSession } from '../../utils/authSession';

interface DesktopMessengerProps {
  onLogout: () => void;
}

export function DesktopMessenger({ onLogout }: DesktopMessengerProps) {
  const { state } = useWidget();
  const hasActiveChat = Boolean(state.activeConversationId);

  const handleLogout = () => {
    clearSession();
    onLogout();
  };

  return (
    <div className="qc-messenger-shell">
      <aside className="qc-messenger-sidebar">
        <div className="qc-messenger-sidebar-top">
          <div className="qc-messenger-brand">
            <Logo size={32} />
            <span>QuantumChat</span>
          </div>
          <button type="button" className="qc-messenger-logout" onClick={handleLogout} title="Sign out">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
        <ConversationList />
      </aside>

      <main className="qc-messenger-main">
        {hasActiveChat ? <ChatThread /> : <ChatEmptyState />}
      </main>
    </div>
  );
}
