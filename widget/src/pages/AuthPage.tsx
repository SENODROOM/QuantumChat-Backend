import { useCallback, useEffect, useState } from 'react';
import { Logo } from '../components/ui/Logo';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { BACKEND_OFFLINE_MSG, checkBackendHealth, completeAuth, loginUser, loginWithGoogle, registerUser } from '../utils/authApi';
import type { UserSession } from '../utils/authSession';

interface AuthPageProps {
  onAuth: (session: UserSession) => void;
}

type UserMode = 'login' | 'register';

export function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<UserMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === '1') setMode('register');
  }, []);

  useEffect(() => {
    checkBackendHealth().then((ok) => {
      if (!ok) setError(BACKEND_OFFLINE_MSG);
    });
  }, []);

  const handleAuthSuccess = useCallback(
    (result: { token: string; user: UserSession['user'] }) => {
      completeAuth(result, (session) => onAuth({ token: session.token, user: session.user }));
    },
    [onAuth]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result =
        mode === 'login'
          ? await loginUser(email, password)
          : await registerUser({ email, displayName, password });
      handleAuthSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithGoogle(credential);
      handleAuthSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: UserMode) => {
    setMode(next);
    setError('');
    const url = new URL(window.location.href);
    if (next === 'register') url.searchParams.set('signup', '1');
    else url.searchParams.delete('signup');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="qc-auth-page">
      <div className="qc-auth-visual">
        <div className="qc-auth-visual-content">
          <Logo size={72} className="qc-auth-hero-logo" />
          <h2>Connect with confidence.</h2>
          <p>
            Secure messaging built for teams and professionals. Sign in or create your free account to get started.
          </p>
          <div className="qc-auth-feature-list">
            <div className="qc-auth-feature">
              <span className="qc-auth-feature-icon">🔒</span>
              <span>End-to-end secure conversations</span>
            </div>
            <div className="qc-auth-feature">
              <span className="qc-auth-feature-icon">⚡</span>
              <span>Real-time chat and notifications</span>
            </div>
            <div className="qc-auth-feature">
              <span className="qc-auth-feature-icon">👥</span>
              <span>Team messaging workspace</span>
            </div>
          </div>
        </div>
      </div>

      <div className="qc-auth-panel">
        <div className="qc-auth-panel-inner">
          <div className="qc-auth-mobile-logo">
            <Logo size={40} />
            <span>QuantumChat</span>
          </div>

          <div className="qc-auth-card">
            <div className="qc-auth-mode-pills">
              <button
                type="button"
                className={`qc-auth-pill ${mode === 'login' ? 'qc-auth-pill-active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`qc-auth-pill ${mode === 'register' ? 'qc-auth-pill-active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Create Account
              </button>
            </div>

            <h1 className="qc-auth-form-title">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="qc-auth-form-sub">
              {mode === 'login'
                ? 'Sign in to access your secure messaging workspace.'
                : 'Join QuantumChat in seconds — email or Google.'}
            </p>

            {error && <div className="qc-auth-error">{error}</div>}

            <div className="qc-auth-google-wrap">
              <GoogleSignInButton
                mode={mode}
                onSuccess={handleGoogleSuccess}
                onError={(msg) => setError(msg)}
                disabled={loading}
              />
            </div>

            <div className="qc-auth-divider">
              <span>or continue with email</span>
            </div>

            <form onSubmit={handleSubmit} className="qc-auth-form">
              {mode === 'register' && (
                <div className="qc-auth-field">
                  <label className="qc-auth-label" htmlFor="displayName">
                    Full name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name"
                    className="qc-auth-input"
                    required
                  />
                </div>
              )}

              <div className="qc-auth-field">
                <label className="qc-auth-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="qc-auth-input"
                  required
                />
              </div>

              <div className="qc-auth-field">
                <label className="qc-auth-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Enter your password' : 'Create a password (min. 6 characters)'}
                  className="qc-auth-input"
                  minLength={6}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="qc-auth-submit">
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="qc-auth-footer">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button type="button" className="qc-auth-link-btn" onClick={() => switchMode('register')}>
                    Create account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button type="button" className="qc-auth-link-btn" onClick={() => switchMode('login')}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
