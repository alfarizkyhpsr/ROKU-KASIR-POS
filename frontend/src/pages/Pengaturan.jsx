import React, { useState, useEffect } from 'react';
import { useTokoState } from '../store/toko_state';
import klienApi from '../api/klien_api';

function Pengaturan() {
  const { 
    sesiKasir, 
    shiftAktif, 
    antreanOffline, 
    apakahOnline, 
    aturShiftAktif, 
    sinkronisasiTransaksiOffline 
  } = useTokoState();

  // State untuk Buka Shift
  const [modalAwal, setModalAwal] = useState('100000');
  
  // State untuk Tutup Shift
  const [kasAkhir, setKasAkhir] = useState('');
  const [catatan, setCatatan] = useState('');
  const [selisihKas, setSelisihKas] = useState(0);

  // Sesi logs perangkat NoSQL
  const [logsAktivitas, setLogsAktivitas] = useState([]);
  const [sedangSinkronisasi, setSedangSinkronisasi] = useState(false);

  const muatDaftarShiftDanLogs = async () => {
    try {
      // Ambil log perangkat jika online
      if (apakahOnline) {
        // Simulasikan atau tarik logs dari server
        setLogsAktivitas([
          { event_type: "login", message: "Kasir kasir01 berhasil masuk ke Stasiun 01", timestamp: new Date().toISOString() },
          { event_type: "sync", message: "Sinkronisasi antrean NoSQL FIFO berhasil diselesaikan", timestamp: new Date().toISOString() }
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    muatDaftarShiftDanLogs();
  }, [apakahOnline]);

  // Efek menghitung selisih kas saat tutup shift
  useEffect(() => {
    if (shiftAktif) {
      const ekspektasi = Number(shiftAktif.modal_awal) + Number(shiftAktif.total_penjualan);
      const aktual = Number(kasAkhir) || 0;
      setSelisihKas(aktual - ekspektasi);
    }
  }, [kasAkhir, shiftAktif]);

  const tanganiBukaShift = async (e) => {
    e.preventDefault();
    if (!modalAwal || Number(modalAwal) < 0) {
      alert("Modal awal tidak boleh kosong atau negatif.");
      return;
    }

    try {
      const respons = await klienApi.post('/shift/buka', { modal_awal: Number(modalAwal) });
      if (respons.data.sukses) {
        aturShiftAktif(respons.data.data);
        alert("Shift baru berhasil dibuka! Selamat melayani pelanggan.");
      }
    } catch (err) {
      alert(err.response?.data?.pesan || "Gagal membuka shift.");
    }
  };

  const tanganiTutupShift = async (e) => {
    e.preventDefault();
    if (!kasAkhir || Number(kasAkhir) < 0) {
      alert("Kas akhir wajib diisi.");
      return;
    }

    try {
      const respons = await klienApi.put(`/shift/${shiftAktif.id}/tutup`, {
        kas_akhir: Number(kasAkhir),
        catatan: catatan || `Tutup shift. Selisih kas: Rp ${selisihKas.toLocaleString('id-ID')}`
      });

      if (respons.data.sukses) {
        alert(`Shift resmi ditutup.\nSelisih Laci Kasir: Rp ${selisihKas.toLocaleString('id-ID')}`);
        aturShiftAktif(null);
        setKasAkhir('');
        setCatatan('');
      }
    } catch (err) {
      alert("Gagal menutup shift.");
    }
  };

  const tanganiSinkronisasiManual = async () => {
    if (!antreanOffline.length) {
      alert("Antrean offline kosong.");
      return;
    }

    setSedangSinkronisasi(true);
    try {
      const hasil = await sinkronisasiTransaksiOffline();
      alert(hasil.pesan);
      muatDaftarShiftDanLogs();
    } catch (e) {
      alert("Sinkronisasi gagal dilakukan.");
    } finally {
      setSedangSinkronisasi(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-on-surface">
      
      {/* HEADER */}
      <div className="border-b-2 border-on-surface pb-6 mb-6">
        <h1 className="text-3xl font-black font-display uppercase tracking-tight">Shift & Sinkronisasi</h1>
        <p className="text-on-surface-variant mt-1">
          7.2.2 Rekonsiliasi giliran kas harian, deteksi kebocoran kas, dan monitoring sinkronisasi antrean offline Firestore.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        
        {/* PANEL A: MANAJEMEN SHIFT KASIR (REKONSILIASI) */}
        
        <section className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
          <div className="flex items-center gap-2 font-black border-b-2 border-on-surface pb-3 mb-6">
            <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            STATUS SHIFT: {shiftAktif ? 'GILIRAN BERJALAN' : 'BELUM DIBUKA'}
          </div>

          {!shiftAktif ? (
            // Form Buka Shift
            <form onSubmit={tanganiBukaShift} className="space-y-4">
              <div className="bg-[#ffdf93] text-on-tertiary-fixed border-2 border-on-surface p-4 font-bold flex flex-col gap-1">
                <span className="flex items-center gap-1 uppercase">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  <span>Peringatan Kebocoran Kas:</span>
                </span>
                <span>Sebelum melayani transaksi POS, Anda wajib memasukkan modal laci kas harian untuk keperluan audit discrepancy!</span>
              </div>

              <div>
                <label className="block text-[10px] font-black mb-1">MODAL AWAL DI LACI KAS (Rp) *</label>
                <input 
                  type="number"
                  value={modalAwal}
                  onChange={(e) => setModalAwal(e.target.value)}
                  className="w-full bg-surface border-2 border-on-surface p-3 text-lg font-black tracking-widest focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-on-primary py-3 border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all font-black text-sm uppercase"
              >
                BUKA SHIFT KASIR SEKARANG
              </button>
            </form>
          ) : (
            // Form Tutup Shift
            <form onSubmit={tanganiTutupShift} className="space-y-4">
              <div className="bg-surface-container-low border-2 border-on-surface p-4 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-on-surface-variant block text-[10px]">OPERATOR KASIR:</span>
                  <span className="font-bold uppercase text-xs">{sesiKasir.kasir.nama_lengkap}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-[10px]">CABANG BERTUGAS:</span>
                  <span className="font-bold uppercase text-xs">{sesiKasir.cabang?.nama_cabang}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-[10px]">DIBUKA PADA:</span>
                  <span className="font-bold text-[10px]">{shiftAktif.dibuka_pada?.split('T')[1].substring(0, 5)} WIB</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-[10px]">MODAL AWAL LACI:</span>
                  <span className="font-bold text-xs">Rp {shiftAktif.modal_awal.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t border-on-surface/20 pt-2 col-span-2">
                  <span className="text-on-surface-variant block text-[10px]">PENJUALAN DI SHIFT INI:</span>
                  <span className="font-black text-sm text-primary">Rp {shiftAktif.total_penjualan.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t border-on-surface/20 pt-2 col-span-2">
                  <span className="text-on-surface-variant block text-[10px]">EKSPEKTASI UANG DI LACI (Modal + Omzet):</span>
                  <span className="font-black text-base text-[#22c55e]">
                    Rp {(Number(shiftAktif.modal_awal) + Number(shiftAktif.total_penjualan)).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black mb-1">UANG TUNAI AKTUAL DI LACI KAS (Rp) *</label>
                <input 
                  type="number"
                  value={kasAkhir}
                  onChange={(e) => setKasAkhir(e.target.value)}
                  placeholder="Hitung uang tunai di laci kas..."
                  className="w-full bg-surface border-2 border-on-surface p-3 text-lg font-black tracking-widest focus:outline-none"
                  required
                />
              </div>

              {kasAkhir && (
                <div className={`p-3 border-2 border-on-surface text-center font-bold ${
                  selisihKas === 0 
                    ? 'bg-[#4ade80]/20 text-[#22c55e] border-[#4ade80]'
                    : selisihKas < 0 
                      ? 'bg-[#ffdad6] text-[#93000a] border-error'
                      : 'bg-[#ffdf93]/20 text-on-tertiary-fixed border-[#ffdf93]'
                }`}>
                  {selisihKas === 0 ? (
                    <span className="flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>KAS COCOK (Rp 0 Selisih)</span>
                    </span>
                  ) : selisihKas < 0 ? (
                    <span className="flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">warning</span>
                      <span>KEBOCORAN KAS DETEKSI: KEKURANGAN Rp {Math.abs(selisihKas).toLocaleString('id-ID')}</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">info</span>
                      <span>KELEBIHAN KAS: SURPLUS Rp {selisihKas.toLocaleString('id-ID')}</span>
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black mb-1">CATATAN REKONSILIASI / KETERANGAN</label>
                <textarea 
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Tambahkan catatan jika ada selisih kas akhir..."
                  className="w-full bg-surface border-2 border-on-surface p-2 text-xs focus:outline-none h-16"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-error text-on-error py-3 border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all font-black text-sm uppercase"
              >
                TUTUP SHIFT & KUNCI LAPORAN KAS
              </button>
            </form>
          )}
        </section>

        
        {/* PANEL B: FIRESTORE OFFLINE QUEUE (SINKRONISASI) */}
        
        <section className="space-y-6">
          
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex items-center justify-between border-b-2 border-on-surface pb-3 mb-6">
              <span className="font-black text-sm uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-base">cloud_sync</span>
                Antrean Sinkronisasi (Firestore NoSQL)
              </span>
              <span className="bg-primary text-on-primary font-black px-2 py-0.5 text-[10px] border border-on-surface">
                {antreanOffline.length} TX Pending
              </span>
            </div>

            <div className="bg-surface-container-low border-2 border-on-surface p-4 text-center my-4 font-mono">
              <div className="text-[10px] text-on-surface-variant font-bold mb-1">TOTAL TRANSAKSI MENUNGGU CLOUD SQL:</div>
              <div className="text-3xl font-black text-primary">{antreanOffline.length} Antrean</div>
              <p className="text-[9px] text-on-surface-variant mt-2">
                Transaksi offline tersimpan aman di koleksi local-NoSQL. Saat status Online diaktifkan, worker akan memproses antrean FIFO secara background.
              </p>
            </div>

            {antreanOffline.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {antreanOffline.map((tx, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 border-2 border-on-surface bg-surface shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] text-[9px]">
                    <div className="font-bold">ID: {tx.id_offline}</div>
                    <div className="font-black text-primary">Rp {tx.total_belanja.toLocaleString('id-ID')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center italic text-on-surface-variant py-4">Tidak ada antrean transaksi offline saat ini.</div>
            )}

            <button
              onClick={tanganiSinkronisasiManual}
              disabled={!antreanOffline.length || sedangSinkronisasi || !apakahOnline}
              className="w-full bg-[#4ade80] text-on-surface py-3 border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all font-black text-xs uppercase mt-6 disabled:opacity-50 disabled:translate-none disabled:shadow-none flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">sync</span>
              {sedangSinkronisasi ? 'SEDANG MENYINKRONKAN...' : 'SINKRONISASI SEKARANG (FIFO)'}
            </button>
          </div>

          {/* Audit Logs (NoSQL activity representation) */}
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="font-black text-sm uppercase border-b-2 border-on-surface pb-3 mb-4">
              Log Keamanan & Aktivitas Perangkat (Firestore)
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {logsAktivitas.map((log, idx) => (
                <div key={idx} className="p-2 border border-on-surface/20 bg-surface-container-low font-mono text-[9px]">
                  <span className="font-bold text-primary">[{log.event_type.toUpperCase()}]</span> {log.message}
                  <div className="text-[8px] text-on-surface-variant mt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
              {logsAktivitas.length === 0 && (
                <div className="text-center italic py-6">Belum ada log aktivitas perangkat terekam.</div>
              )}
            </div>
          </div>

        </section>

      </div>

    </div>
  );
}

export default Pengaturan;
