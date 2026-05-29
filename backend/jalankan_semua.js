const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// 1. Jalankan Layanan Autentikasi (Port 5001)
const pathAuth = path.join(__dirname, 'layanan-auth', 'layanan_auth.js');
console.log(`Menjalankan Layanan Autentikasi dari ${pathAuth}...`);
const serverAuth = spawn('node', [pathAuth], { stdio: 'inherit' });

// 2. Jalankan Layanan Transaksi & POS (Port 5002)
const pathTransaksi = path.join(__dirname, 'layanan-transaksi', 'layanan_transaksi.js');
console.log(`Menjalankan Layanan Transaksi & POS dari ${pathTransaksi}...`);
const serverTransaksi = spawn('node', [pathTransaksi], { stdio: 'inherit' });

// Matikan proses anak jika proses induk dimatikan
process.on('exit', () => {
  serverAuth.kill();
  serverTransaksi.kill();
});

// 3. Bangun API Gateway pada Port 5000
const app = express();
app.use(cors());
app.use(express.json());

const PORT_GATEWAY = 5000;

function teruskanPermintaan(host, port, req, res) {
  const options = {
    hostname: host,
    port: port,
    path: req.originalUrl,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (e) => {
    console.error(`Kesalahan Gateway saat meneruskan ke ${host}:${port}:`, e.message);
    res.status(502).json({ sukses: false, pesan: "Kesalahan koneksi Gateway Backend." });
  });

  // Jika ada request body, tulis ke request proxy
  if (req.body && Object.keys(req.body).length > 0) {
    proxyReq.write(JSON.stringify(req.body));
  } else {
    // Pipe request asli (untuk penanganan streaming/multipart jika ada)
    req.pipe(proxyReq, { end: true });
  }
}

// Routing Gateway
app.all('/api/auth*', (req, res) => teruskanPermintaan('localhost', 5001, req, res));
app.all('/api/cabang*', (req, res) => teruskanPermintaan('localhost', 5001, req, res));
app.all('/api/kasir*', (req, res) => teruskanPermintaan('localhost', 5001, req, res));

app.all('/api/barang*', (req, res) => teruskanPermintaan('localhost', 5002, req, res));
app.all('/api/transaksi*', (req, res) => teruskanPermintaan('localhost', 5002, req, res));
app.all('/api/shift*', (req, res) => teruskanPermintaan('localhost', 5002, req, res));
app.all('/api/laporan*', (req, res) => teruskanPermintaan('localhost', 5002, req, res));

// Endpoint Tes
app.get('/api/tes', (req, res) => {
  res.json({ sukses: true, pesan: "API Gateway POS Neubrutalisme aktif dan berjalan lancar!" });
});

app.listen(PORT_GATEWAY, () => {
  console.log(`=======================================================`);
  console.log(`   API GATEWAY POS AKTIF DI http://localhost:${PORT_GATEWAY}`);
  console.log(`=======================================================`);
});
