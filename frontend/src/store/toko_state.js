import { create } from 'zustand';
import klienApi from '../api/klien_api';

export const useTokoState = create((set, get) => ({
  // --- STATE UTAMA ---
  sesiKasir: null, // Berisi { kasir, cabang, token }
  apakahOnline: true, // Untuk simulasi mode offline-to-online
  halamanAktif: 'kasir', // 'kasir' | 'barang' | 'laporan' | 'pengaturan'
  shiftAktif: null, // Berisi detail shift kasir yang sedang aktif
  keranjang: [], // List item belanja kasir
  antreanOffline: [], // Transaksi offline yang menunggu disinkronisasi ke server

  // --- AKSI / FUNCTIONS ---

  // Memuat sesi login & antrean dari localStorage saat awal buka PWA
  muatSesiDariLokal: () => {
    const sesiSimpanan = localStorage.getItem('sesi_kasir_pos');
    const antreanSimpanan = localStorage.getItem('antrean_offline_pos');
    const shiftSimpanan = localStorage.getItem('shift_aktif_pos');

    set({
      sesiKasir: sesiSimpanan ? JSON.parse(sesiSimpanan) : null,
      antreanOffline: antreanSimpanan ? JSON.parse(antreanSimpanan) : [],
      shiftAktif: shiftSimpanan ? JSON.parse(shiftSimpanan) : null
    });
  },

  aturHalaman: (namaHalaman) => {
    set({ halamanAktif: namaHalaman });
  },

  aturOnline: (statusOnline) => {
    set({ apakahOnline: statusOnline });
  },

  masukKasir: (dataSesi) => {
    localStorage.setItem('sesi_kasir_pos', JSON.stringify(dataSesi));
    set({ sesiKasir: dataSesi });
  },

  keluarKasir: () => {
    localStorage.removeItem('sesi_kasir_pos');
    localStorage.removeItem('shift_aktif_pos');
    set({ sesiKasir: null, shiftAktif: null, keranjang: [] });
  },

  // Memperbarui data cabang di session setelah admin mengedit nama cabang
  perbaruiSesiCabang: (dataCabangBaru) => {
    const { sesiKasir } = get();
    if (!sesiKasir) return;
    // Hanya perbarui jika cabang yang diedit adalah cabang pengguna yang sedang login
    if (sesiKasir.cabang && sesiKasir.cabang.id === dataCabangBaru.id) {
      const sesiDiperbarui = { ...sesiKasir, cabang: { ...sesiKasir.cabang, ...dataCabangBaru } };
      localStorage.setItem('sesi_kasir_pos', JSON.stringify(sesiDiperbarui));
      set({ sesiKasir: sesiDiperbarui });
    }
  },

  aturShiftAktif: (dataShift) => {
    if (dataShift) {
      localStorage.setItem('shift_aktif_pos', JSON.stringify(dataShift));
    } else {
      localStorage.removeItem('shift_aktif_pos');
    }
    set({ shiftAktif: dataShift });
  },

  // --- AKSI KERANJANG BELANJA ---

  tambahKeKeranjang: (barang) => {
    const { keranjang } = get();
    const itemEksis = keranjang.find(i => i.barang_id === barang.id);

    if (itemEksis) {
      set({
        keranjang: keranjang.map(i => 
          i.barang_id === barang.id 
            ? { ...i, jumlah: i.jumlah + 1 }
            : i
        )
      });
    } else {
      set({
        keranjang: [
          ...keranjang,
          {
            barang_id: barang.id,
            nama_barang: barang.nama_barang,
            harga_satuan: barang.harga_jual,
            jumlah: 1,
            url_gambar: barang.url_gambar || "inventory_2"
          }
        ]
      });
    }
  },

  kurangiDariKeranjang: (barangId) => {
    const { keranjang } = get();
    const item = keranjang.find(i => i.barang_id === barangId);

    if (!item) return;

    if (item.jumlah === 1) {
      set({
        keranjang: keranjang.filter(i => i.barang_id !== barangId)
      });
    } else {
      set({
        keranjang: keranjang.map(i => 
          i.barang_id === barangId 
            ? { ...i, jumlah: i.jumlah - 1 }
            : i
        )
      });
    }
  },

  perbaruiJumlahKeranjang: (barangId, jumlah) => {
    const { keranjang } = get();
    if (jumlah <= 0) {
      set({ keranjang: keranjang.filter(i => i.barang_id !== barangId) });
    } else {
      set({
        keranjang: keranjang.map(i => 
          i.barang_id === barangId 
            ? { ...i, jumlah: Number(jumlah) }
            : i
        )
      });
    }
  },

  kosongkanKeranjang: () => {
    set({ keranjang: [] });
  },

  // --- AKSI SIMULASI OFFLINE TRANSAKSI ---

  tambahAntreanOffline: (transaksiBaru) => {
    const { antreanOffline } = get();
    const antreanBaru = [...antreanOffline, transaksiBaru];
    
    localStorage.setItem('antrean_offline_pos', JSON.stringify(antreanBaru));
    set({ antreanOffline: antreanBaru });
  },

  sinkronisasiTransaksiOffline: async () => {
    const { antreanOffline, apakahOnline } = get();
    
    if (!apakahOnline || !antreanOffline.length) return { sukses: false, pesan: "Tidak ada koneksi internet atau antrean kosong." };

    try {
      const respons = await klienApi.post('/transaksi/sinkronisasi', { antrean: antreanOffline });
      
      if (respons.data.sukses) {
        // Kosongkan antrean lokal setelah berhasil sinkronisasi
        localStorage.removeItem('antrean_offline_pos');
        set({ antreanOffline: [] });
        return { sukses: true, pesan: "Semua transaksi offline berhasil disinkronisasikan ke server!" };
      }
      return { sukses: false, pesan: "Sinkronisasi gagal." };
    } catch (e) {
      console.error("Gagal melakukan sinkronisasi transaksi:", e);
      return { sukses: false, pesan: "Gagal tersambung ke server." };
    }
  }
}));
