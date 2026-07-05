import { useReducer, useEffect, useRef, useMemo, useState, useCallback } from 'react';
import type { WidgetConfig, IUser } from '@quantum-chat/shared';
import { WidgetContext } from './context/WidgetContext';
import { chatReducer, initialState } from './context/types';
import { ApiClient } from './api';
import { SocketClient } from './socket';
import { Launcher } from './components/Launcher';
import { ChatWindow } from './components/ChatWindow';
import { Logo } from './components/ui/Logo';
import { Avatar } from './components/ui/Avatar';
import { requestNotificationPermission, showNotification } from './utils/notifications';
import { normalizeId } from './utils/helpers';
import { processIncomingMessage, E2E_PREVIEW } from './utils/messageCrypto';
import { applyBrandingStyles, mergeBranding, mergeSettings } from './utils/branding';
import { getCachedWebsiteConfig } from './utils/siteConfigCache';
import { useSdkBridge, notifyWidgetReady, notifyUnreadCount } from './hooks/useSdkBridge';
import { theme, resolveTheme } from './theme';
import './styles.css';

const positionClasses: Record<string, string> = {
  'bottom-right': 'bottom-24 right-6',
  'bottom-left': 'bottom-24 left-6',
  'top-right': 'top-24 right-6',
  'top-left': 'top-24 left-6',
};

interface QuantumChatWidgetProps {
  config: WidgetConfig;
}

export function QuantumChatWidget({ config }: QuantumChatWidgetProps) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [socket, setSocket] = useState<SocketClient | null>(null);
  const socketRef = useRef<SocketClient | null>(null);
  const initInFlightRef = useRef(false);
  const widgetRootRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const configRef = useRef(config);
  configRef.current = config;

  const apiUrl = config.apiUrl || 'http://localhost:4000';

  const api = useMemo(
    () => new ApiClient(apiUrl, config.apiKey, null),
    [apiUrl, config.apiKey]
  );
  const apiRef = useRef(api);
  apiRef.current = api;

  const tokenStorageKey = `qc_token_${config.apiKey}_${config.user?.email || 'guest'}`;

  const getIsOpen = useCallback(() => stateRef.current.isOpen, []);

  useSdkBridge({
    dispatch,
    api,
    socketRef,
    apiUrl,
    configRef,
    getIsOpen,
    onReady: config.onReady,
    onUnreadCount: config.onUnreadCount,
    tokenStorageKey,
  });

  useEffect(() => {
    const root = widgetRootRef.current;
    if (root && state.branding) applyBrandingStyles(root, state.branding);
  }, [state.branding]);

  useEffect(() => {
    let active = true;
    requestNotificationPermission();

    const storageKey = `qc_token_${configRef.current.apiKey}_${configRef.current.user?.email || 'guest'}`;

    const init = async () => {
      if (initInFlightRef.current) return;
      initInFlightRef.current = true;

      const cfg = configRef.current;
      setIsInitializing(true);
      setInitError(null);

      if (!cfg.apiKey) {
        setInitError('Missing API key. Set VITE_API_KEY in frontend/widget/.env');
        setIsInitializing(false);
        initInFlightRef.current = false;
        return;
      }

      try {
        const client = apiRef.current;
        let websiteName = 'Quantum Chat';
        let branding = mergeBranding(cfg.theme);
        let settings = mergeSettings();

        let token = cfg.token || sessionStorage.getItem(storageKey) || undefined;
        let user: IUser | undefined = cfg.user as IUser | undefined;

        if (!token && cfg.user) {
          const auth = await client.widgetAuth({
            email: cfg.user.email || `user-${cfg.user.externalId}@widget.local`,
            displayName: cfg.user.displayName || 'Guest User',
            externalId: cfg.user.externalId,
            avatarUrl: cfg.user.avatarUrl,
          });
          if (!active) return;
          token = auth.token;
          user = auth.user;
          websiteName = auth.website.name;
          branding = mergeBranding(auth.website.branding, cfg.theme);
          settings = mergeSettings(auth.website.settings);
          client.setToken(token);
          sessionStorage.setItem(storageKey, token);

          if (cfg.websiteId && auth.user.websiteId !== cfg.websiteId) {
            throw new Error('websiteId does not match API key');
          }
        } else {
          const websiteConfig = await getCachedWebsiteConfig(client, cfg.apiKey);
          if (!active) return;

          if (cfg.websiteId && websiteConfig.websiteId !== cfg.websiteId) {
            throw new Error('websiteId does not match API key');
          }

          websiteName = websiteConfig.name;
          branding = mergeBranding(websiteConfig.branding, cfg.theme);
          settings = mergeSettings(websiteConfig.settings);

          if (token) {
            client.setToken(token);
            if (!user) {
              user = await client.getMe();
              if (!active) return;
            }
          }
        }

        if (!token || !user) {
          setInitError('Authentication required — provide config.user or a valid config.token (QC JWT).');
          return;
        }

        dispatch({
          type: 'SET_AUTH',
          payload: {
            token,
            user,
            branding,
            settings,
            websiteName: cfg.brandName || websiteName,
          },
        });

        const socketClient = new SocketClient();
        socketRef.current = socketClient;
        setSocket(socketClient);

        socketClient.connect(apiUrl, token, {
          onMessage: async (msg) => {
            const processed = await processIncomingMessage(msg);
            if (!processed) return;
            dispatch({ type: 'ADD_MESSAGE', payload: processed });
            const senderId = typeof msg.senderId === 'object' ? normalizeId(msg.senderId) : String(msg.senderId);
            if (senderId !== normalizeId(user?._id)) {
              showNotification('New message', processed.content || E2E_PREVIEW, () =>
                dispatch({ type: 'SET_OPEN', payload: true })
              );
              cfg.onMessage?.(processed);
            }
          },
          onMessageEdited: async (msg) => {
            const processed = await processIncomingMessage(msg);
            if (processed) dispatch({ type: 'UPDATE_MESSAGE', payload: processed });
          },
          onMessageDeleted: (data) => dispatch({ type: 'DELETE_MESSAGE', payload: data }),
          onMessageReacted: (msg) => dispatch({ type: 'UPDATE_MESSAGE', payload: msg }),
          onTyping: (data) => dispatch({ type: 'SET_TYPING', payload: data }),
          onPresence: (data) => dispatch({ type: 'SET_PRESENCE', payload: data }),
          onUnreadCount: (count) => {
            dispatch({ type: 'SET_UNREAD', payload: count });
            cfg.onUnreadCount?.(count);
            notifyUnreadCount(count);
          },
          onConversationUpdated: async () => {
            const convs = await client.getConversations();
            dispatch({ type: 'SET_CONVERSATIONS', payload: convs.data });
          },
        });

        const [convs, unread] = await Promise.all([
          client.getConversations(),
          client.getUnreadCount(),
        ]);
        if (!active) return;

        dispatch({ type: 'SET_CONVERSATIONS', payload: convs.data });
        dispatch({ type: 'SET_UNREAD', payload: unread.count });

        // Auto-open only for embedded dev preview without login token
        if (import.meta.env.DEV && !cfg.token && cfg.user) {
          dispatch({ type: 'SET_OPEN', payload: true });
        }

        cfg.onReady?.();
        notifyWidgetReady();
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Failed to connect';
        console.error('[QuantumChat] Init failed:', err);
        const isRateLimited = message.toLowerCase().includes('too many');
        const isNetworkError = message.toLowerCase().includes('fetch');
        setInitError(
          isRateLimited
            ? `${message} Clear site data or wait ~15 min, then click Retry.`
            : isNetworkError
              ? `${message}. Is the backend running at ${apiUrl}?`
              : message
        );
      } finally {
        if (active) setIsInitializing(false);
        initInFlightRef.current = false;
      }
    };

    init();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [apiUrl, config.apiKey, retryKey]);

  const position = state.branding.position || config.theme?.position || 'bottom-right';
  const uiTheme = useMemo(() => resolveTheme(state.branding), [state.branding]);

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      config,
      api,
      socket,
      theme: uiTheme,
    }),
    [state, dispatch, config, api, socket, uiTheme]
  );

  if (isInitializing) {
    return (
      <div
        className="qc-widget"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 99999,
          background: theme.colors.navy800,
          borderRadius: 16,
          padding: '14px 20px',
          boxShadow: theme.shadow.widget,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            border: `2px solid ${theme.colors.accent}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        Connecting...
      </div>
    );
  }

  if (initError) {
    return (
      <div
        className="qc-widget"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 99999,
          maxWidth: 340,
          background: theme.colors.navy800,
          border: `1px solid rgba(248, 113, 113, 0.3)`,
          borderRadius: 16,
          padding: 18,
          fontSize: 13,
          color: theme.colors.text,
          boxShadow: theme.shadow.widget,
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 6, color: theme.colors.error }}>Connection failed</p>
        <p style={{ marginBottom: 14, color: theme.colors.textSecondary, lineHeight: 1.5 }}>{initError}</p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(`qc_token_${config.apiKey}_${config.user?.email || 'guest'}`);
            sessionStorage.removeItem(`qc_site_${config.apiKey}`);
            setRetryKey((k) => k + 1);
          }}
          style={{
            background: `linear-gradient(135deg, ${theme.colors.accent} 0%, ${theme.colors.accentDark} 100%)`,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!state.isAuthenticated) return null;

  return (
    <WidgetContext.Provider value={contextValue}>
      <div className="qc-widget" ref={widgetRootRef}>
        {state.isOpen && (
          <div
            className={`fixed ${positionClasses[position]} z-[99998] w-[400px] sm:w-[420px] h-[640px] max-h-[85vh] overflow-hidden qc-animate-in`}
            style={{
              background: uiTheme.colors.navy900,
              borderRadius: uiTheme.radius.widget,
              boxShadow: uiTheme.shadow.widget,
              border: `1px solid ${uiTheme.colors.border}`,
            }}
          >
            <div
              className="qc-header-gradient"
              style={{
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Logo
                  size={36}
                  logoUrl={state.branding.logoUrl}
                  alt={state.websiteName}
                  style={{ boxShadow: `0 4px 16px ${uiTheme.colors.accentGlow}` }}
                />
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: uiTheme.colors.text, letterSpacing: '-0.02em' }}>
                    {config.brandName || state.websiteName}
                  </span>
                  <p style={{ margin: 0, fontSize: 11, color: uiTheme.colors.textMuted }}>
                    {state.branding.welcomeMessage || 'Secure messaging'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {state.user && (
                  <div
                    title={state.user.displayName}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', borderRadius: 24, background: 'rgba(255,255,255,0.06)' }}
                  >
                    <Avatar name={state.user.displayName} src={state.user.avatarUrl} size="sm" isOnline />
                    <span style={{ fontSize: 12, fontWeight: 600, color: uiTheme.colors.text, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {state.user.displayName.split(' ')[0]}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_OPEN', payload: false })}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: uiTheme.colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: 20,
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Close chat"
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ height: 'calc(100% - 68px)' }}>
              <ChatWindow />
            </div>
          </div>
        )}
        <Launcher />
      </div>
    </WidgetContext.Provider>
  );
}

export default QuantumChatWidget;
