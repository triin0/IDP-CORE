import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { authApi } from '../lib/api';
import type { User } from '../../../../server/src/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (userData: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          // In a real app, you'd have a /profile endpoint to verify the token and get user data
          // For now, we'll decode it or fetch from a mock source if needed.
          // This app doesn't have a /profile endpoint, so we'll just assume the token is valid
          // and maybe store user data in localStorage too upon login.
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        } catch (error) {
          console.error('Failed to load user', error);
          setToken(null);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
        }
      } 
      setIsLoading(false);
    };
    loadUser();
  }, [token]);

  const login = async (credentials: { email: string; password: string }) => {
    const { token, user } = await authApi.login(credentials);
    setToken(token);
    setUser(user);
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const register = async (userData: { name: string; email: string; password: string }) => {
    const { token, user } = await authApi.register(userData);
    setToken(token);
    setUser(user);
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
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
