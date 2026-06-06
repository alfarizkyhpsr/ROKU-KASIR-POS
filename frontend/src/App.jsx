import React, { useEffect, useState } from 'react';
import { useTokoState } from './store/toko_state';
import klienApi from './api/klien_api';
import Kasir from './pages/Kasir';
import Barang from './pages/Barang';
import Laporan from './pages/Laporan';
import Pengaturan from './pages/Pengaturan';
import ManajemenSDM from './pages/ManajemenSDM';
import { NotifikasiProvider, useNotifikasi } from './components/NotifikasiPopup';

function AppDalam() {
  const { tambahNotifikasi } = useNotifikasi();
  const {
    sesiKasir,
    halamanAktif,
    apakahOnline,
    antreanOffline,
    muatSesiDariLokal,
    aturHalaman,
    aturOnline,
    masukKasir,
    keluarKasir,
    aturShiftAktif,
    sinkronisasiTransaksiOffline
  } = useTokoState();

  // State untuk login PIN
  const [pin, setPin] = useState('');
  const [namaPengguna, setNamaPengguna] = useState('');
  const [pesanError, setPesanError] = useState('');
  const [sedangMemproses, setSedangMemproses] = useState(false);

  useEffect(() => {
    muatSesiDariLokal();
  }, []);

  // Sinkronisasi otomatis ketika berubah dari offline ke online
  useEffect(() => {
    if (apakahOnline && antreanOffline.length > 0 && sesiKasir) {
      console.log("Mendeteksi status online. Menjalankan auto-sinkronisasi...");
      sinkronisasiTransaksiOffline().then(hasil => {
        if (hasil.sukses) {
          tambahNotifikasi('sukses', 'Koneksi pulih! Antrean transaksi offline berhasil disinkronisasikan otomatis.');
        }
      });
    }
  }, [apakahOnline]);

  const tanganiMasukPin = async (e) => {
    if (e) e.preventDefault();
    if (pin.length < 6) {
      setPesanError("PIN harus berisi 6 angka.");
      return;
    }

    setSedangMemproses(true);
    setPesanError('');

    try {
      // POST ke Layanan Auth (diteruskan via Gateway)
      const respons = await klienApi.post('/auth/masuk', {
        nama_pengguna: namaPengguna,
        pin: pin
      });

      if (respons.data.sukses) {
        masukKasir(respons.data.data);

        // Cek apakah ada shift kasir yang aktif setelah masuk
        try {
          const resShift = await klienApi.get('/shift/daftar');
          if (resShift.data.sukses && resShift.data.data.length > 0) {
            const shiftKasirIni = resShift.data.data.find(s => s.kasir_id === respons.data.data.kasir.id && s.status === 'buka');
            if (shiftKasirIni) {
              aturShiftAktif(shiftKasirIni);
            }
          }
        } catch (err) {
          console.log("Gagal memuat shift awal:", err);
        }
      }
    } catch (err) {
      console.error("Login gagal:", err);
      setPesanError(err.response?.data?.pesan || "Koneksi ke Gateway API terputus.");
    } finally {
      setSedangMemproses(false);
      setPin('');
    }
  };

  const tekanTombolPin = (angka) => {
    if (pin.length < 6) {
      setPin(prev => prev + angka);
    }
  };

  const hapusPin = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const renderHalaman = () => {
    switch (halamanAktif) {
      case 'kasir':
        return <Kasir />;
      case 'barang':
        return <Barang />;
      case 'laporan':
        return <Laporan />;
      case 'pengaturan':
        return <Pengaturan />;
      case 'manajemen':
        return <ManajemenSDM />;
      default:
        return <Kasir />;
    }
  };

  // --- TAMPILAN LOGIN PIN (NEUBRUTALISME) ---
  if (!sesiKasir) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-on-surface">
        <div className="w-full max-w-md bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 relative">
          <div className="bg-primary text-on-primary border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 mb-6 text-center font-mono font-black text-2xl tracking-tight uppercase">
            KASIR ROKU - LOGIN
          </div>

          <form onSubmit={tanganiMasukPin} className="space-y-4">
            <div>
              <label className="block font-mono text-sm font-black mb-1">USERNAME KASIR:</label>
              <input
                type="text"
                value={namaPengguna}
                onChange={(e) => setNamaPengguna(e.target.value)}
                className="w-full bg-surface border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-2 font-mono text-sm focus:outline-none"
                placeholder="MASUKKAN USERNAME ANDA..."
                required
              />
            </div>

            <div>
              <label className="block font-mono text-sm font-black mb-1">MASUKKAN PIN 6 ANGKA:</label>
              <div className="h-12 bg-surface-container border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center font-mono text-2xl font-black tracking-widest">
                {pin.split('').map(() => '●').join('')}
                {pin.length === 0 && <span className="text-outline/40">PIN KASIR</span>}
              </div>
            </div>

            {pesanError && (
              <div className="bg-error-container text-on-error-container border-2 border-on-surface p-2 font-mono text-xs font-bold text-center flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{pesanError}</span>
              </div>
            )}

            {/* PIN PAD GRID (Bento Style) */}
            <div className="grid grid-cols-3 gap-2 my-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((angka) => (
                <button
                  key={angka}
                  type="button"
                  onClick={() => tekanTombolPin(angka)}
                  className="bg-surface border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-3 font-mono font-black text-lg hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none klik-brutal"
                >
                  {angka}
                </button>
              ))}
              <button
                type="button"
                onClick={hapusPin}
                className="bg-error-container text-on-error-container border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-3 font-mono font-bold hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none klik-brutal"
              >
                HAPUS
              </button>
              <button
                type="button"
                onClick={() => tekanTombolPin(0)}
                className="bg-surface border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-3 font-mono font-black text-lg hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none klik-brutal"
              >
                0
              </button>
              <button
                type="submit"
                disabled={sedangMemproses}
                className="bg-[#4ade80] text-on-surface border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-3 font-mono font-black text-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none klik-brutal"
              >
                {sedangMemproses ? "..." : "MASUK"}
              </button>
            </div>
            {/* Debug PIN guidelines removed for production */}
          </form>
        </div>
      </div>
    );
  }

  // --- TAMPILAN DASHBOARD UTAMA (NEUBRUTALISME) ---
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-on-surface">

      {/* 1. TOP NAV BAR */}
      <nav className="flex justify-between items-center w-full px-6 h-16 bg-on-tertiary-fixed text-tertiary-fixed border-b-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
        <div className="flex items-center gap-4">
          <span className="font-mono font-black text-2xl text-tertiary-fixed tracking-tighter">KASIR ROKU</span>
          <span className="bg-[#ba1a1a] text-[#ffffff] px-2 py-0.5 border border-on-surface text-[10px] font-mono font-bold tracking-wider uppercase">
            {sesiKasir.cabang?.nama_cabang || "Pusat"}
          </span>
        </div>

        {/* Simulasi Online/Offline Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center border-2 border-on-surface bg-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 py-1 font-mono text-xs font-black text-on-surface">
            <span className="mr-2">STATUS:</span>
            <button
              onClick={() => aturOnline(!apakahOnline)}
              className={`px-2 py-0.5 font-bold transition-all border border-on-surface ${apakahOnline ? 'bg-[#4ade80] text-on-surface' : 'bg-error text-on-error'}`}
            >
              {apakahOnline ? "ONLINE (MySQL)" : "OFFLINE (Queue)"}
            </button>
            {antreanOffline.length > 0 && (
              <span className="ml-2 bg-[#ffdf93] text-on-tertiary-fixed px-1.5 py-0.5 border border-on-surface text-[10px] animate-pulse">
                {antreanOffline.length} Antrean
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="font-bold text-sm tracking-tight">{sesiKasir.kasir.nama_lengkap}</div>
            <div className="text-[10px] text-tertiary-fixed/70 font-mono tracking-wider uppercase">{sesiKasir.kasir.peran}</div>
          </div>
          <button
            onClick={keluarKasir}
            className="bg-error text-on-error border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-1 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none klik-brutal"
            title="Keluar dari sistem"
          >
            <span className="material-symbols-outlined block">logout</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">

        {/* 2. SIDE NAV BAR */}
        <aside className="w-64 flex flex-col bg-surface border-r-2 border-on-surface z-40 hidden md:flex h-full">
          <div className="bg-surface-container-highest p-4 border-b-2 border-on-surface font-mono">
            <div className="font-black text-on-surface text-base uppercase">Terminal Kasir</div>
            <div className="text-xs text-on-surface-variant">ID Kasir: #{sesiKasir.kasir.id}</div>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-1">
            {/* Terminal Kasir */}
            <button
              onClick={() => aturHalaman('kasir')}
              className={`w-[calc(100%-16px)] flex items-center gap-3 p-3 m-2 font-mono text-sm font-bold border-2 transition-all ${halamanAktif === 'kasir'
                ? 'bg-tertiary-fixed text-on-tertiary-fixed border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:border-on-surface hover:translate-x-[2px]'
                }`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: halamanAktif === 'kasir' ? "'FILL' 1" : "'FILL' 0" }}>point_of_sale</span>
              Terminal Kasir
            </button>

            {/* Kelola Barang (Hanya Manajer/Admin) */}
            {(sesiKasir.kasir.peran === 'admin' || sesiKasir.kasir.peran === 'manajer') && (
              <button
                onClick={() => aturHalaman('barang')}
                className={`w-[calc(100%-16px)] flex items-center gap-3 p-3 m-2 font-mono text-sm font-bold border-2 transition-all ${halamanAktif === 'barang'
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:border-on-surface hover:translate-x-[2px]'
                  }`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: halamanAktif === 'barang' ? "'FILL' 1" : "'FILL' 0" }}>inventory_2</span>
                Kelola Barang
              </button>
            )}

            {/* Laporan & Omzet */}
            <button
              onClick={() => aturHalaman('laporan')}
              className={`w-[calc(100%-16px)] flex items-center gap-3 p-3 m-2 font-mono text-sm font-bold border-2 transition-all ${halamanAktif === 'laporan'
                ? 'bg-tertiary-fixed text-on-tertiary-fixed border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:border-on-surface hover:translate-x-[2px]'
                }`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: halamanAktif === 'laporan' ? "'FILL' 1" : "'FILL' 0" }}>analytics</span>
              Laporan & Omzet
            </button>

            {/* Manajemen SDM & Cabang (Hanya Manajer/Admin) */}
            {(sesiKasir.kasir.peran === 'admin' || sesiKasir.kasir.peran === 'manajer') && (
              <button
                onClick={() => aturHalaman('manajemen')}
                className={`w-[calc(100%-16px)] flex items-center gap-3 p-3 m-2 font-mono text-sm font-bold border-2 transition-all ${halamanAktif === 'manajemen'
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:border-on-surface hover:translate-x-[2px]'
                  }`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: halamanAktif === 'manajemen' ? "'FILL' 1" : "'FILL' 0" }}>admin_panel_settings</span>
                Manajemen SDM
              </button>
            )}

            {/* Shift & Sinkronisasi */}
            <button
              onClick={() => aturHalaman('pengaturan')}
              className={`w-[calc(100%-16px)] flex items-center gap-3 p-3 m-2 font-mono text-sm font-bold border-2 transition-all ${halamanAktif === 'pengaturan'
                ? 'bg-tertiary-fixed text-on-tertiary-fixed border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                : 'text-on-surface-variant border-transparent hover:bg-surface-container-high hover:border-on-surface hover:translate-x-[2px]'
                }`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: halamanAktif === 'pengaturan' ? "'FILL' 1" : "'FILL' 0" }}>sync_saved_locally</span>
              Shift & Sinkronisasi
            </button>
          </div>

          {/* Active Branch and Operator */}
          <div className="p-4 border-t-2 border-on-surface bg-surface-container-low font-mono text-xs text-on-surface-variant">
            <div>CABANG: {sesiKasir.cabang?.kode_cabang || "HQ"}</div>
            <div>operator: {sesiKasir.kasir.nama_pengguna}</div>
          </div>
        </aside>

        {/* 3. MAIN WORK AREA CONTAINER */}
        <main className="flex-1 overflow-hidden bg-surface-container-low h-full flex flex-col">
          {renderHalaman()}
        </main>

      </div>
    </div>
  );
}

function App() {
  return (
    <NotifikasiProvider>
      <AppDalam />
    </NotifikasiProvider>
  );
}

export default App;
