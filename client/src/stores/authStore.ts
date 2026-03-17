import { create } from 'zustand';
import type { UserInfo } from '@simple-ui/shared';
import { apiClient } from '../api/client';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: UserInfo, token: string) => void;
  logout: () => Promise<void>;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,

  setAuth: (user, token) => {
    localStorage.setItem('auth_token', token);
    set({ user, token });
  },

  logout: async () => {
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('auth_token');
    set({ user: null, token: null });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      set({ token });
      // Verify token is still valid
      apiClient.get('/auth/me')
        .then((res) => set({ user: res.data }))
        .catch(() => {
          localStorage.removeItem('auth_token');
          set({ token: null });
        });
    }
  },
}));
