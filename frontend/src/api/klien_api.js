import axios from 'axios';

const URL_GATEWAY = 'http://localhost:5000/api';

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

export default klienApi;
