import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Download, Eye, EyeOff, FileKey2, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { downloadKeyFile, formatKeyFile } from '../crypto/keyFile.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keySet, setKeySet] = useState(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const errors = {};
    if (form.username && form.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    }
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (form.password && form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setValidationErrors(errors);
  }, [form]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const errors = {};
    if (form.username.trim().length < 3) errors.username = 'Username must be at least 3 characters.';
    if (!/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Invalid email address.';
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setTouched({ username: true, email: true, password: true, confirmPassword: true });
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        username: form.username,
        email: form.email,
        password: form.password,
      });
      setKeySet(result.keySet);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. User may already exist.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    const content = formatKeyFile({
      username: form.username,
      email: form.email,
      secretKeys: keySet.map((k) => k.secretKey),
    });
    downloadKeyFile(content);
    setDownloaded(true);
  }

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  if (keySet) {
    return (
      <div className="auth-page">
        <div className="auth-page-topbar">
          <ThemeToggle />
        </div>

        <div className="auth-card auth-card-wide keys-backup-card">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <FileKey2 size={22} strokeWidth={2} aria-hidden="true" />
            </div>
            <p className="auth-brand-name">QuantumChat</p>
            <h1>Save your encryption keys</h1>
            <p className="auth-subtitle">
              These five private keys are the only way to decrypt your chats on another device or browser.
            </p>
          </div>

          <div className="keys-warning" role="note">
            <Shield size={18} strokeWidth={2} aria-hidden="true" />
            <div>
              <strong>Keep this file safe</strong>
              <p>
                Keys are never sent to our servers. If you clear this browser without a backup, your message
                history cannot be recovered.
              </p>
            </div>
          </div>

          <div className="keys-panel">
            <div className="keys-panel-head">
              <span>Your device keyring</span>
              <span className="keys-count">{keySet.length} keys</span>
            </div>
            <ul className="keys-list" aria-label="Private keys">
              {keySet.map((k, i) => (
                <li key={i} className="keys-row">
                  <span className="keys-index">Key {i + 1}</span>
                  <code className="keys-value">{k.secretKey}</code>
                </li>
              ))}
            </ul>
          </div>

          {downloaded && (
            <div className="keys-success" role="status">
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              <span>
                Downloaded as <code>keys.txt</code> — store it somewhere secure.
              </span>
            </div>
          )}

          <div className="keys-actions">
            <button type="button" className="auth-submit" onClick={handleDownload}>
              <Download size={18} strokeWidth={2} aria-hidden="true" />
              {downloaded ? 'Download again' : 'Download keys.txt'}
            </button>
            <button
              type="button"
              className={`secondary-button ${downloaded ? 'ready' : ''}`}
              onClick={() => navigate('/chat')}
            >
              I&apos;ve saved my keys — continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSubmitDisabled = loading || Object.keys(validationErrors).length > 0;

  return (
    <div className="auth-page">
      <div className="auth-page-topbar">
        <ThemeToggle />
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <Link to="/" className="auth-brand-home" aria-label="QuantumChat home">
            <span className="auth-brand-icon">
              <Shield size={22} strokeWidth={2} aria-hidden="true" />
            </span>
          </Link>
          <p className="auth-brand-name">QuantumChat</p>
          <h1>Create your account</h1>
          <p className="auth-subtitle">We&apos;ll generate your encryption keys after signup so you can back them up.</p>
        </div>

        <div className="auth-field">
          <User className="auth-field-icon" size={16} aria-hidden="true" />
          <input
            id="register-username"
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            onBlur={() => handleBlur('username')}
            required
            minLength={3}
            autoComplete="username"
            aria-invalid={Boolean(touched.username && validationErrors.username)}
          />
        </div>
        {touched.username && validationErrors.username && (
          <p className="auth-field-error">{validationErrors.username}</p>
        )}

        <div className="auth-field">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <input
            id="register-email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => handleBlur('email')}
            required
            autoComplete="email"
            aria-invalid={Boolean(touched.email && validationErrors.email)}
          />
        </div>
        {touched.email && validationErrors.email && <p className="auth-field-error">{validationErrors.email}</p>}

        <div className="auth-field">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Password (min. 8 characters)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            onBlur={() => handleBlur('password')}
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={Boolean(touched.password && validationErrors.password)}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {touched.password && validationErrors.password && (
          <p className="auth-field-error">{validationErrors.password}</p>
        )}

        <div className="auth-field">
          <svg className="auth-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            id="register-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            onBlur={() => handleBlur('confirmPassword')}
            required
            autoComplete="new-password"
            aria-invalid={Boolean(touched.confirmPassword && validationErrors.confirmPassword)}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {touched.confirmPassword && validationErrors.confirmPassword && (
          <p className="auth-field-error">{validationErrors.confirmPassword}</p>
        )}

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-submit" disabled={isSubmitDisabled}>
          {loading ? 'Creating…' : 'Create account'}
        </button>

        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
