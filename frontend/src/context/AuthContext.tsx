'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  role: 'GUEST' | 'BUYER' | 'SELLER' | 'ADMIN';
  fullName?: string;
  city?: string;
  isKycVerified?: boolean;
  avatarUrl?: string;
  escrowBalanceETB?: number;
  profile?: {
    escrowBalanceETB?: number;
    fullName?: string;
    city?: string;
    phoneNumber?: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('bidora_token');
    const savedUser = localStorage.getItem('bidora_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('bidora_token');
        localStorage.removeItem('bidora_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('bidora_token', res.accessToken);
    localStorage.setItem('bidora_refresh_token', res.refreshToken);
    localStorage.setItem('bidora_user', JSON.stringify(res.user));

    setToken(res.accessToken);
    setUser(res.user);
  };

  const register = async (data: any) => {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    localStorage.setItem('bidora_token', res.accessToken);
    localStorage.setItem('bidora_refresh_token', res.refreshToken);
    localStorage.setItem('bidora_user', JSON.stringify(res.user));

    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('bidora_token');
    localStorage.removeItem('bidora_refresh_token');
    localStorage.removeItem('bidora_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
