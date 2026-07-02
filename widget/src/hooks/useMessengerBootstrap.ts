import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { WidgetConfig } from '@quantum-chat/shared';
import { ApiClient } from '../api';
import { SocketClient } from '../socket';
import { chatReducer, initialState } from '../context/types';
import { mergeBranding, mergeSettings } from '../utils/branding';
import { getCachedWebsiteConfig } from '../utils/siteConfigCache';
import { normalizeId } from '../utils/helpers';
import { showNotification, requestNotificationPermission } from '../utils/notifications';
import { resolveTheme } from '../theme';
import type { UserSession } from '../utils/authSession';

export function useMessengerBootstrap(session: UserSession) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [socket, setSocket] = useState<SocketClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<SocketClient | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const apiKey = import.meta.env.VITE_API_KEY || '';
  const websiteId = import.meta.env.VITE_WEBSITE_ID || '';

  const config: WidgetConfig = useMemo(
    () => ({
      websiteId,
      apiKey,
      apiUrl,
      token: session.token,
      brandName: 'QuantumChat',
      theme: { welcomeMessage: 'Secure professional messaging' },
    }),
    [session.token, apiKey, apiUrl, websiteId]
  );

  const api = useMemo(() => new ApiClient(apiUrl, apiKey, session.token), [apiUrl, apiKey, session.token]);

  const uiTheme = useMemo(() => resolveTheme(state.branding), [state.branding]);

  useEffect(() => {
    let active = true;
    requestNotificationPermission();

    const run = async () => {
      setLoading(true);
      setError(null);

      if (!apiKey) {
        setError('Missing API key in widget/.env');
        setLoading(false);
        return;
      }

      try {
        const client = api;
        const websiteConfig = await getCachedWebsiteConfig(client, apiKey);
        if (!active) return;

        if (websiteId && websiteConfig.websiteId !== websiteId) {
          throw new Error('websiteId does not match API key');
        }

        const branding = mergeBranding(websiteConfig.branding, config.theme);
        const settings = mergeSettings(websiteConfig.settings);
        const user = session.user;

        dispatch({
          type: 'SET_AUTH',
          payload: {
            token: session.token,
            user,
            branding,
            settings,
            websiteName: config.brandName || websiteConfig.name,
          },
        });

        const socketClient = new SocketClient();
        socketRef.current = socketClient;
        setSocket(socketClient);

        socketClient.connect(apiUrl, session.token, {
          onMessage: (msg) => {
            dispatch({ type: 'ADD_MESSAGE', payload: msg });
            const senderId = typeof msg.senderId === 'object' ? normalizeId(msg.senderId) : String(msg.senderId);
            if (senderId !== normalizeId(user._id)) {
              showNotification('New message', msg.content);
            }
          },
          onMessageEdited: (msg) => dispatch({ type: 'UPDATE_MESSAGE', payload: msg }),
          onMessageDeleted: (data) => dispatch({ type: 'DELETE_MESSAGE', payload: data }),
          onMessageReacted: (msg) => dispatch({ type: 'UPDATE_MESSAGE', payload: msg }),
          onTyping: (data) => dispatch({ type: 'SET_TYPING', payload: data }),
          onPresence: (data) => dispatch({ type: 'SET_PRESENCE', payload: data }),
          onUnreadCount: (count) => dispatch({ type: 'SET_UNREAD', payload: count }),
          onConversationUpdated: async () => {
            const convs = await client.getConversations();
            dispatch({ type: 'SET_CONVERSATIONS', payload: convs.data });
          },
        });

        const [convs, unread] = await Promise.all([client.getConversations(), client.getUnreadCount()]);
        if (!active) return;

        dispatch({ type: 'SET_CONVERSATIONS', payload: convs.data });
        dispatch({ type: 'SET_UNREAD', payload: unread.count });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        if (active) setLoading(false);
      }
    };

    run();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [api, apiKey, apiUrl, config.brandName, config.theme, session.token, session.user, websiteId]);

  return { state, dispatch, api, socket, config, theme: uiTheme, loading, error };
}
