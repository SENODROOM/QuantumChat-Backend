import { useEffect, useRef, useState } from 'react';
import { fetchGoogleClientId } from '../utils/authApi';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: string;
            context?: string;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              width?: number;
              text?: string;
              shape?: string;
              logo_alignment?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  mode?: 'login' | 'register';
}

const SCRIPT_ID = 'google-gsi-client';

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')));
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });
}

export function GoogleSignInButton({ onSuccess, onError, disabled, mode = 'login' }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const [clientId, setClientId] = useState(envClientId);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unconfigured'>('loading');

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    async function resolveClientId() {
      if (envClientId) {
        if (!cancelled) setClientId(envClientId);
        return envClientId;
      }
      const fromBackend = await fetchGoogleClientId();
      if (!cancelled && fromBackend) setClientId(fromBackend);
      return fromBackend;
    }

    resolveClientId().then((id) => {
      if (cancelled) return;
      if (!id) {
        setStatus('unconfigured');
        return;
      }

      loadGoogleScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

          window.google.accounts.id.initialize({
            client_id: id,
            ux_mode: 'popup',
            context: mode === 'register' ? 'signup' : 'signin',
            callback: (response) => {
              if (response.credential) onSuccessRef.current(response.credential);
              else onErrorRef.current?.('Google sign-in was cancelled');
            },
          });

          containerRef.current.innerHTML = '';
          const width = Math.min(containerRef.current.offsetWidth || 360, 400);
          window.google.accounts.id.renderButton(containerRef.current, {
            theme: 'filled_black',
            size: 'large',
            width,
            text: 'continue_with',
            shape: 'pill',
            logo_alignment: 'left',
          });
          setStatus('ready');
        })
        .catch(() => {
          if (!cancelled) onErrorRef.current?.('Could not load Google Sign-In. Check your connection.');
        });
    });

    return () => {
      cancelled = true;
    };
  }, [envClientId, mode]);

  if (status === 'unconfigured') {
    return (
      <button type="button" className="qc-google-btn-custom qc-google-btn-custom-disabled" disabled>
        <span className="qc-google-btn-custom-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        </span>
        Continue with Google
      </button>
    );
  }

  return (
    <div className={`qc-google-btn-host ${disabled ? 'qc-google-btn-host-disabled' : ''}`}>
      {status === 'loading' && (
        <button type="button" className="qc-google-btn-custom qc-google-btn-custom-loading" disabled>
          <span className="qc-google-btn-spinner" />
          Loading Google…
        </button>
      )}
      <div
        ref={containerRef}
        className={`qc-google-btn-native ${status === 'loading' ? 'qc-google-btn-native-hidden' : ''}`}
        aria-label="Continue with Google"
      />
    </div>
  );
}
