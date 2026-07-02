import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthPage } from './pages/AuthPage';
import { AppShell } from './pages/AppShell';
import { fetchCurrentUser, isAdminUser, redirectAdminSession } from './utils/authApi';
import { loadSession, saveSession, clearSession, type UserSession } from './utils/authSession';
import './styles.css';

function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = loadSession();
    if (!stored?.token) {
      setChecking(false);
      return;
    }

    fetchCurrentUser(stored.token)
      .then((user) => {
        if (isAdminUser(user)) {
          redirectAdminSession(stored.token);
          return;
        }
        const updated = { token: stored.token, user };
        saveSession(updated);
        setSession(updated);
      })
      .catch(() => clearSession())
      .finally(() => setChecking(false));
  }, []);

  const handleAuth = (newSession: UserSession) => {
    saveSession(newSession);
    setSession(newSession);
  };

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050D1A',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '2px solid #3B82F6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!session) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <AppShell session={session} onLogout={() => setSession(null)} />
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
