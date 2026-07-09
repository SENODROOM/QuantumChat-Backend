import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { formatKeyFile, downloadKeyFile } from '../crypto/keyFile.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keySet, setKeySet] = useState(null); // set once registration succeeds; presence = "show save-keys step"
  const [downloaded, setDownloaded] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await register(form);
      setKeySet(result.keySet);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    const content = formatKeyFile({ username: form.username, email: form.email, secretKeys: keySet.map((k) => k.secretKey) });
    downloadKeyFile(content);
    setDownloaded(true);
  }

  if (keySet) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Save your private keys</h1>
          <p className="auth-subtitle">
            These 5 keys are the only way to read your messages on another device or browser. We don't store
            them and can't recover them for you — if you lose them and clear this browser's storage, your
            message history is gone for good.
          </p>
          <div className="key-list">
            {keySet.map((k, i) => (
              <code key={i} className="key-list-item">
                {k.secretKey}
              </code>
            ))}
          </div>
          {downloaded && <p className="key-saved-note">Saved as keys.txt — keep it somewhere safe.</p>}
          <button type="button" onClick={handleDownload}>
            Download keys.txt
          </button>
          <button type="button" className="secondary-button" onClick={() => navigate('/chat')}>
            Continue to chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create account</h1>
        <p className="auth-subtitle">
          A pool of 5 X25519 keypairs is generated on your device. The private keys stay only in this
          browser's local storage — we never see them. You'll be able to save a backup on the next screen.
        </p>
        <input
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
          minLength={3}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={8}
        />
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
