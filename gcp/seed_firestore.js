/**
 * Script untuk seed data awal ke Firestore
 * Jalankan SEKALI setelah Firestore project disiapkan:
 *   GOOGLE_CLOUD_PROJECT=your-project-id node gcp/seed_firestore.js
 */

const { Firestore } = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID
});

async function seed() {
  console.log('Memulai seed data Firestore...');

  // Koleksi NoSQL yang perlu dibuat (kosong, siap diisi oleh aplikasi)
  const koleksiKosong = [
    'transaksi_offline',
    'antrean_sinkronisasi',
    'cache_katalog_barang',
    'log_perangkat',
    'sesi_aktif'
  ];

  for (const koleksi of koleksiKosong) {
    // Buat dokumen placeholder agar koleksi terlihat di konsol GCP
    const docRef = db.collection(koleksi).doc('_init');
    await docRef.set({
      _keterangan: `Koleksi ${koleksi} diinisialisasi`,
      dibuat_pada: new Date().toISOString()
    });
    console.log(`Koleksi '${koleksi}' berhasil dibuat.`);
  }

  console.log('Seed Firestore selesai!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Error saat seed Firestore:', err);
  process.exit(1);
});
