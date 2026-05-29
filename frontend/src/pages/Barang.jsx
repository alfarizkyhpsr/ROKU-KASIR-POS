import React, { useState, useEffect } from 'react';
import { useTokoState } from '../store/toko_state';
import klienApi from '../api/klien_api';
import Barcode from 'react-barcode';

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

function Barang() {
  const { sesiKasir } = useTokoState();
  const [daftarBarang, setDaftarBarang] = useState([]);
  const [kataKunciCari, setKataKunciCari] = useState('');
  
  // State untuk form tambah/edit modal
  const [tampilkanModalForm, setTampilkanModalForm] = useState(false);
  const [modeEdit, setModeEdit] = useState(false);
  const [idBarangTerpilih, setIdBarangTerpilih] = useState(null);

  // Field Form Barang
  const [barcode, setBarcode] = useState('');
  const [namaBarang, setNamaBarang] = useState('');
  const [kategori, setKategori] = useState('MAKANAN');
  const [satuan, setSatuan] = useState('pcs');
  const [hargaJual, setHargaJual] = useState('');
  const [hargaPokok, setHargaPokok] = useState('');
  const [urlGambar, setUrlGambar] = useState('inventory_2');
  const [tipeSumberGambar, setTipeSumberGambar] = useState('icon'); // 'icon' | 'file'

  const tanganiUnggahGambar = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Ukuran berkas gambar terlalu besar! Maksimal adalah 1 MB.");
        return;
      }
      const pembaca = new FileReader();
      pembaca.onloadend = () => {
        setUrlGambar(pembaca.result);
      };
      pembaca.readAsDataURL(file);
    }
  };

  // State untuk melihat Target per Cabang
  const [tampilkanModalStok, setTampilkanModalStok] = useState(false);
  const [stokBarangTerpilih, setStokBarangTerpilih] = useState([]);
  const [namaBarangStok, setNamaBarangStok] = useState('');

  // Target Harian & Progress
  const [barangKritis, setBarangKritis] = useState([]);

  // Modal State Tambahan
  const [modalHapusBarang, setModalHapusBarang] = useState({ tampil: false, id: null });
  const [modalTarget, setModalTarget] = useState({ tampil: false, stokId: null, nilai_baru: '' });

  const muatBarang = async () => {
    try {
      const respons = await klienApi.get('/barang');
      if (respons.data.sukses) {
        setDaftarBarang(respons.data.data);
        
        // Pilih beberapa barang secara acak untuk showcase progress target
        const dataKritis = respons.data.data.slice(0, 3).map(b => ({
          ...b,
          terjual: Math.floor(Math.random() * 45) + 5,
          target_harian: 50
        }));
        setBarangKritis(dataKritis);
      }
    } catch (e) {
      console.error("Gagal mengambil data barang:", e);
      // Fallback data
      setDaftarBarang([
        { id: 1, kode_barcode: "8991001", nama_barang: "ES KOPI SUSU AREN", kategori: "MINUMAN", satuan: "gelas", harga_jual: 18000, harga_pokok: 8000, url_gambar: "local_cafe", is_aktif: 1 },
        { id: 2, kode_barcode: "8991002", nama_barang: "BUTTER CROISSANT", kategori: "MAKANAN", satuan: "pcs", harga_jual: 22000, harga_pokok: 10000, url_gambar: "bakery_dining", is_aktif: 1 }
      ]);
    }
  };

  useEffect(() => {
    muatBarang();
  }, []);

  const bukaTambahBarang = () => {
    setModeEdit(false);
    setIdBarangTerpilih(null);
    setBarcode('');
    setNamaBarang('');
    setKategori('MAKANAN');
    setSatuan('pcs');
    setHargaJual('');
    setHargaPokok('');
    setUrlGambar('inventory_2');
    setTipeSumberGambar('icon');
    setTampilkanModalForm(true);
  };

  const bukaEditBarang = (b) => {
    setModeEdit(true);
    setIdBarangTerpilih(b.id);
    setBarcode(b.kode_barcode);
    setNamaBarang(b.nama_barang);
    setKategori(b.kategori);
    setSatuan(b.satuan);
    setHargaJual(b.harga_jual.toString());
    setHargaPokok(b.harga_pokok?.toString() || '');
    setUrlGambar(b.url_gambar || 'inventory_2');
    if (b.url_gambar && (b.url_gambar.startsWith('http') || b.url_gambar.startsWith('data:'))) {
      setTipeSumberGambar('file');
    } else {
      setTipeSumberGambar('icon');
    }
    setTampilkanModalForm(true);
  };

  const tanganiHapusBarang = (id) => {
    setModalHapusBarang({ tampil: true, id });
  };

  const eksekusiHapusBarang = async () => {
    if (!modalHapusBarang.id) return;
    try {
      const respons = await klienApi.delete(`/barang/${modalHapusBarang.id}`);
      if (respons.data.sukses) {
        setModalHapusBarang({ tampil: false, id: null });
        muatBarang();
      }
    } catch (err) {
      alert("Hanya Manajer atau Admin Utama yang diizinkan menonaktifkan produk!");
    }
  };

  const simpanForm = async (e) => {
    e.preventDefault();
    if (!barcode || !namaBarang || !hargaJual || !hargaPokok) {
      alert("Semua kolom bertanda bintang wajib diisi.");
      return;
    }

    const payload = {
      kode_barcode: barcode,
      nama_barang: namaBarang,
      kategori,
      satuan,
      harga_jual: Number(hargaJual),
      harga_pokok: Number(hargaPokok),
      url_gambar: urlGambar
    };

    try {
      let respons;
      if (modeEdit) {
        respons = await klienApi.put(`/barang/${idBarangTerpilih}`, payload);
      } else {
        respons = await klienApi.post('/barang', payload);
      }

      if (respons.data.sukses) {
        alert(modeEdit ? "Barang berhasil diperbarui!" : "Barang baru berhasil ditambahkan!");
        setTampilkanModalForm(false);
        muatBarang();
      }
    } catch (err) {
      alert(err.response?.data?.pesan || "Akses ditolak. Fitur ini memerlukan akses Manajer/Admin.");
    }
  };

  const lihatStokCabang = async (barang) => {
    setNamaBarangStok(barang.nama_barang);
    try {
      const respons = await klienApi.get(`/barang/${barang.id}/target`);
      if (respons.data.sukses) {
        setStokBarangTerpilih(respons.data.data);
      }
    } catch (e) {
      // Fallback
      setStokBarangTerpilih([
        { id: 1, nama_cabang: "Toko Roti & Kopi Utama", kota: "Bandung", terjual: 10, target_harian: 100 },
        { id: 2, nama_cabang: "Toko Roti & Kopi Kemang", kota: "Jakarta", terjual: 5, target_harian: 50 }
      ]);
    }
    setTampilkanModalStok(true);
  };

  const tambahStokCabang = (stokId) => {
    setModalTarget({ tampil: true, stokId, nilai_baru: '' });
  };

  const eksekusiTambahTarget = async (e) => {
    e.preventDefault();
    const jumlah = parseInt(modalTarget.nilai_baru, 10);
    if (isNaN(jumlah) || jumlah <= 0) {
      alert("Target harus berupa angka lebih besar dari 0.");
      return;
    }

    try {
      const respons = await klienApi.put(`/target/${modalTarget.stokId}`, { target_baru: jumlah });
      if (respons.data.sukses) {
        // Update local state
        setStokBarangTerpilih(prev => prev.map(s => s.id === modalTarget.stokId ? { ...s, target_harian: jumlah } : s));
        setModalTarget({ tampil: false, stokId: null, nilai_baru: '' });
        muatBarang(); // Refresh master list in background
      }
    } catch (err) {
      alert(err.response?.data?.pesan || "Akses ditolak. Fitur ini memerlukan akses Manajer/Admin.");
    }
  };

  const barangTerfilter = daftarBarang.filter(b => 
    b.nama_barang.toLowerCase().includes(kataKunciCari.toLowerCase()) || 
    b.kode_barcode.includes(kataKunciCari)
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-on-surface">
      
      {/* 1. ROW JUDUL & ALARM STOK MINIMUM */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        
        {/* Judul & Pengantar */}
        <div className="flex-1">
          <h1 className="text-3xl font-black font-display uppercase tracking-tight">Manajemen Katalog</h1>
          <p className="text-on-surface-variant mt-1">Kelola master data barang, barcode, HPP, harga jual, dan sebaran stok per cabang secara real-time.</p>
          
          <button 
            onClick={bukaTambahBarang}
            className="bg-[#4f378a] text-[#ffffff] font-bold border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all px-4 py-2 mt-4 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add_box</span>
            TAMBAH BARANG BARU
          </button>
        </div>

        {/* 15.7 Progress Target Harian */}
        <div className="w-full lg:w-[350px] bg-[#e0d2ff] text-tertiary-fixed border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
          <div className="flex items-center gap-2 font-black border-b border-tertiary-fixed/20 pb-2 mb-2 uppercase">
            <span className="material-symbols-outlined text-base">track_changes</span>
            PROGRESS TARGET HARIAN
          </div>
          <div className="space-y-1.5">
            {barangKritis.map(b => (
              <div key={b.id} className="flex justify-between items-center text-[10px] bg-white/60 p-1 border border-tertiary-fixed/10">
                <span className="font-bold">{b.nama_barang}</span>
                <span className="bg-[#4ade80] text-on-surface font-black px-1.5 py-0.2 border border-on-surface">
                  {b.terjual} / {b.target_harian}
                </span>
              </div>
            ))}
            {barangKritis.length === 0 && (
              <div className="text-[10px] text-center italic">Belum ada data target penjualan yang diset.</div>
            )}
          </div>
        </div>

      </div>

      {/* 2. TABLE KELOLA BARANG */}
      <div className="bg-surface border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        
        {/* Search Header */}
        <div className="p-4 border-b-2 border-on-surface bg-surface-container flex justify-between items-center">
          <div className="font-black text-sm uppercase">DAFTAR BARANG ({barangTerfilter.length})</div>
          <input 
            value={kataKunciCari}
            onChange={(e) => setKataKunciCari(e.target.value)}
            placeholder="Cari nama barang / barcode..."
            className="bg-surface border-2 border-on-surface px-3 py-1 font-mono text-xs focus:outline-none w-64 uppercase"
          />
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b-2 border-on-surface font-black">
                <th className="p-3 border-r border-on-surface">Gambar</th>
                <th className="p-3 border-r border-on-surface">Barcode</th>
                <th className="p-3 border-r border-on-surface">Nama Barang</th>
                <th className="p-3 border-r border-on-surface">Kategori</th>
                <th className="p-3 border-r border-on-surface">Satuan</th>
                <th className="p-3 border-r border-on-surface">Harga Pokok (HPP)</th>
                <th className="p-3 border-r border-on-surface">Harga Jual</th>
                <th className="p-3 border-r border-on-surface">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {barangTerfilter.map(b => (
                <tr key={b.id} className="border-b border-on-surface hover:bg-surface-container-low/50 transition-colors">
                  <td className="p-3 border-r border-on-surface text-center">
                    <div className="w-16 h-16 bg-secondary-container border-2 border-on-surface flex items-center justify-center mx-auto overflow-hidden">
                      {renderIconAtauGambar(b.url_gambar, "text-3xl")}
                    </div>
                  </td>
                  <td className="p-3 border-r border-on-surface text-center">
                    <div className="inline-block bg-white px-2 py-1 border border-on-surface/20">
                      <Barcode 
                        value={b.kode_barcode} 
                        width={1.2} 
                        height={35} 
                        fontSize={10} 
                        margin={0} 
                        background="transparent" 
                        displayValue={true}
                      />
                    </div>
                  </td>
                  <td className="p-3 border-r border-on-surface font-black uppercase">{b.nama_barang}</td>
                  <td className="p-3 border-r border-on-surface">{b.kategori}</td>
                  <td className="p-3 border-r border-on-surface uppercase">{b.satuan}</td>
                  <td className="p-3 border-r border-on-surface font-bold text-on-surface-variant">
                    Rp {b.harga_pokok?.toLocaleString('id-ID') || '0'}
                  </td>
                  <td className="p-3 border-r border-on-surface font-bold text-primary">
                    Rp {b.harga_jual.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 border-r border-on-surface">
                    <span className={`px-1.5 py-0.5 font-bold border text-[9px] ${
                      b.is_aktif === 1 ? 'bg-[#4ade80]/20 text-on-surface border-[#4ade80]' : 'bg-error/20 text-error border-error'
                    }`}>
                      {b.is_aktif === 1 ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </td>
                  <td className="p-3 flex justify-center gap-1.5">
                    <button 
                      onClick={() => lihatStokCabang(b)}
                      className="bg-[#e0d2ff] border border-on-surface p-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none klik-brutal"
                      title="Atur Target Harian"
                    >
                      <span className="material-symbols-outlined block text-xs">track_changes</span>
                    </button>
                    {(sesiKasir.kasir.peran === 'admin' || sesiKasir.kasir.peran === 'manajer') && (
                      <>
                        <button 
                          onClick={() => bukaEditBarang(b)}
                          className="bg-surface border border-on-surface p-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none klik-brutal text-primary"
                        >
                          <span className="material-symbols-outlined block text-xs">edit</span>
                        </button>
                        <button 
                          onClick={() => tanganiHapusBarang(b.id)}
                          className="bg-[#ffdad6] border border-on-surface p-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none klik-brutal text-error"
                        >
                          <span className="material-symbols-outlined block text-xs">delete</span>
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {barangTerfilter.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-8 text-center italic text-on-surface-variant bg-surface-container-low">
                    Belum ada data barang dalam katalog.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MODAL TAMBAH/EDIT BARANG (CRUD MODAL) */}
      {/* ======================================================== */}
      {tampilkanModalForm && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <form onSubmit={simpanForm} className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md p-6 relative font-mono">
            <div className="flex justify-between items-center border-b-2 border-on-surface pb-3 mb-4">
              <h2 className="font-black text-sm uppercase">{modeEdit ? 'Edit Produk Barang' : 'Tambah Barang Baru'}</h2>
              <button type="button" onClick={() => setTampilkanModalForm(false)} className="text-error font-bold">X</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold mb-0.5">KODE BARCODE *</label>
                <input 
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full bg-surface border-2 border-on-surface p-2 text-xs focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-0.5">NAMA PRODUK BARANG *</label>
                <input 
                  type="text"
                  value={namaBarang}
                  onChange={(e) => setNamaBarang(e.target.value)}
                  className="w-full bg-surface border-2 border-on-surface p-2 text-xs focus:outline-none uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold mb-0.5">KATEGORI</label>
                  <select 
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full bg-surface border-2 border-on-surface p-2 text-xs focus:outline-none"
                  >
                    <option value="MAKANAN">MAKANAN</option>
                    <option value="MINUMAN">MINUMAN</option>
                    <option value="UMUM">UMUM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-0.5">SATUAN</label>
                  <input 
                    type="text"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    className="w-full bg-surface border-2 border-on-surface p-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold mb-0.5">HARGA POKOK (HPP) *</label>
                  <input 
                    type="number"
                    value={hargaPokok}
                    onChange={(e) => setHargaPokok(e.target.value)}
                    className="w-full bg-surface border-2 border-on-surface p-2 text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-0.5">HARGA JUAL *</label>
                  <input 
                    type="number"
                    value={hargaJual}
                    onChange={(e) => setHargaJual(e.target.value)}
                    className="w-full bg-surface border-2 border-on-surface p-2 text-xs focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1">SUMBER GAMBAR / ICON *</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTipeSumberGambar('icon');
                      setUrlGambar('inventory_2');
                    }}
                    className={`border-2 border-on-surface p-1 text-[10px] font-bold transition-all ${
                      tipeSumberGambar === 'icon' ? 'bg-primary text-on-primary shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface text-on-surface'
                    }`}
                  >
                    SIMBOL ICON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipeSumberGambar('file');
                      setUrlGambar('');
                    }}
                    className={`border-2 border-on-surface p-1 text-[10px] font-bold transition-all ${
                      tipeSumberGambar === 'file' ? 'bg-primary text-on-primary shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface text-on-surface'
                    }`}
                  >
                    UNGGAH FILE GAMBAR
                  </button>
                </div>

                {tipeSumberGambar === 'icon' ? (
                  <div>
                    <label className="block text-[8px] font-bold text-on-surface-variant mb-0.5">NAMA SIMBOL ICON (misal: local_cafe, bakery_dining, inventory_2)</label>
                    <input 
                      type="text"
                      value={urlGambar}
                      onChange={(e) => setUrlGambar(e.target.value)}
                      className="w-full bg-surface border-2 border-on-surface p-2 text-xs focus:outline-none"
                      placeholder="inventory_2"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-[8px] font-bold text-on-surface-variant mb-0.5">UNGGAH BERKAS GAMBAR (MAKS 1MB)</label>
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={tanganiUnggahGambar}
                      className="w-full bg-surface border-2 border-on-surface p-1.5 text-xs focus:outline-none"
                    />
                    {urlGambar && urlGambar.startsWith('data:') && (
                      <div className="mt-2 flex items-center gap-3 p-2 border-2 border-dashed border-on-surface bg-surface-container-low">
                        <div className="w-12 h-12 border-2 border-on-surface overflow-hidden bg-white flex items-center justify-center">
                          <img src={urlGambar} alt="Pratinjau" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-bold font-mono">GAMBAR BERHASIL DIMUAT</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#4ade80] text-on-surface py-3 border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all font-black text-xs mt-4 uppercase"
            >
              SIMPAN BARANG
            </button>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL DETAIL TARGET PER CABANG */}
      {/* ======================================================== */}
      {tampilkanModalStok && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md p-6 relative font-mono">
            <div className="flex justify-between items-center border-b-2 border-on-surface pb-3 mb-4">
              <h2 className="font-black text-sm uppercase">Target Penjualan Harian</h2>
              <button onClick={() => setTampilkanModalStok(false)} className="text-error font-bold">X</button>
            </div>

            <div className="bg-on-surface text-tertiary-fixed p-3 border-2 border-on-surface text-center mb-4 font-black uppercase text-[10px]">
              Produk: {namaBarangStok}
            </div>

            <div className="space-y-2">
              {stokBarangTerpilih.map(s => (
                <div key={s.id} className="flex justify-between items-center p-3 border-2 border-on-surface bg-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div>
                    <div className="font-bold text-xs uppercase leading-tight">{s.nama_cabang}</div>
                    <div className="text-[9px] text-on-surface-variant uppercase mt-0.5">{s.kota}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-black text-base text-primary">
                        {s.terjual} <span className="text-[10px] font-bold text-on-surface-variant font-sans">/ {s.target_harian}</span>
                      </div>
                      <div className="text-[8px] text-on-surface-variant mt-0.5 font-bold uppercase">Terjual</div>
                    </div>
                    {(sesiKasir.kasir.peran === 'admin' || sesiKasir.kasir.peran === 'manajer') && (
                      <button 
                        onClick={() => tambahStokCabang(s.id)}
                        className="bg-[#4f378a] border border-on-surface p-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none klik-brutal text-[#ffffff]"
                        title="Atur Target"
                      >
                        <span className="material-symbols-outlined block text-xs">edit</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI HAPUS BARANG */}
      {/* ======================================================== */}
      {modalHapusBarang.tampil && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-error shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm p-6 relative font-mono text-center">
            <span className="material-symbols-outlined text-5xl text-error mb-2">warning</span>
            <h2 className="font-black text-lg uppercase mb-4">Nonaktifkan Barang?</h2>
            <p className="text-sm mb-6">Barang ini tidak akan muncul lagi di katalog. Anda yakin?</p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setModalHapusBarang({ tampil: false, id: null })}
                className="flex-1 bg-surface-container-highest text-on-surface font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
              >
                Batal
              </button>
              <button 
                onClick={eksekusiHapusBarang}
                className="flex-1 bg-error text-on-error font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
              >
                Ya, Nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL ATUR TARGET HARIAN */}
      {/* ======================================================== */}
      {modalTarget.tampil && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm p-6 relative font-mono">
            <h2 className="font-black text-lg uppercase mb-4 border-b-2 border-on-surface pb-2">Atur Target Harian</h2>
            
            <form onSubmit={eksekusiTambahTarget}>
              <div className="mb-4">
                <label className="block font-bold mb-1 uppercase text-[10px]">Masukkan Target Baru (Angka):</label>
                <input 
                  type="number"
                  min="1"
                  value={modalTarget.nilai_baru}
                  onChange={(e) => setModalTarget({...modalTarget, nilai_baru: e.target.value})}
                  className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none font-bold text-center"
                  placeholder="Cth: 150"
                  required
                  autoFocus
                />
              </div>
              
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setModalTarget({ tampil: false, stokId: null, nilai_baru: '' })}
                  className="flex-1 bg-surface-container-highest text-on-surface font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase text-xs"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-[#4ade80] text-on-surface font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase text-xs"
                >
                  Simpan Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Barang;
