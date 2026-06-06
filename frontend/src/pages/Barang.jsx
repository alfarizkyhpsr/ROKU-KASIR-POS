import React, { useState, useEffect } from 'react';
import { useTokoState } from '../store/toko_state';
import klienApi from '../api/klien_api';
import Barcode from 'react-barcode';
import { useNotifikasi } from '../components/NotifikasiPopup';

// Helper untuk merender icon/gambar
const renderIconAtauGambar = (url, sizeClass = "text-5xl") => {
  if (!url) return <span className={`material-symbols-outlined ${sizeClass} text-outline-variant`}>inventory_2</span>;
  if (url.startsWith('http') || url.startsWith('data:')) {
    return <img src={url} alt="gambar" className="w-full h-full object-cover" />;
  }
  return <span className={`material-symbols-outlined ${sizeClass} text-outline-variant`}>{url}</span>;
};

function Barang() {
  const { tambahNotifikasi } = useNotifikasi();
  const { sesiKasir } = useTokoState();
  const [daftarBarang, setDaftarBarang] = useState([]);
  const [kataKunciCari, setKataKunciCari] = useState('');
  const [filterStatus, setFilterStatus] = useState('AKTIF');
  
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
  const [isAktif, setIsAktif] = useState(1);

  const tanganiUnggahGambar = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      tambahNotifikasi('peringatan', 'Ukuran berkas gambar terlalu besar! Maksimal adalah 5 MB.');
      return;
    }
    const pembaca = new FileReader();
    pembaca.onloadend = () => {
      // Kompres gambar via Canvas API sebelum disimpan
      // Resize ke maks 500x500 px, kualitas 0.75 → base64 < 100KB
      const img = new Image();
      img.onload = () => {
        const MAKS_DIM = 300; // max 300x300px → base64 < 40KB, aman untuk MySQL TEXT
        let { width, height } = img;
        if (width > MAKS_DIM || height > MAKS_DIM) {
          if (width > height) { height = Math.round(height * MAKS_DIM / width); width = MAKS_DIM; }
          else { width = Math.round(width * MAKS_DIM / height); height = MAKS_DIM; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const base64Terkompresi = canvas.toDataURL('image/jpeg', 0.65);
        setUrlGambar(base64Terkompresi);
      };
      img.src = pembaca.result;
    };
    pembaca.readAsDataURL(file);
  };


  // State untuk melihat Target per Cabang
  const [tampilkanModalStok, setTampilkanModalStok] = useState(false);
  const [stokBarangTerpilih, setStokBarangTerpilih] = useState([]);
  const [namaBarangStok, setNamaBarangStok] = useState('');

  // Target Harian & Progress
  const [barangKritis, setBarangKritis] = useState([]);

  // Modal State Tambahan
  const [modalHapusBarang, setModalHapusBarang] = useState({ tampil: false, id: null });
  const [modalAktifBarang, setModalAktifBarang] = useState({ tampil: false, id: null });
  const [modalTarget, setModalTarget] = useState({ tampil: false, stokId: null, nilai_baru: '' });

  const muatBarang = async () => {
    try {
      const respons = await klienApi.get('/barang');
      if (respons.data.sukses) {
        const semuaBarang = respons.data.data;
        setDaftarBarang(semuaBarang);

        // Ambil data target & terjual REAL dari API untuk semua barang aktif
        const cabangId = sesiKasir?.kasir?.cabang_id || sesiKasir?.cabang?.id;
        const semuaAktif = semuaBarang.filter(b => b.is_aktif === 1);
        const dataKritis = await Promise.all(semuaAktif.map(async (b) => {
          try {
            const res = await klienApi.get(`/barang/${b.id}/target`);
            if (res.data.sukses && res.data.data.length > 0) {
              // Ambil data stok sesuai cabang user yg login; fallback ke index 0
              const stokCabang = cabangId
                ? res.data.data.find(s => s.cabang_id === cabangId) || res.data.data[0]
                : res.data.data[0];
              return {
                ...b,
                terjual: stokCabang.terjual || 0,
                target_harian: stokCabang.target_harian || 100
              };
            }
          } catch (_) {}
          return { ...b, terjual: 0, target_harian: 100 };
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
    // Tunggu sesiKasir tersedia agar cabangId tidak null
    if (sesiKasir) {
      muatBarang();
    }
  }, [sesiKasir]);

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
    setIsAktif(1);
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
    setIsAktif(b.is_aktif !== undefined ? b.is_aktif : 1);
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
        tambahNotifikasi('sukses', 'Produk berhasil dinonaktifkan.');
        setModalHapusBarang({ tampil: false, id: null });
        muatBarang();
      }
    } catch (err) {
      tambahNotifikasi('error', 'Hanya Manajer atau Admin Utama yang diizinkan menonaktifkan produk!');
    }
  };

  const tanganiAktifkanBarang = (id) => {
    setModalAktifBarang({ tampil: true, id });
  };

  const eksekusiAktifkanBarang = async () => {
    if (!modalAktifBarang.id) return;
    try {
      const respons = await klienApi.put(`/barang/${modalAktifBarang.id}`, { is_aktif: 1 });
      if (respons.data.sukses) {
        tambahNotifikasi('sukses', 'Produk berhasil diaktifkan kembali.');
        setModalAktifBarang({ tampil: false, id: null });
        muatBarang();
      }
    } catch (err) {
      tambahNotifikasi('error', err.response?.data?.pesan || 'Gagal mengaktifkan produk. Pastikan Anda memiliki hak akses.');
    }
  };

  const simpanForm = async (e) => {
    e.preventDefault();
    if (!barcode || !namaBarang || !hargaJual || !hargaPokok) {
      tambahNotifikasi('peringatan', 'Semua kolom bertanda bintang wajib diisi.');
      return;
    }

    const payload = {
      kode_barcode: barcode,
      nama_barang: namaBarang,
      kategori,
      satuan,
      harga_jual: Number(hargaJual),
      harga_pokok: Number(hargaPokok),
      url_gambar: urlGambar,
      is_aktif: isAktif
    };

    try {
      let respons;
      if (modeEdit) {
        respons = await klienApi.put(`/barang/${idBarangTerpilih}`, payload);
      } else {
        respons = await klienApi.post('/barang', payload);
      }

      if (respons.data.sukses) {
        tambahNotifikasi('sukses', modeEdit ? 'Barang berhasil diperbarui!' : 'Barang baru berhasil ditambahkan!');
        setTampilkanModalForm(false);
        muatBarang();
      }
    } catch (err) {
      tambahNotifikasi('error', err.response?.data?.pesan || 'Akses ditolak. Fitur ini memerlukan akses Manajer/Admin.');
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
      tambahNotifikasi('peringatan', 'Target harus berupa angka lebih besar dari 0.');
      return;
    }

    try {
      const respons = await klienApi.put(`/target/${modalTarget.stokId}`, { target_baru: jumlah });
      if (respons.data.sukses) {
        tambahNotifikasi('sukses', 'Target harian berhasil diperbarui!');
        setStokBarangTerpilih(prev => prev.map(s => s.id === modalTarget.stokId ? { ...s, target_harian: jumlah } : s));
        setModalTarget({ tampil: false, stokId: null, nilai_baru: '' });
        muatBarang();
      }
    } catch (err) {
      tambahNotifikasi('error', err.response?.data?.pesan || 'Akses ditolak. Fitur ini memerlukan akses Manajer/Admin.');
    }
  };

  const barangTerfilter = daftarBarang.filter(b => {
    const cocokCari = b.nama_barang.toLowerCase().includes(kataKunciCari.toLowerCase()) || 
                      b.kode_barcode.includes(kataKunciCari);
    const cocokStatus = filterStatus === 'SEMUA' ? true : 
                        filterStatus === 'AKTIF' ? b.is_aktif === 1 : 
                        b.is_aktif === 0;
    return cocokCari && cocokStatus;
  });

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
        <div className="w-full lg:w-[380px] bg-[#e0d2ff] border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col">
          <div className="flex items-center gap-2 font-black border-b-2 border-on-surface px-4 py-3 bg-[#4f378a] text-white uppercase text-xs tracking-widest">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>track_changes</span>
            PROGRESS TARGET HARIAN
          </div>
          <div className="p-4 space-y-3 flex-1">
            {barangKritis.length > 0 ? barangKritis.map(b => {
              const persen = Math.min(Math.round((b.terjual / b.target_harian) * 100), 100);
              const warnaBg = persen >= 100 ? '#4ade80' : persen >= 60 ? '#ffdf93' : '#ffdad6';
              const warnaBar = persen >= 100 ? '#16a34a' : persen >= 60 ? '#d97706' : '#ba1a1a';
              return (
                <div key={b.id} className="bg-white/70 border-2 border-on-surface p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-black text-[10px] uppercase truncate max-w-[160px]">{b.nama_barang}</span>
                    <span
                      className="font-black text-[10px] px-1.5 py-0.5 border border-on-surface"
                      style={{ backgroundColor: warnaBg }}
                    >
                      {b.terjual} / {b.target_harian}
                    </span>
                  </div>
                  <div className="h-3 bg-surface border-2 border-on-surface overflow-hidden">
                    <div
                      className="h-full progress-brutal"
                      style={{ width: `${persen}%`, backgroundColor: warnaBar }}
                    />
                  </div>
                  <div className="text-[9px] font-bold mt-0.5 text-right" style={{ color: warnaBar }}>
                    {persen}% tercapai
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-[#4f378a]">
                <span className="material-symbols-outlined text-4xl">bar_chart</span>
                <span className="text-[10px] font-bold text-center uppercase">Belum ada data target penjualan yang diset.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 2. TABLE KELOLA BARANG */}
      <div className="bg-surface border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        
        {/* Search Header */}
        <div className="p-4 border-b-2 border-on-surface bg-surface-container flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="font-black text-sm uppercase">DAFTAR BARANG ({barangTerfilter.length})</div>
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#e0d2ff] border-2 border-on-surface px-3 py-1 font-mono text-xs focus:outline-none uppercase font-bold cursor-pointer"
            >
              <option value="AKTIF">Status: Aktif</option>
              <option value="NONAKTIF">Status: Nonaktif</option>
              <option value="SEMUA">Status: Semua</option>
            </select>
            <input 
              value={kataKunciCari}
              onChange={(e) => setKataKunciCari(e.target.value)}
              placeholder="Cari nama barang / barcode..."
              className="bg-surface border-2 border-on-surface px-3 py-1 font-mono text-xs focus:outline-none w-full md:w-64 uppercase"
            />
          </div>
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
                    {(sesiKasir?.kasir?.peran === 'admin' || sesiKasir?.kasir?.peran === 'manajer') && (
                      <>
                        <button 
                          onClick={() => bukaEditBarang(b)}
                          className="bg-surface border border-on-surface p-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none klik-brutal text-primary"
                        >
                          <span className="material-symbols-outlined block text-xs">edit</span>
                        </button>
                        {b.is_aktif === 1 ? (
                          <button 
                            onClick={() => tanganiHapusBarang(b.id)}
                            className="bg-[#ffdad6] border border-on-surface p-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none klik-brutal text-error"
                            title="Nonaktifkan Barang"
                          >
                            <span className="material-symbols-outlined block text-xs">delete</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => tanganiAktifkanBarang(b.id)}
                            className="bg-[#d1fae5] border border-on-surface p-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none klik-brutal text-[#166534]"
                            title="Aktifkan Kembali Barang"
                          >
                            <span className="material-symbols-outlined block text-xs">refresh</span>
                          </button>
                        )}
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


      {/* 3. MODAL TAMBAH/EDIT BARANG (CRUD MODAL) */}
      
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

            {/* Status Aktif/Nonaktif (Hanya muncul jika mode edit) */}
            {modeEdit && (
              <div className="mt-4 flex items-center gap-3 bg-surface-container-low p-3 border-2 border-on-surface">
                <label className="font-bold uppercase text-[10px] flex-1">Status Barang (Aktif/Nonaktif)</label>
                <button
                  type="button"
                  onClick={() => setIsAktif(isAktif === 1 ? 0 : 1)}
                  className={`relative w-12 h-6 rounded-full border-2 border-on-surface transition-colors ${isAktif === 1 ? 'bg-[#4ade80]' : 'bg-surface-container-highest'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-on-surface rounded-full transition-transform ${isAktif === 1 ? 'left-6' : 'left-0.5'}`}></div>
                </button>
                <span className={`font-black text-xs ${isAktif === 1 ? 'text-[#166534]' : 'text-on-surface-variant'}`}>
                  {isAktif === 1 ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#4ade80] text-on-surface py-3 border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all font-black text-xs mt-4 uppercase"
            >
              SIMPAN BARANG
            </button>
          </form>
        </div>
      )}

      
      {/* 4. MODAL DETAIL TARGET PER CABANG */}
      
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
                    {(sesiKasir?.kasir?.peran === 'admin' ||
                      (sesiKasir?.kasir?.peran === 'manajer' && s.cabang_id === (sesiKasir?.kasir?.cabang_id || sesiKasir?.cabang?.id))) && (
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

      {/* 5. MODAL KONFIRMASI HAPUS BARANG */}

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

      {modalAktifBarang.tampil && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-[#16a34a] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm p-6 relative font-mono text-center">
            <span className="material-symbols-outlined text-5xl text-[#16a34a] mb-2">check_circle</span>
            <h2 className="font-black text-lg uppercase mb-4">Aktifkan Barang?</h2>
            <p className="text-sm mb-6">Barang yang dinonaktifkan akan kembali muncul di katalog. Lanjutkan?</p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setModalAktifBarang({ tampil: false, id: null })}
                className="flex-1 bg-surface-container-highest text-on-surface font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
              >
                Batal
              </button>
              <button 
                onClick={eksekusiAktifkanBarang}
                className="flex-1 bg-[#16a34a] text-white font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
              >
                Ya, Aktifkan
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 6. MODAL ATUR TARGET HARIAN */}

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
