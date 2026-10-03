import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { authApi, TOKEN_KEY, UNAUTHORIZED_EVENT } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  /** Role of the signed-in account; null when signed out. Always comes from the backend. */
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: string, extra_info?: string) => Promise<User>;
  logout: () => void;
  updateUserConsent: (consent: boolean) => Promise<void>;
  updateProfile: (data: { name?: string; password?: string; department?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const homePathForRole = (role: UserRole | null | undefined): string => {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  if (role === 'student') return '/student';
  return '/login';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(!!localStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('learnpulse_role');
  }, []);

  // Restore the session from a stored token by asking the backend who it belongs to
  useEffect(() => {
    let cancelled = false;
    const initAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      if (user) return;
      setIsLoading(true);
      try {
        const userData = await authApi.getMe();
        if (!cancelled) setUser(userData);
      } catch (error) {
        console.error("Token verification failed, clearing session:", error);
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initAuth();
    return () => {
      cancelled = true;
    };
  }, [token, user, logout]);

  // Any 401 from the API means the token expired or was revoked
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const startSession = (accessToken: string, sessionUser: User) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setUser(sessionUser);
    setToken(accessToken);
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    startSession(res.access_token, res.user);
    return res.user;
  };

  const register = async (name: string, email: string, password: string, roleChoice: string, extra_info?: string) => {
    const res = await authApi.register(name, email, password, roleChoice, extra_info);
    startSession(res.access_token, res.user);
    return res.user;
  };

  const updateUserConsent = async (consent: boolean) => {
    if (user) {
      const updated = await authApi.updateMe({ camera_consent: consent });
      setUser(updated);
    }
  };

  const updateProfile = async (data: { name?: string; password?: string; department?: string }) => {
    const updated = await authApi.updateMe(data);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role ?? null,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUserConsent,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
