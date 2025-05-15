// src/contexts/AuthContext.tsx
"use client";

import type { RegisteredUser } from "@/types/user";
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useRouter, usePathname } // Added usePathname
from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  isAuthenticated: boolean;
  user: RegisteredUser | null;
  login: (email: string, password?: string) => Promise<boolean>; // Password optional for potential future auth methods
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'cyberric_auth_user';

declare global {
  interface Window {
    electronAPI?: {
      loginUserElectron: (credentials: { email: string; password?: string }) => Promise<{ success: boolean; user?: Omit<RegisteredUser, 'password'>; error?: string }>;
    };
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<RegisteredUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const router = useRouter();
  const pathname = usePathname(); // Get current path
  const { toast } = useToast();

  useEffect(() => {
    // Check localStorage for existing session on initial load
    setIsLoading(true);
    try {
      const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
      localStorage.removeItem(AUTH_STORAGE_KEY); // Clear potentially corrupted data
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password?: string) => {
    if (!window.electronAPI?.loginUserElectron) {
      toast({ variant: "destructive", title: "Erro de Configuração", description: "API do Electron não está disponível para login." });
      return false;
    }
    setIsLoading(true);
    try {
      const result = await window.electronAPI.loginUserElectron({ email, password: password || '' });
      if (result.success && result.user) {
        const userData = result.user as RegisteredUser; // Cast, password should already be omitted by main process
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
        setIsLoading(false);
        return true;
      } else {
        toast({ variant: "destructive", title: "Falha no Login", description: result.error || "Credenciais inválidas." });
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error("Erro durante o login (AuthContext):", error);
      toast({ variant: "destructive", title: "Erro de Login", description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido." });
      setIsLoading(false);
      return false;
    }
  }, [toast]);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    router.push('/login'); // Redirect to login after logout
  }, [router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
