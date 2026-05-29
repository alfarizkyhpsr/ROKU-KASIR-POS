import React, { useState, useEffect } from 'react';
import { useTokoState } from '../store/toko_state';
import klienApi from '../api/klien_api';

function ManajemenSDM() {
  const { sesiKasir, perbaruiSesiCabang } = useTokoState();
  const isAdmin = sesiKasir.kasir.peran === 'admin';
  const isManager = sesiKasir.kasir.peran === 'manajer';

  const [tabAktif, setTabAktif] = useState(isAdmin ? 'cabang' : 'kasir');

  // Data State
  const [daftarCabang, setDaftarCabang] = useState([]);
  const [daftarKasir, setDaftarKasir] = useState([]);

  // Modal State
  const [modalCabang, setModalCabang] = useState(false);
  const [modalKasir, setModalKasir] = useState(false);
  const [modalEditCabang, setModalEditCabang] = useState(false);
  const [modalEditKasir, setModalEditKasir] = useState(false);

  // Form State
  const [formCabang, setFormCabang] = useState({ nama_cabang: '', kode_cabang: '', kota: '' });
  const [formEditCabang, setFormEditCabang] = useState({ id: null, nama_cabang: '', kode_cabang: '', kota: '' });
  const [formKasir, setFormKasir] = useState({ nama_pengguna: '', kata_sandi: '', pin: '', nama_lengkap: '', peran: 'kasir', cabang_id: isAdmin ? '' : sesiKasir.kasir.cabang_id });
  const [formEditKasir, setFormEditKasir] = useState({ id: null, nama_pengguna: '', kata_sandi: '', pin: '', nama_lengkap: '', peran: 'kasir', cabang_id: '' });
  const [modalKonfirmasiHapus, setModalKonfirmasiHapus] = useState({ tampil: false, id: null });
  const [modalKonfirmasiHapusCabang, setModalKonfirmasiHapusCabang] = useState({ tampil: false, id: null });

  // Fetch Data
  const muatData = async () => {
    try {
      if (isAdmin) {
        const resCabang = await klienApi.get('/cabang');
        if (resCabang.data.sukses) setDaftarCabang(resCabang.data.data);
      }
      const resKasir = await klienApi.get('/kasir');
      if (resKasir.data.sukses) setDaftarKasir(resKasir.data.data);
    } catch (e) {
      console.error("Gagal memuat data SDM", e);
    }
  };

  useEffect(() => {
    muatData();
  }, []);

  // --- CRUD CABANG ---
  const tanganiTambahCabang = () => {
    setFormCabang({ nama_cabang: '', kode_cabang: '', kota: '' });
    setModalCabang(true);
  };

  const simpanCabang = async (e) => {
    e.preventDefault();
    if (!formCabang.nama_cabang || !formCabang.kode_cabang || !formCabang.kota) {
      alert("Semua field cabang wajib diisi.");
      return;
    }

    try {
      const res = await klienApi.post('/cabang', formCabang);
      if (res.data.sukses) {
        muatData();
        setModalCabang(false);
      }
    } catch (e) {
      alert("Gagal menambah cabang.");
    }
  };

  const tanganiEditCabang = (cabang) => {
    setFormEditCabang(cabang);
    setModalEditCabang(true);
  };

  const simpanEditCabang = async (e) => {
    e.preventDefault();
    if (!formEditCabang.nama_cabang || !formEditCabang.kode_cabang || !formEditCabang.kota) {
      alert("Semua field cabang wajib diisi.");
      return;
    }

    try {
      const res = await klienApi.put(`/cabang/${formEditCabang.id}`, {
        nama_cabang: formEditCabang.nama_cabang,
        kode_cabang: formEditCabang.kode_cabang,
        kota: formEditCabang.kota
      });
      if (res.data.sukses) {
        // Jika cabang yang diedit adalah cabang user yang sedang login, perbarui navbar
        perbaruiSesiCabang({
          id: formEditCabang.id,
          nama_cabang: formEditCabang.nama_cabang,
          kode_cabang: formEditCabang.kode_cabang,
          kota: formEditCabang.kota
        });
        muatData();
        setModalEditCabang(false);
      }
    } catch (e) {
      alert("Gagal memperbarui cabang.");
    }
  };

  const tanganiHapusCabang = (id) => {
    setModalKonfirmasiHapusCabang({ tampil: true, id });
  };

  const eksekusiHapusCabang = async (permanen = false) => {
    if (!modalKonfirmasiHapusCabang.id) return;
    try {
      await klienApi.delete(`/cabang/${modalKonfirmasiHapusCabang.id}?permanen=${permanen}`);
      setModalKonfirmasiHapusCabang({ tampil: false, id: null });
      muatData();
    } catch (e) {
      alert("Gagal menghapus cabang.");
    }
  };

  // --- CRUD KASIR ---
  const tanganiTambahKasir = () => {
    setFormKasir({
      nama_pengguna: '', kata_sandi: '', pin: '', nama_lengkap: '',
      peran: 'kasir', cabang_id: isAdmin ? '' : sesiKasir.kasir.cabang_id
    });
    setModalKasir(true);
  };

  const simpanKasir = async (e) => {
    e.preventDefault();
    if (!formKasir.nama_pengguna || !formKasir.kata_sandi || !formKasir.pin || !formKasir.nama_lengkap || !formKasir.cabang_id) {
      alert("Semua field kasir wajib diisi.");
      return;
    }

    try {
      const res = await klienApi.post('/kasir', formKasir);
      if (res.data.sukses) {
        muatData();
        setModalKasir(false);
      }
    } catch (e) {
      alert(e.response?.data?.pesan || "Gagal menambah akun.");
    }
  };

  const tanganiEditKasir = (kasir) => {
    setFormEditKasir({
      ...kasir,
      kata_sandi: '', // Kosongkan kata sandi untuk diedit jika perlu
    });
    setModalEditKasir(true);
  };

  const simpanEditKasir = async (e) => {
    e.preventDefault();
    if (!formEditKasir.nama_pengguna || !formEditKasir.pin || !formEditKasir.nama_lengkap || !formEditKasir.cabang_id) {
      alert("Semua field bertanda bintang wajib diisi.");
      return;
    }

    try {
      // payload bisa tanpa kata sandi
      const payload = { ...formEditKasir };
      if (!payload.kata_sandi) {
        delete payload.kata_sandi;
      }

      const res = await klienApi.put(`/kasir/${formEditKasir.id}`, payload);
      if (res.data.sukses) {
        muatData();
        setModalEditKasir(false);
      }
    } catch (e) {
      alert(e.response?.data?.pesan || "Gagal memperbarui akun.");
    }
  };

  const tanganiHapusKasir = (id) => {
    setModalKonfirmasiHapus({ tampil: true, id });
  };

  const eksekusiHapusKasir = async (permanen = false) => {
    if (!modalKonfirmasiHapus.id) return;
    try {
      await klienApi.delete(`/kasir/${modalKonfirmasiHapus.id}?permanen=${permanen}`);
      setModalKonfirmasiHapus({ tampil: false, id: null });
      muatData();
    } catch (e) {
      alert("Gagal menghapus akun.");
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-on-surface">
      <h1 className="text-3xl font-black font-display uppercase tracking-tight mb-6">Manajemen SDM</h1>

      {/* TABS */}
      <div className="flex gap-4 mb-6 border-b-4 border-on-surface pb-2">
        {isAdmin && (
          <button
            onClick={() => setTabAktif('cabang')}
            className={`px-4 py-2 font-black border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase transition-all ${tabAktif === 'cabang' ? 'bg-[#ffdf93] text-on-surface' : 'bg-surface hover:-translate-y-1'}`}
          >
            Kelola Cabang
          </button>
        )}
        <button
          onClick={() => setTabAktif('kasir')}
          className={`px-4 py-2 font-black border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase transition-all ${tabAktif === 'kasir' ? 'bg-[#e0d2ff] text-on-surface' : 'bg-surface hover:-translate-y-1'}`}
        >
          Kelola Karyawan & Kasir
        </button>
      </div>

      {/* TAB CABANG */}
      {tabAktif === 'cabang' && isAdmin && (
        <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-8">
          <div className="flex justify-between items-center mb-6 border-b-2 border-on-surface pb-4">
            <h2 className="text-lg font-black uppercase">Daftar Cabang Aktif</h2>
            <button
              onClick={tanganiTambahCabang}
              className="bg-[#4ade80] text-on-surface font-black border-2 border-on-surface px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              + TAMBAH CABANG
            </button>
          </div>

          <table className="w-full text-left border-collapse border-2 border-on-surface">
            <thead>
              <tr className="bg-[#ffdf93] border-b-2 border-on-surface font-black">
                <th className="p-3 border-r-2 border-on-surface">ID</th>
                <th className="p-3 border-r-2 border-on-surface">Kode</th>
                <th className="p-3 border-r-2 border-on-surface">Nama Cabang</th>
                <th className="p-3 border-r-2 border-on-surface">Kota</th>
                <th className="p-3 border-r-2 border-on-surface">Manajer</th>
                <th className="p-3 border-r-2 border-on-surface text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {daftarCabang.map(c => (
                <tr key={c.id} className="border-b-2 border-on-surface bg-surface hover:bg-surface-container-high transition-colors">
                  <td className="p-3 border-r-2 border-on-surface font-black">{c.id}</td>
                  <td className="p-3 border-r-2 border-on-surface">{c.kode_cabang}</td>
                  <td className="p-3 border-r-2 border-on-surface uppercase font-bold">{c.nama_cabang}</td>
                  <td className="p-3 border-r-2 border-on-surface">{c.kota}</td>
                  <td className="p-3 border-r-2 border-on-surface italic">{c.nama_manajer || '-'}</td>
                  <td className="p-3 border-r-2 border-on-surface text-center flex justify-center gap-2">
                    <button
                      onClick={() => tanganiEditCabang(c)}
                      className="bg-[#4f378a] border border-on-surface p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none text-[#ffffff]"
                    >
                      <span className="material-symbols-outlined text-sm block">edit</span>
                    </button>
                    <button
                      onClick={() => tanganiHapusCabang(c.id)}
                      className="bg-[#ffdad6] border border-on-surface p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                    >
                      <span className="material-symbols-outlined text-sm block text-[#93000a]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB KASIR */}
      {tabAktif === 'kasir' && (
        <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
          <div className="flex justify-between items-center mb-6 border-b-2 border-on-surface pb-4">
            <h2 className="text-lg font-black uppercase">Daftar Akun SDM</h2>
            <button
              onClick={tanganiTambahKasir}
              className="bg-[#4ade80] text-on-surface font-black border-2 border-on-surface px-4 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              + TAMBAH KARYAWAN
            </button>
          </div>

          <table className="w-full text-left border-collapse border-2 border-on-surface">
            <thead>
              <tr className="bg-[#e0d2ff] border-b-2 border-on-surface font-black">
                <th className="p-3 border-r-2 border-on-surface">Nama Lengkap</th>
                <th className="p-3 border-r-2 border-on-surface">Username</th>
                <th className="p-3 border-r-2 border-on-surface">Peran</th>
                <th className="p-3 border-r-2 border-on-surface">Cabang Penempatan</th>
                <th className="p-3 border-r-2 border-on-surface">Status</th>
                <th className="p-3 border-r-2 border-on-surface">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {daftarKasir.map(k => (
                <tr key={k.id} className="border-b-2 border-on-surface bg-surface hover:bg-surface-container-high transition-colors">
                  <td className="p-3 border-r-2 border-on-surface font-bold uppercase">{k.nama_lengkap}</td>
                  <td className="p-3 border-r-2 border-on-surface">{k.nama_pengguna}</td>
                  <td className="p-3 border-r-2 border-on-surface uppercase font-black text-primary">
                    {k.peran === 'admin' ? 'ADMINISTRATOR' : k.peran}
                  </td>
                  <td className="p-3 border-r-2 border-on-surface">{k.nama_cabang}</td>
                  <td className="p-3 border-r-2 border-on-surface">
                    <span className={`px-2 py-0.5 border ${k.is_aktif ? 'bg-primary/20 border-primary text-primary' : 'bg-error/20 border-error text-error'}`}>{k.is_aktif ? 'AKTIF' : 'NONAKTIF'}</span>
                  </td>
                  <td className="p-3 border-r-2 border-on-surface text-center flex justify-center gap-2">
                    <button
                      onClick={() => tanganiEditKasir(k)}
                      className="bg-[#4f378a] border border-on-surface p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none text-[#ffffff]"
                    >
                      <span className="material-symbols-outlined text-sm block">edit</span>
                    </button>
                    {k.peran !== 'admin' && (
                      <button
                        onClick={() => tanganiHapusKasir(k.id)}
                        className="bg-[#ffdad6] border border-on-surface p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                      >
                        <span className="material-symbols-outlined text-sm block text-[#93000a]">delete</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL TAMBAH CABANG */}
      {/* ======================================================== */}
      {modalCabang && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md p-6 relative font-mono">
            <div className="flex justify-between items-center border-b-2 border-on-surface pb-3 mb-4">
              <h2 className="font-black text-lg uppercase">Tambah Cabang Baru</h2>
              <button onClick={() => setModalCabang(false)} className="text-error font-bold text-xl hover:scale-110">X</button>
            </div>

            <form onSubmit={simpanCabang} className="space-y-4">
              <div>
                <label className="block font-bold mb-1 uppercase text-[10px]">Nama Cabang *</label>
                <input
                  type="text"
                  value={formCabang.nama_cabang}
                  onChange={(e) => setFormCabang({ ...formCabang, nama_cabang: e.target.value })}
                  className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                  placeholder="Cth: Toko Roti Utama"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Kode Cabang *</label>
                  <input
                    type="text"
                    value={formCabang.kode_cabang}
                    onChange={(e) => setFormCabang({ ...formCabang, kode_cabang: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none uppercase"
                    placeholder="Cth: CAB03"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Kota *</label>
                  <input
                    type="text"
                    value={formCabang.kota}
                    onChange={(e) => setFormCabang({ ...formCabang, kota: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                    placeholder="Cth: Jakarta"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#4ade80] text-on-surface font-black border-2 border-on-surface p-3 mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
              >
                Simpan Cabang
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL TAMBAH KASIR/KARYAWAN */}
      {/* ======================================================== */}
      {modalKasir && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg p-6 relative font-mono">
            <div className="flex justify-between items-center border-b-2 border-on-surface pb-3 mb-4">
              <h2 className="font-black text-lg uppercase">Tambah Akun SDM</h2>
              <button onClick={() => setModalKasir(false)} className="text-error font-bold text-xl hover:scale-110">X</button>
            </div>

            <form onSubmit={simpanKasir} className="space-y-4">
              <div>
                <label className="block font-bold mb-1 uppercase text-[10px]">Nama Lengkap *</label>
                <input
                  type="text"
                  value={formKasir.nama_lengkap}
                  onChange={(e) => setFormKasir({ ...formKasir, nama_lengkap: e.target.value })}
                  className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                  placeholder="Nama Karyawan"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Username *</label>
                  <input
                    type="text"
                    value={formKasir.nama_pengguna}
                    onChange={(e) => setFormKasir({ ...formKasir, nama_pengguna: e.target.value.toLowerCase() })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                    placeholder="username"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Kata Sandi *</label>
                  <input
                    type="password"
                    value={formKasir.kata_sandi}
                    onChange={(e) => setFormKasir({ ...formKasir, kata_sandi: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                    placeholder="***"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Peran (Role) *</label>
                  <select
                    value={formKasir.peran}
                    onChange={(e) => setFormKasir({ ...formKasir, peran: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none font-bold uppercase"
                  >
                    <option value="kasir">KASIR</option>
                    <option value="manajer">MANAJER</option>
                    {isAdmin && <option value="admin">ADMIN</option>}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">PIN Kasir (6 Angka) *</label>
                  <input
                    type="text"
                    maxLength="6"
                    pattern="\d{6}"
                    value={formKasir.pin}
                    onChange={(e) => setFormKasir({ ...formKasir, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none tracking-[0.5em] font-black text-center"
                    placeholder="123456"
                    required
                  />
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Penempatan Cabang *</label>
                  <select
                    value={formKasir.cabang_id}
                    onChange={(e) => setFormKasir({ ...formKasir, cabang_id: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none font-bold uppercase"
                    required
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {daftarCabang.map(c => (
                      <option key={c.id} value={c.id}>{c.nama_cabang}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#4ade80] text-on-surface font-black border-2 border-on-surface p-3 mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
              >
                Simpan Karyawan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI HAPUS KASIR */}
      {/* ======================================================== */}
      {modalKonfirmasiHapus.tampil && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-error shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm p-6 relative font-mono text-center">
            <span className="material-symbols-outlined text-5xl text-error mb-2">warning</span>
            <h2 className="font-black text-lg uppercase mb-2">Hapus Akun Karyawan?</h2>
            <p className="text-sm mb-6 text-on-surface/70">Pilih tindakan yang ingin Anda lakukan pada akun ini.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => eksekusiHapusKasir(false)}
                className="w-full bg-[#ffdf93] text-on-surface font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase text-sm"
              >
                Nonaktifkan Saja
              </button>
              <button 
                onClick={() => eksekusiHapusKasir(true)}
                className="w-full bg-error text-on-error font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase text-sm"
              >
                Hapus Permanen
              </button>
              <button 
                onClick={() => setModalKonfirmasiHapus({ tampil: false, id: null })}
                className="w-full bg-surface-container-highest text-on-surface font-black border-2 border-on-surface p-2 uppercase text-xs"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI HAPUS CABANG */}
      {/* ======================================================== */}
      {modalKonfirmasiHapusCabang.tampil && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-error shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm p-6 relative font-mono text-center">
            <span className="material-symbols-outlined text-5xl text-error mb-2">domain_disabled</span>
            <h2 className="font-black text-lg uppercase mb-2">Hapus Cabang?</h2>
            <p className="text-sm mb-6 text-on-surface/70">Pilih tindakan yang ingin Anda lakukan pada cabang ini.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => eksekusiHapusCabang(false)}
                className="w-full bg-[#ffdf93] text-on-surface font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase text-sm"
              >
                Nonaktifkan Saja
              </button>
              <button 
                onClick={() => eksekusiHapusCabang(true)}
                className="w-full bg-error text-on-error font-black border-2 border-on-surface p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase text-sm"
              >
                Hapus Permanen
              </button>
              <button 
                onClick={() => setModalKonfirmasiHapusCabang({ tampil: false, id: null })}
                className="w-full bg-surface-container-highest text-on-surface font-black border-2 border-on-surface p-2 uppercase text-xs"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL EDIT CABANG */}
      {/* ======================================================== */}
      {modalEditCabang && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md p-6 relative font-mono">
            <div className="flex justify-between items-center border-b-2 border-on-surface pb-3 mb-4">
              <h2 className="font-black text-lg uppercase">Edit Cabang</h2>
              <button onClick={() => setModalEditCabang(false)} className="text-error font-bold text-xl hover:scale-110">X</button>
            </div>

            <form onSubmit={simpanEditCabang} className="space-y-4">
              <div>
                <label className="block font-bold mb-1 uppercase text-[10px]">Nama Cabang *</label>
                <input
                  type="text"
                  value={formEditCabang.nama_cabang}
                  onChange={(e) => setFormEditCabang({ ...formEditCabang, nama_cabang: e.target.value })}
                  className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Kode Cabang *</label>
                  <input
                    type="text"
                    value={formEditCabang.kode_cabang}
                    onChange={(e) => setFormEditCabang({ ...formEditCabang, kode_cabang: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Kota *</label>
                  <input
                    type="text"
                    value={formEditCabang.kota}
                    onChange={(e) => setFormEditCabang({ ...formEditCabang, kota: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#ffdf93] text-on-surface font-black border-2 border-on-surface p-3 mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL EDIT KASIR/KARYAWAN */}
      {/* ======================================================== */}
      {modalEditKasir && (
        <div className="fixed inset-0 z-[100] bg-[#1d1b20]/60 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-lg p-6 relative font-mono">
            <div className="flex justify-between items-center border-b-2 border-on-surface pb-3 mb-4">
              <h2 className="font-black text-lg uppercase">Edit Akun SDM</h2>
              <button onClick={() => setModalEditKasir(false)} className="text-error font-bold text-xl hover:scale-110">X</button>
            </div>

            <form onSubmit={simpanEditKasir} className="space-y-4">
              <div>
                <label className="block font-bold mb-1 uppercase text-[10px]">Nama Lengkap *</label>
                <input
                  type="text"
                  value={formEditKasir.nama_lengkap}
                  onChange={(e) => setFormEditKasir({ ...formEditKasir, nama_lengkap: e.target.value })}
                  className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Username *</label>
                  <input
                    type="text"
                    value={formEditKasir.nama_pengguna}
                    onChange={(e) => setFormEditKasir({ ...formEditKasir, nama_pengguna: e.target.value.toLowerCase() })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Kata Sandi Baru</label>
                  <input
                    type="password"
                    value={formEditKasir.kata_sandi}
                    onChange={(e) => setFormEditKasir({ ...formEditKasir, kata_sandi: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none placeholder:text-[9px]"
                    placeholder="(Kosongkan jika tidak diubah)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Peran (Role) *</label>
                  <select
                    value={formEditKasir.peran}
                    onChange={(e) => setFormEditKasir({ ...formEditKasir, peran: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none font-bold uppercase"
                    disabled={formEditKasir.peran === 'admin' || !isAdmin}
                  >
                    <option value="kasir">KASIR</option>
                    <option value="manajer">MANAJER</option>
                    {isAdmin && <option value="admin">ADMINISTRATOR</option>}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">PIN Kasir (6 Angka) *</label>
                  <input
                    type="text"
                    maxLength="6"
                    pattern="\d{6}"
                    value={formEditKasir.pin}
                    onChange={(e) => setFormEditKasir({ ...formEditKasir, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none tracking-[0.5em] font-black text-center"
                    required
                  />
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="block font-bold mb-1 uppercase text-[10px]">Penempatan Cabang *</label>
                  <select
                    value={formEditKasir.cabang_id}
                    onChange={(e) => setFormEditKasir({ ...formEditKasir, cabang_id: e.target.value })}
                    className="w-full border-2 border-on-surface p-2 bg-surface-container-lowest focus:bg-[#e0d2ff]/20 outline-none font-bold uppercase"
                    required
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {daftarCabang.map(c => (
                      <option key={c.id} value={c.id}>{c.nama_cabang}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#ffdf93] text-on-surface font-black border-2 border-on-surface p-3 mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ManajemenSDM;
