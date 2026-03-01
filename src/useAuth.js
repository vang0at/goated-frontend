// ═══════════════════════════════════════════════════════════
// GOATED.RUN - Auth Hook (Privy)
// Wrap your app in PrivyProvider, then use this hook
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import api from './api';

// Privy config for your _app.js or main wrapper
export const PRIVY_CONFIG = {
  appId: process.env.REACT_APP_PRIVY_APP_ID || 'YOUR_PRIVY_APP_ID',
  loginMethods: ['twitter', 'wallet', 'google', 'email'],
  appearance: {
    theme: 'dark',
    accentColor: '#00ff88',
    logo: 'https://goated.run/logo.png',
    showWalletLoginFirst: false,
  },
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
  },
};

// Hook that bridges Privy auth with our backend
export function useGoatedAuth(privyHook) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // privyHook = usePrivy() from @privy-io/react-auth
  const { ready, authenticated, user: privyUser, login, logout, getAccessToken } = privyHook || {};

  const syncUser = useCallback(async () => {
    if (!authenticated || !privyUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      // Get Privy access token
      const token = await getAccessToken();
      if (!token) throw new Error('No auth token');

      // Set on API client
      api.setToken(token);

      // Fetch or create our user via backend
      const { profile, poolStakes, recentTransactions, activeHandshakes } = await api.getMe();

      setUser({
        ...profile,
        poolStakes,
        recentTransactions,
        activeHandshakes,
        privyUser,
      });

      setError(null);
    } catch (err) {
      console.error('Auth sync failed:', err);
      setError(err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [authenticated, privyUser, getAccessToken]);

  useEffect(() => {
    if (ready) syncUser();
  }, [ready, authenticated, syncUser]);

  const handleLogin = useCallback(() => {
    if (login) login();
  }, [login]);

  const handleLogout = useCallback(async () => {
    if (logout) await logout();
    api.clearToken();
    setUser(null);
  }, [logout]);

  const refreshUser = useCallback(async () => {
    await syncUser();
  }, [syncUser]);

  return {
    user,
    loading,
    error,
    login: handleLogin,
    logout: handleLogout,
    refreshUser,
    isAuthenticated: !!user,
  };
}
