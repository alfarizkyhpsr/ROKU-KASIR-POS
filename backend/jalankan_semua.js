require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');
const http    = require('http');
const https   = require('https');
const net     = require('net');
const path    = require('path');
const fs      = require('fs');

/**
 * Tunggu sampai sebuah port TCP bisa diterima koneksi.
 * Dicoba setiap 300ms sampai timeout (default 20 detik).
 */
function tungguPort(port, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const mulai = Date.now();
    function coba() {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on('connect', () => { socket.destroy(); resolve(); });
      socket.on('timeout', () => { socket.destroy(); ulangi(); });
      socket.on('error', () => { socket.destroy(); ulangi(); });
      socket.connect(port, '127.0.0.1');
    }
    function ulangi() {
      if (Date.now() - mulai > timeout) {
        return reject(new Error(`Layanan di port ${port} tidak merespons dalam ${timeout / 1000}s`));
      }
      setTimeout(coba, 300);
    }
    coba();
  });
}

const PORT          = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// URL layanan — pakai env var di GCP, fallback localhost untuk dev
const AUTH_URL      = process.env.AUTH_SERVICE_URL      || 'http://localhost:5001';
const TRANSAKSI_URL = process.env.TRANSAKSI_SERVICE_URL || 'http://localhost:5002';

// Di lingkungan dev: spawn child processes lalu tunggu sampai keduanya siap
let svcAuth, svcTransaksi;

if (!IS_PRODUCTION) {
  const { spawn } = require('child_process');

  const authPath      = path.join(__dirname, 'layanan-auth', 'layanan_auth.js');
  const transaksiPath = path.join(__dirname, 'layanan-transaksi', 'layanan_transaksi.js');

  console.log('[Gateway] Menjalankan Layanan Autentikasi (port 5001)...');
  svcAuth = spawn('node', [authPath], { stdio: 'inherit' });

  console.log('[Gateway] Menjalankan Layanan Transaksi (port 5002)...');
  svcTransaksi = spawn('node', [transaksiPath], { stdio: 'inherit' });

  svcAuth.on('error', (e) => console.error('[Gateway] Gagal spawn layanan-auth:', e.message));
  svcTransaksi.on('error', (e) => console.error('[Gateway] Gagal spawn layanan-transaksi:', e.message));

  const matikanLayanan = () => {
    if (svcAuth)      svcAuth.kill();
    if (svcTransaksi) svcTransaksi.kill();
  };
  process.on('exit',   matikanLayanan);
  process.on('SIGINT',  () => { matikanLayanan(); process.exit(0); });
  process.on('SIGTERM', () => { matikanLayanan(); process.exit(0); });
}

// ─── API GATEWAY ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
// FIX: Naikkan limit agar gambar base64 (~1MB file → ~1.37MB base64) bisa melewati gateway
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

/**
 * Teruskan permintaan ke layanan backend.
 * Mendukung HTTP dan HTTPS (Cloud Run selalu HTTPS).
 */
function teruskanPermintaan(targetBaseUrl, req, res) {
  let bodyData = null;
  if (req.body && Object.keys(req.body).length > 0) {
    bodyData = JSON.stringify(req.body);
  }

  try {
    const targetUrl = new URL(targetBaseUrl + req.originalUrl);
    const isHttps   = targetUrl.protocol === 'https:';
    const client    = isHttps ? https : http;

    const options = {
      hostname: targetUrl.hostname,
      port:     targetUrl.port || (isHttps ? 443 : 80),
      path:     targetUrl.pathname + (targetUrl.search || ''),
      method:   req.method,
      headers:  { ...req.headers, host: targetUrl.hostname }
    };

    if (bodyData) {
      options.headers['Content-Type'] = 'application/json';
      // FIX: Gunakan Buffer.from().length bukan Buffer.byteLength(string) langsung
      // agar Content-Length akurat untuk body besar (gambar base64),
      // sehingga header Authorization tidak terpotong saat diteruskan ke layanan
      const bodyBuffer = Buffer.from(bodyData, 'utf8');
      options.headers['Content-Length'] = bodyBuffer.length;
    }

    const proxyReq = client.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (e) => {
      console.error(`Gateway error → ${targetBaseUrl}: ${e.message}`);
      if (!res.headersSent) {
        res.status(502).json({ sukses: false, pesan: 'Kesalahan koneksi ke layanan backend.' });
      }
    });

    if (bodyData) proxyReq.write(bodyData);
    proxyReq.end();
  } catch (e) {
    console.error('Gateway URL error:', e.message);
    res.status(500).json({ sukses: false, pesan: 'Konfigurasi URL gateway tidak valid.' });
  }
}

// ─── Routing Gateway ─────────────────────────────────────────────────────────
app.all('/api/auth*',   (req, res) => teruskanPermintaan(AUTH_URL,      req, res));
app.all('/api/cabang*', (req, res) => teruskanPermintaan(AUTH_URL,      req, res));
app.all('/api/kasir*',  (req, res) => teruskanPermintaan(AUTH_URL,      req, res));
app.all('/api/log*',    (req, res) => teruskanPermintaan(AUTH_URL,      req, res));

app.all('/api/barang*',    (req, res) => teruskanPermintaan(TRANSAKSI_URL, req, res));
app.all('/api/transaksi*', (req, res) => teruskanPermintaan(TRANSAKSI_URL, req, res));
app.all('/api/shift*',     (req, res) => teruskanPermintaan(TRANSAKSI_URL, req, res));
app.all('/api/laporan*',   (req, res) => teruskanPermintaan(TRANSAKSI_URL, req, res));
app.all('/api/target*',    (req, res) => teruskanPermintaan(TRANSAKSI_URL, req, res));

app.get('/api/tes', (req, res) => {
  res.json({ sukses: true, pesan: 'API Gateway KASIR ROKU aktif!', mode: IS_PRODUCTION ? 'GCP Cloud Run' : 'Lokal', auth_url: AUTH_URL, transaksi_url: TRANSAKSI_URL });
});

// ─── Routing Static (Frontend) ────────────────────────────────────────────────
// Melayani file statis hasil build React (Vite)
const staticPath = path.join(__dirname, 'public');
app.use(express.static(staticPath));

// Fallback untuk React Router: jika bukan API, kirim index.html
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/')) return next();
  res.sendFile(path.join(staticPath, 'index.html'), err => {
    if (err) res.status(404).send('Frontend build belum di-deploy atau folder public kosong.');
  });
});

// ─── STARTUP ──────────────────────────────────────────────────────────────────
async function mulaiGateway() {
  if (!IS_PRODUCTION) {
    console.log('[Gateway] Menunggu layanan-auth (5001) dan layanan-transaksi (5002) siap...');
    try {
      await Promise.all([tungguPort(5001), tungguPort(5002)]);
      console.log('[Gateway] Semua layanan siap. Memulai API Gateway...');
    } catch (err) {
      console.error('[Gateway] GAGAL:', err.message);
      process.exit(1);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('=======================================================');
    console.log(`   API GATEWAY aktif di port ${PORT}`);
    console.log(`   Mode: ${IS_PRODUCTION ? 'PRODUCTION (GCP)' : 'DEVELOPMENT (lokal)'}`);
    console.log(`   Auth URL:      ${AUTH_URL}`);
    console.log(`   Transaksi URL: ${TRANSAKSI_URL}`);
    console.log('=======================================================');
  });
}

mulaiGateway();