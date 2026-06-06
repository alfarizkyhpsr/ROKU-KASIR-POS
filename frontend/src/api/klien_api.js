import axios from 'axios';

const URL_GATEWAY = import.meta.env.VITE_API_URL || '/api';

const klienApi = axios.create({
  baseURL: URL_GATEWAY,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor untuk menyisipkan Token JWT secara otomatis dari localStorage
klienApi.interceptors.request.use(
  (konfigurasi) => {
    const dataAuth = localStorage.getItem('sesi_kasir_pos');
    if (dataAuth) {
      try {
        const { token } = JSON.parse(dataAuth);
        if (token) {
          konfigurasi.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (e) {
        console.error("Gagal membaca token auth:", e);
      }
    }
    return konfigurasi;
  },
  (kesalahan) => {
    return Promise.reject(kesalahan);
  }
);

// Interceptor RESPONSE: jika token expired/invalid (401), paksa logout
klienApi.interceptors.response.use(
  (respons) => respons,
  (kesalahan) => {
    if (kesalahan.response?.status === 401) {
      // Hapus session agar app kembali ke halaman login
      localStorage.removeItem('sesi_kasir_pos');
      localStorage.removeItem('shift_aktif_pos');
      // Reload halaman agar state Zustand juga ter-reset
      window.location.reload();
    }
    return Promise.reject(kesalahan);
  }
);

export default klienApi;
