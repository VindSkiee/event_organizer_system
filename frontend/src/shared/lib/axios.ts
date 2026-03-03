import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // <-- SANGAT PENTING: Mengizinkan pengiriman & penerimaan Cookie
});

// Interceptor Request: Dihapus! Browser otomatis mengirim HttpOnly cookie

// Interceptor Response: Tetap dipertahankan untuk menendang user jika token expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Hanya redirect jika token expired/tidak valid (401), bukan 403 (forbidden resource)
    // Skip redirect untuk endpoint login agar tidak terjadi infinite loop
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('user'); // Hapus flag login
      window.location.href = '/login'; // Tendang ke halaman login
    }
    return Promise.reject(error);
  }
);