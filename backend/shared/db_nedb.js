const Nedb = require('@seald-io/nedb');
const path = require('path');
const fs   = require('fs');

const dirData = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dirData)) fs.mkdirSync(dirData, { recursive: true });

const KOLEKSI_NOSQL = [
  'transaksi_offline',
  'antrean_sinkronisasi',
  'cache_katalog_barang',
  'log_perangkat',
  'sesi_aktif'
];

const datastores = {};

function ambilDb(koleksi) {
  if (!datastores[koleksi]) {
    datastores[koleksi] = new Nedb({
      filename: path.join(dirData, `${koleksi}.db`),
      autoload: true,
      timestampData: false
    });
  }
  return datastores[koleksi];
}

// ── Helpers untuk konversi _id ↔ id ─────────────────────────────────────────

function docKeluar(doc) {
  if (!doc) return null;
  const { _id, ...sisa } = doc;
  return { id: _id, ...sisa };
}

// ── API Publik ────────────────────────────────────────────────────────────────

async function ambilSemua(koleksi) {
  const db   = ambilDb(koleksi);
  const docs = await db.findAsync({});
  return docs.map(docKeluar);
}

async function ambilById(koleksi, id) {
  const db  = ambilDb(koleksi);
  const doc = await db.findOneAsync({ _id: String(id) });
  return docKeluar(doc);
}

async function tambah(koleksi, data) {
  const db = ambilDb(koleksi);
  const payload = {
    ...data,
    dibuat_pada: data.dibuat_pada || new Date().toISOString()
  };
  delete payload.id;
  const doc = await db.insertAsync(payload);
  return docKeluar(doc);
}

async function set(koleksi, id, data) {
  const db = ambilDb(koleksi);
  const payload = { ...data };
  delete payload.id;
  await db.updateAsync(
    { _id: String(id) },
    { _id: String(id), ...payload },
    { upsert: true }
  );
  const doc = await db.findOneAsync({ _id: String(id) });
  return docKeluar(doc);
}

async function perbarui(koleksi, id, data) {
  const db = ambilDb(koleksi);
  const payload = { ...data, diperbarui_pada: new Date().toISOString() };
  delete payload.id;
  await db.updateAsync({ _id: String(id) }, { $set: payload });
  const doc = await db.findOneAsync({ _id: String(id) });
  return docKeluar(doc);
}

async function hapus(koleksi, id) {
  const db  = ambilDb(koleksi);
  const doc = await db.findOneAsync({ _id: String(id) });
  if (doc) await db.removeAsync({ _id: String(id) }, {});
  return docKeluar(doc);
}

async function cariDimana(koleksi, field, operator, values) {
  const db = ambilDb(koleksi);
  let query = {};
  if (operator === 'in') {
    query[field] = { $in: values };
  } else if (operator === '==') {
    query[field] = values;
  }
  const docs = await db.findAsync(query);
  return docs.map(docKeluar);
}

async function hapusBanyak(koleksi, field, values) {
  const db = ambilDb(koleksi);
  const query = { [field]: { $in: values } };
  await db.removeAsync(query, { multi: true });
}

module.exports = {
  KOLEKSI_NOSQL,
  ambilSemua,
  ambilById,
  tambah,
  set,
  perbarui,
  hapus,
  cariDimana,
  hapusBanyak
};
