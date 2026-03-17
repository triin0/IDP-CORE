import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient, setAuthToken } from '../lib/apiClient';
import { User, LoginData, RegisterData } from '../lib/types';
import { useState } from 'react';

async function fetchMe(): Promise<User> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No token found');
  setAuthToken(token);
  const { data } = await apiClient.get('/auth/me');
  return data;
}

async function loginUser(credentials: LoginData): Promise<{ token: string }> {
  const { data } = await apiClient.post('/auth/login', credentials);
  return data;
}

async function registerUser(credentials: RegisterData): Promise<User> {
  const { data } = await apiClient.post('/auth/register', credentials);
  return data;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<Error | null>(null);

  const { data: user, isLoading, isError } = useQuery<User, Error>({ 
    queryKey: ['me'], 
    queryFn: fetchMe,
    retry: false, // Don't retry on auth errors
  });

  const login = useMutation<{ token: string }, Error, LoginData>({
    mutationFn: loginUser,
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      setAuthToken(data.token);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
      setError(null);
    },
    onError: (err) => setError(err)
  });

  const register = useMutation<User, Error, RegisterData>({
    mutationFn: registerUser,
    onSuccess: () => {
      // Optionally log them in automatically or show a success message
      alert('Registration successful! Please log in.');
      navigate('/login');
      setError(null);
    },
    onError: (err) => setError(err)
  });

  const logout = useMutation<void, Error, void>({
    mutationFn: async () => {
        localStorage.removeItem('token');
        setAuthToken(null);
    },
    onSuccess: () => {
      queryClient.setQueryData(['me'], null); // Clear user data immediately
      navigate('/login');
    }
  });

  return { user, isLoading, isError, login, register, logout, error };
}
