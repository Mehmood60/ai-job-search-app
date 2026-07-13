import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, clearToken, getToken, setToken } from '../api/client';

interface AuthUser {
  id: string;
  email: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const token = ref<string | null>(getToken());

  function apply(result: { token: string; user: AuthUser }) {
    token.value = result.token;
    user.value = result.user;
    setToken(result.token);
  }

  async function register(email: string, password: string) {
    const { data } = await api.post('/auth/register', { email, password });
    apply(data);
  }

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    apply(data);
  }

  function logout() {
    user.value = null;
    token.value = null;
    clearToken();
  }

  const isAuthenticated = () => !!token.value;

  return { user, token, register, login, logout, isAuthenticated };
});
