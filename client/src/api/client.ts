import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach JWT on every request
apiClient.interceptors.request.use((req) => {
  const token = localStorage.getItem('auth_token');
  if (token && req.headers) {
    req.headers['Authorization'] = `Bearer ${token}`;
  }
  return req;
});

// Redirect to login on 401
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
