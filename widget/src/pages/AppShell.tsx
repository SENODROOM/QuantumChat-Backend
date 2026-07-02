import { WidgetContext } from '../context/WidgetContext';
import { DesktopMessenger } from '../components/layout/DesktopMessenger';
import { useMessengerBootstrap } from '../hooks/useMessengerBootstrap';
import { theme } from '../theme';
import type { UserSession } from '../utils/authSession';

interface AppShellProps {
  session: UserSession;
  onLogout: () => void;
}

export function AppShell({ session, onLogout }: AppShellProps) {
  const messenger = useMessengerBootstrap(session);

  if (messenger.loading) {
    return (
      <div className="qc-messenger-loading">
        <div className="qc-spinner" />
        <p>Connecting to your workspace…</p>
      </div>
    );
  }

  if (messenger.error || !messenger.socket) {
    return (
      <div className="qc-messenger-loading">
        <p style={{ color: theme.colors.error, maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
          {messenger.error || 'Could not connect'}
        </p>
        <button type="button" className="qc-auth-submit" style={{ maxWidth: 200 }} onClick={onLogout}>
          Back to sign in
        </button>
      </div>
    );
  }

  const contextValue = {
    state: messenger.state,
    dispatch: messenger.dispatch,
    config: messenger.config,
    api: messenger.api,
    socket: messenger.socket,
    theme: messenger.theme,
  };

  return (
    <WidgetContext.Provider value={contextValue}>
      <DesktopMessenger onLogout={onLogout} />
    </WidgetContext.Provider>
  );
}
