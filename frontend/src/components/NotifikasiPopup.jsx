import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const NotifikasiContext = createContext(null);

const DURASI_AUTO_TUTUP = 4000;

const KONFIGURASI_TIPE = {
  sukses: {
    bg: 'bg-[#4ade80]',
    border: 'border-on-surface',
    icon: 'check_circle',
    label: 'BERHASIL',
  },
  error: {
    bg: 'bg-[#ffdad6]',
    border: 'border-[#93000a]',
    icon: 'cancel',
    label: 'ERROR',
  },
  peringatan: {
    bg: 'bg-[#ffdf93]',
    border: 'border-on-surface',
    icon: 'warning',
    label: 'PERINGATAN',
  },
  info: {
    bg: 'bg-[#e0d2ff]',
    border: 'border-on-surface',
    icon: 'info',
    label: 'INFO',
  },
};

function ItemNotifikasi({ notif, onTutup }) {
  const [keluarAnimasi, setKeluarAnimasi] = useState(false);
  const cfg = KONFIGURASI_TIPE[notif.tipe] || KONFIGURASI_TIPE.info;

  const tutup = useCallback(() => {
    setKeluarAnimasi(true);
    setTimeout(() => onTutup(notif.id), 280);
  }, [notif.id, onTutup]);

  useEffect(() => {
    const timer = setTimeout(tutup, DURASI_AUTO_TUTUP);
    return () => clearTimeout(timer);
  }, [tutup]);

  return (
    <div
      className={`
        flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)]
        ${cfg.bg} border-2 ${cfg.border}
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
        p-3 font-mono
        transition-all duration-300 ease-in-out
        ${keluarAnimasi
          ? 'opacity-0 translate-x-full'
          : 'opacity-100 translate-x-0'
        }
      `}
    >
      <span className="material-symbols-outlined text-xl mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
        {cfg.icon}
      </span>

      <div className="flex-1 min-w-0">
        <div className="font-black text-[10px] uppercase tracking-widest mb-0.5">{cfg.label}</div>
        <div className="text-xs font-bold leading-snug break-words">{notif.pesan}</div>
      </div>

      <button
        onClick={tutup}
        className="flex-shrink-0 font-black text-xs border border-current px-1 py-0.5 leading-none hover:bg-black/10 transition-colors"
        aria-label="Tutup notifikasi"
      >
        ✕
      </button>
    </div>
  );
}

export function NotifikasiProvider({ children }) {
  const [daftarNotif, setDaftarNotif] = useState([]);

  const tambahNotifikasi = useCallback((tipe, pesan) => {
    const id = Date.now() + Math.random();
    setDaftarNotif(prev => [...prev, { id, tipe, pesan }]);
  }, []);

  const tutupNotifikasi = useCallback((id) => {
    setDaftarNotif(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotifikasiContext.Provider value={{ tambahNotifikasi }}>
      {children}

      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {daftarNotif.map(notif => (
          <div key={notif.id} className="pointer-events-auto">
            <ItemNotifikasi notif={notif} onTutup={tutupNotifikasi} />
          </div>
        ))}
      </div>
    </NotifikasiContext.Provider>
  );
}

export function useNotifikasi() {
  const ctx = useContext(NotifikasiContext);
  if (!ctx) throw new Error('useNotifikasi harus digunakan di dalam NotifikasiProvider');
  return ctx;
}
