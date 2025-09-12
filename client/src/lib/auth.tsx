import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';

interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  storeId?: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  // Check if user is already authenticated
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest('POST', '/api/login', data);
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['/api/user'], user);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest('POST', '/api/register', data);
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['/api/user'], user);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/logout');
      return res.ok;
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/user'], null);
      queryClient.clear();
    },
  });

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const register = async (data: RegisterData) => {
    await registerMutation.mutateAsync(data);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const isAuthenticated = !!user && !isLoading && !error;

  return (
    <AuthContext.Provider
      value={{
        user: (user as User) || null,
        isLoading,
        login,
        register,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}