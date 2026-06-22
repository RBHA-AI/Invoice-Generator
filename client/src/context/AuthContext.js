import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiJson, clearStoredToken, getStoredToken, setStoredToken } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiJson('/api/auth/me');
      setWorkspace(data.workspace);
    } catch {
      clearStoredToken();
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = async (workspaceName, password) => {
    const data = await apiJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ workspace: workspaceName, password })
    });
    setStoredToken(data.token);
    setWorkspace(data.workspace);
    return data.workspace;
  };

  const logout = () => {
    clearStoredToken();
    setWorkspace(null);
  };

  return (
    <AuthContext.Provider
      value={{
        workspace,
        loading,
        isAuthenticated: !!workspace,
        login,
        logout,
        refreshSession: loadSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
