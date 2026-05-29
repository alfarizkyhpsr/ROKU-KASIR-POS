import React, { useState, useEffect } from 'react';
import { useTokoState } from '../store/toko_state';
import klienApi from '../api/klien_api';

// Helper untuk merender icon/gambar tanpa emoji
const renderIconAtauGambar = (url, sizeClass = "text-5xl") => {
  if (!url) return <span className={`material-symbols-outlined ${sizeClass} text-outline-variant`}>inventory_2</span>;
  if (url.startsWith('http') || url.startsWith('data:')) {
    return <img src={url} alt="gambar" className="w-full h-full object-cover" />;
  }
  // Konversi emoji warisan jika ada
  let icon = url;
  if (url === '☕' || url === '🍵') icon = 'local_cafe';
  else if (url === '🥐' || url === '🥪') icon = 'bakery_dining';
  else if (url === '📦') icon = 'inventory_2';

  return <span className={`material-symbols-outlined ${sizeClass} text-outline-variant`}>{icon}</span>;
};

function Kasir() {
  const {
    sesiKasir,
    keranjang,
    shiftAktif,
    apakahOnline,
    tambahKeKeranjang,
    kurangiDariKeranjang,
    perbaruiJumlahKeranjang,
    kosongkanKeranjang,
    tambahAntreanOffline,
    aturHalaman
  } = useTokoState();

  const [daftarBarang, setDaftarBarang] = useState([]);
  const [kategoriTerpilih, setKategoriTerpilih] = useState('SEMUA');
  const [kataKunciCari, setKataKunciCari] = useState('');

  // State untuk modal pembayaran & sukses
  const [tampilkanModalBayar, setTampilkanModalBayar] = useState(false);
  const [tampilkanModalSukses, setTampilkanModalSukses] = useState(false);

  // Data pembayaran
  const [metodePembayaran, setMetodePembayaran] = useState('tunai');
  const [jumlahBayar, setJumlahBayar] = useState('');
  const [jumlahKembalian, setJumlahKembalian] = useState(0);
  const [transaksiTerakhir, setTransaksiTerakhir] = useState(null);

  // Ambil data barang dari API (Layanan Transaksi)
  const muatBarang = async () => {
    try {
      const respons = await klienApi.get('/barang');
      if (respons.data.sukses) {
        setDaftarBarang(respons.data.data);
      }
    } catch (e) {
      console.error("Gagal mengambil daftar barang:", e);
      // Fallback data jika backend mati sementara
      setDaftarBarang([
        { id: 1, kode_barcode: "8991001", nama_barang: "ES KOPI SUSU AREN", kategori: "MINUMAN", satuan: "gelas", harga_jual: 18000, url_gambar: "local_cafe", is_aktif: 1 },
        { id: 2, kode_barcode: "8991002", nama_barang: "BUTTER CROISSANT", kategori: "MAKANAN", satuan: "pcs", harga_jual: 22000, url_gambar: "bakery_dining", is_aktif: 1 },
        { id: 3, kode_barcode: "8991003", nama_barang: "CLUB SANDWICH", kategori: "MAKANAN", satuan: "pcs", harga_jual: 35000, url_gambar: "bakery_dining", is_aktif: 1 },
        { id: 4, kode_barcode: "8991004", nama_barang: "MATCHA LATTE", kategori: "MINUMAN", satuan: "gelas", harga_jual: 24000, url_gambar: "local_cafe", is_aktif: 1 }
      ]);
    }
  };

  useEffect(() => {
    muatBarang();
  }, []);

  // Perhitungan Keuangan Keranjang
  const hitungSubtotal = () => keranjang.reduce((sum, item) => sum + (item.harga_satuan * item.jumlah), 0);
  const subtotal = hitungSubtotal();
  const pajak = Math.round(subtotal * 0.1); // Pajak 10%
  const totalTagihan = subtotal + pajak;

  // Efek menghitung kembalian otomatis
  useEffect(() => {
    const bayar = Number(jumlahBayar) || 0;
    if (bayar >= totalTagihan) {
      setJumlahKembalian(bayar - totalTagihan);
    } else {
      setJumlahKembalian(0);
    }
  }, [jumlahBayar, totalTagihan]);

  const bukaPembayaran = () => {
    if (!keranjang.length) return;
    setJumlahBayar(totalTagihan.toString());
    setTampilkanModalBayar(true);
  };

  const selesaikanTransaksi = async () => {
    const bayar = Number(jumlahBayar) || 0;
    if (bayar < totalTagihan && metodePembayaran === 'tunai') {
      alert("Uang pembayaran kurang!");
      return;
    }

    const payloadTransaksi = {
      cabang_id: sesiKasir.cabang?.id || 1,
      kasir_id: sesiKasir.kasir.id,
      shift_id: shiftAktif ? shiftAktif.id : 0,
      total_belanja: totalTagihan,
      diskon: 0,
      pajak: pajak,
      metode_pembayaran: metodePembayaran,
      jumlah_bayar: metodePembayaran === 'tunai' ? bayar : totalTagihan,
      jumlah_kembalian: metodePembayaran === 'tunai' ? jumlahKembalian : 0,
      item: keranjang,
      offline: !apakahOnline, // Flag online/offline
      id_offline: `OFF-${Date.now()}`
    };

    try {
      const respons = await klienApi.post('/transaksi', payloadTransaksi);

      if (respons.data.sukses) {
        setTransaksiTerakhir({
          ...payloadTransaksi,
          kode_transaksi: respons.data.data.kode_transaksi || payloadTransaksi.id_offline,
          dibuat_pada: new Date().toISOString()
        });

        // Jika offline, simpan ke antrean lokal Zustand
        if (!apakahOnline) {
          tambahAntreanOffline(payloadTransaksi);
        }

        // Tampilkan modal sukses struk
        setTampilkanModalBayar(false);
        setTampilkanModalSukses(true);
        kosongkanKeranjang();
      }
    } catch (err) {
      console.error("Gagal memproses transaksi:", err);
      alert("Terjadi kesalahan koneksi backend. Silakan gunakan mode OFFLINE.");
    }
  };

  // Filter katalog produk
  const barangTerfilter = daftarBarang.filter(b => {
    const cocokKategori = kategoriTerpilih === 'SEMUA' || b.kategori === kategoriTerpilih;
    const cocokCari = b.nama_barang.toLowerCase().includes(kataKunciCari.toLowerCase()) ||
      b.kode_barcode.includes(kataKunciCari);
    return cocokKategori && cocokCari && b.is_aktif === 1;
  });

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      {/* PANEL KIRI: KATALOG BARANG (65%) */}
      <section className="flex-1 p-6 overflow-y-auto bg-surface-container-low flex flex-col">

        {/* Header & Filter Kategori */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black font-display uppercase tracking-tight">Katalog Produk</h1>
            <p className="text-on-surface-variant font-mono text-xs mt-1 flex items-center gap-1">
              {shiftAktif ? `Shift Aktif #${shiftAktif.id} • Terminal Cabang` : (
                <>
                  <span className="material-symbols-outlined text-xs">warning</span>
                  <span>SHIFT KASIR BELUM DIBUKA</span>
                </>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <input
              value={kataKunciCari}
              onChange={(e) => setKataKunciCari(e.target.value)}
              placeholder="CARI BARANG / SCAN BARCODE..."
              className="bg-surface border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-4 py-2 font-mono text-xs focus:outline-none w-56 uppercase"
            />
            {['SEMUA', 'MAKANAN', 'MINUMAN'].map(kat => (
              <button
                key={kat}
                onClick={() => setKategoriTerpilih(kat)}
                className={`px-4 py-2 border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${kategoriTerpilih === kat ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'
                  }`}
              >
                {kat}
              </button>
            ))}
          </div>
        </div>

        {/* Katalog Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {barangTerfilter.map(barang => (
            <button
              key={barang.id}
              onClick={() => {
                if (!shiftAktif && apakahOnline) {
                  alert("Anda harus membuka shift baru terlebih dahulu di menu 'Shift & Sinkronisasi' sebelum melayani transaksi!");
                  return;
                }
                tambahKeKeranjang(barang);
              }}
              className="group text-left bg-surface border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex flex-col h-full overflow-hidden"
            >
              <div className="h-32 w-full bg-secondary-container border-b-2 border-on-surface flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
                {renderIconAtauGambar(barang.url_gambar)}
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm leading-tight uppercase font-mono tracking-tight">{barang.nama_barang}</h3>
                  <p className="text-[10px] text-on-surface-variant font-mono mt-1">{barang.kategori} • {barang.satuan}</p>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="font-mono font-black text-primary text-sm">Rp {barang.harga_jual.toLocaleString('id-ID')}</span>
                  <div className="w-6 h-6 bg-on-surface text-surface flex items-center justify-center group-active:scale-95">
                    <span className="material-symbols-outlined text-xs">add</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
          {barangTerfilter.length === 0 && (
            <div className="col-span-full bg-surface border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 text-center font-mono font-bold text-on-surface-variant flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-4xl">inventory_2</span>
              <span>PRODUK TIDAK DITEMUKAN</span>
            </div>
          )}
        </div>
      </section>

      {/* PANEL KANAN: KERANJANG BELANJA (35%) */}
      <aside className="w-[35%] min-w-[320px] bg-surface border-l-2 border-on-surface flex flex-col h-full z-10">
        <div className="p-4 border-b-2 border-on-surface bg-surface-container flex justify-between items-center">
          <h2 className="font-mono font-black text-lg tracking-tight uppercase">Keranjang</h2>
          {keranjang.length > 0 && (
            <button
              onClick={kosongkanKeranjang}
              className="text-error font-mono text-xs hover:underline flex items-center gap-1 font-bold"
            >
              <span className="material-symbols-outlined text-xs block">delete</span> Kosongkan
            </button>
          )}
        </div>

        {/* List Item */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {keranjang.map(item => (
            <div key={item.barang_id} className="flex items-center gap-3 p-3 border-2 border-on-surface bg-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs">
              <div className="w-12 h-12 bg-secondary-container border-2 border-on-surface flex items-center justify-center overflow-hidden">
                {renderIconAtauGambar(item.url_gambar, "text-2xl")}
              </div>
              <div className="flex-1">
                <div className="font-bold uppercase leading-tight truncate w-32">{item.nama_barang}</div>
                <div className="text-primary text-[10px] mt-0.5">Rp {item.harga_satuan.toLocaleString('id-ID')}</div>
              </div>

              <div className="flex items-center border-2 border-on-surface bg-surface">
                <button
                  onClick={() => kurangiDariKeranjang(item.barang_id)}
                  className="w-5 h-5 flex items-center justify-center hover:bg-surface-variant font-bold text-sm"
                >-</button>
                <input
                  type="number"
                  value={item.jumlah}
                  onChange={(e) => perbaruiJumlahKeranjang(item.barang_id, e.target.value)}
                  className="w-8 h-5 text-center bg-on-surface text-tertiary-fixed font-bold border-l-2 border-r-2 border-on-surface text-[10px] focus:outline-none"
                />
                <button
                  onClick={() => tambahKeKeranjang({ id: item.barang_id, nama_barang: item.nama_barang, harga_jual: item.harga_satuan, url_gambar: item.url_gambar })}
                  className="w-5 h-5 flex items-center justify-center hover:bg-surface-variant font-bold text-sm"
                >+</button>
              </div>
            </div>
          ))}

          {keranjang.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center font-mono text-xs text-on-surface-variant p-6">
              <span className="material-symbols-outlined text-4xl block mb-2 text-outline-variant">shopping_basket</span>
              KERANJANG KOSONG<br />PILIH PRODUK DI KATALOG
            </div>
          )}
        </div>

        {/* Footer Keranjang */}
        <div className="mt-auto border-t-2 border-on-surface bg-surface">
          <div className="p-4 flex flex-col gap-1 font-mono text-xs border-b-2 border-on-surface bg-surface-container-low">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Subtotal</span>
              <span className="font-bold">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Pajak (10%)</span>
              <span className="font-bold">Rp {pajak.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="bg-on-surface p-4">
            <div className="text-surface-variant font-mono text-[10px] mb-1">TOTAL PEMBAYARAN:</div>
            <div className="font-mono font-black text-3xl text-tertiary-fixed mb-4 tracking-tighter">
              Rp {totalTagihan.toLocaleString('id-ID')}
            </div>

            {shiftAktif || !apakahOnline ? (
              <button
                onClick={bukaPembayaran}
                disabled={!keranjang.length}
                className="w-full bg-[#4ade80] text-on-surface py-3 px-4 border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all font-mono font-black text-base flex justify-between items-center disabled:opacity-50 disabled:translate-none disabled:shadow-none"
              >
                <span>PROSES BAYAR</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            ) : (
              <button
                onClick={() => aturHalaman('pengaturan')}
                className="w-full bg-error text-on-error py-3 px-4 border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-mono font-black text-sm flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">warning</span> BUKA SHIFT KASIR DULU
              </button>
            )}
          </div>
        </div>
      </aside>


      {/* ======================================================== */}
      {/* 4. MODAL PEMBAYARAN (Stitch Screen 5 - Payment Modal) */}
      {/* ======================================================== */}
      {tampilkanModalBayar && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg p-6 relative font-mono">

            <div className="flex justify-between items-center border-b-2 border-on-surface pb-3 mb-4">
              <h2 className="font-black text-lg uppercase">Metode Pembayaran</h2>
              <button onClick={() => setTampilkanModalBayar(false)} className="text-error font-bold">X</button>
            </div>

            <div className="bg-on-surface text-tertiary-fixed p-4 border-2 border-on-surface text-center mb-4">
              <div className="text-[10px] text-surface-variant font-bold mb-1">JUMLAH TAGIHAN:</div>
              <div className="text-3xl font-black tracking-tight">Rp {totalTagihan.toLocaleString('id-ID')}</div>
            </div>

            {/* Pilihan Metode */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {['tunai', 'qris', 'debit', 'credit'].map(met => (
                <button
                  key={met}
                  onClick={() => setMetodePembayaran(met)}
                  className={`border-2 border-on-surface p-2 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] klik-brutal capitalize ${metodePembayaran === met ? 'bg-primary text-on-primary' : 'bg-surface'
                    }`}
                >
                  {met}
                </button>
              ))}
            </div>

            {metodePembayaran === 'tunai' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1">UANG TUNAI DITERIMA:</label>
                  <input
                    type="number"
                    value={jumlahBayar}
                    onChange={(e) => setJumlahBayar(e.target.value)}
                    className="w-full bg-surface border-2 border-on-surface p-3 text-lg font-black tracking-widest text-center focus:outline-none"
                    placeholder="0"
                  />
                </div>

                {/* Quick Cash Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[totalTagihan, 20000, 50000, 100000].map(uang => (
                    <button
                      key={uang}
                      onClick={() => setJumlahBayar(uang.toString())}
                      className="border-2 border-on-surface bg-surface-container-low p-2 text-[10px] font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-surface-container-high klik-brutal"
                    >
                      {uang === totalTagihan ? "Uang Pas" : `Rp ${uang.toLocaleString('id-ID')}`}
                    </button>
                  ))}
                </div>

                <div className="bg-surface-container border-2 border-on-surface p-3 text-center">
                  <div className="text-[10px] text-on-surface-variant mb-1 font-bold">UANG KEMBALIAN:</div>
                  <div className="text-xl font-black text-primary">Rp {jumlahKembalian.toLocaleString('id-ID')}</div>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container border-2 border-on-surface p-6 text-center my-6 flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-5xl animate-bounce mb-3 text-primary">qr_code_2</span>
                <div className="font-bold text-xs">SILAKAN PINDAI QRIS / GESEK KARTU</div>
                <div className="text-[10px] text-on-surface-variant mt-1">Pembayaran non-tunai akan diaudit otomatis secara real-time.</div>
              </div>
            )}

            <button
              onClick={selesaikanTransaksi}
              className="w-full bg-[#4ade80] text-on-surface py-3 border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all font-black text-base mt-4"
            >
              KONFIRMASI BAYAR
            </button>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* 5. MODAL STRUK SUKSES (Stitch Screen 7 - Success Modal) */}
      {/* ======================================================== */}
      {tampilkanModalSukses && transaksiTerakhir && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm p-6 relative font-mono text-xs">

            {/* Header Sukses */}
            <div className="bg-[#4ade80] text-on-surface border-2 border-on-surface p-3 text-center mb-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="material-symbols-outlined text-3xl block mb-1">check_circle</span>
              <h2 className="font-black text-sm uppercase">Transaksi Berhasil!</h2>
              <p className="text-[9px] font-bold mt-1 flex items-center justify-center gap-1">
                {apakahOnline ? (
                  <>
                    <span className="material-symbols-outlined text-[12px] align-middle">cloud_done</span>
                    <span>Tersimpan di Cloud SQL (MySQL)</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[12px] align-middle">cloud_off</span>
                    <span>Disimpan ke Antrean Firestore (Offline)</span>
                  </>
                )}
              </p>
            </div>

            {/* Layout Struk Faux */}
            <div className="border-t-2 border-b-2 border-dashed border-on-surface py-3 my-3 space-y-2">
              <div className="text-center font-black">*** KASIR ROKU RECEIPT ***</div>
              <div className="text-center text-[10px] text-on-surface-variant">Cabang: {sesiKasir.cabang?.nama_cabang || "Pusat"}</div>
              <div className="flex justify-between text-[10px] text-on-surface-variant border-b border-on-surface/10 pb-1">
                <span>Kode: {transaksiTerakhir.kode_transaksi}</span>
                <span>Shift: #{transaksiTerakhir.shift_id}</span>
              </div>

              {/* Items Struk */}
              <div className="space-y-1 py-1">
                {transaksiTerakhir.item.map((itm, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{itm.nama_barang} x{itm.jumlah}</span>
                    <span>Rp {(itm.harga_satuan * itm.jumlah).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-on-surface/20 pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rp {hitungSubtotal().toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pajak (10%)</span>
                  <span>Rp {transaksiTerakhir.pajak.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-black text-sm border-t border-on-surface pt-1">
                  <span>TOTAL</span>
                  <span>Rp {transaksiTerakhir.total_belanja.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-on-surface/40 pt-2 text-[10px] text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Metode Bayar:</span>
                  <span className="uppercase font-bold">{transaksiTerakhir.metode_pembayaran}</span>
                </div>
                <div className="flex justify-between">
                  <span>Jumlah Bayar:</span>
                  <span>Rp {transaksiTerakhir.jumlah_bayar.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kembalian:</span>
                  <span>Rp {transaksiTerakhir.jumlah_kembalian.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="text-center font-bold text-[10px] text-on-surface-variant my-4">
              Terima Kasih Telah Berbelanja!<br />operator: {sesiKasir.kasir.nama_lengkap}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-surface-container border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-2 font-bold hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none klik-brutal"
              >
                Cetak Struk
              </button>
              <button
                onClick={() => {
                  setTampilkanModalSukses(false);
                  setTransaksiTerakhir(null);
                }}
                className="flex-1 bg-primary text-on-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] py-2 font-black hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none klik-brutal"
              >
                Selesai
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default Kasir;
