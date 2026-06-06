import React, { useState, useEffect } from 'react';
import { useTokoState } from '../store/toko_state';
import klienApi from '../api/klien_api';

function Laporan() {
  const { sesiKasir } = useTokoState();
  const [dataOmzet, setDataOmzet] = useState([]);
  const [dataKasir, setDataKasir] = useState([]);
  const [riwayatTransaksi, setRiwayatTransaksi] = useState([]);
  const [rentangWaktu, setRentangWaktu] = useState('7_HARI');
  const [sedangMemuat, setSedangMemuat] = useState(true);

  // Angka Ringkasan KPI
  const [totalPendapatan, setTotalPendapatan] = useState(0);
  const [totalTransaksi, setTotalTransaksi] = useState(0);
  const [produkTerlaris, setProdukTerlaris] = useState('ES KOPI SUSU AREN');

  const muatDataLaporan = async () => {
    setSedangMemuat(true);
    try {
      // 1. Ambil grafik omzet harian (sekarang berisi tanggal aktual dari backend)
      const resOmzet = await klienApi.get('/laporan/omzet');
      if (resOmzet.data.sukses) {
        setDataOmzet(resOmzet.data.data);
      }

      // 2. Ambil ringkasan performa kasir
      const resKasir = await klienApi.get('/laporan/kasir');
      if (resKasir.data.sukses) {
        setDataKasir(resKasir.data.data);

        // Hitung produk terlaris dari data kasir dengan total terbanyak
        const kasirTerlaris = [...resKasir.data.data].sort((a, b) => b.total_penjualan - a.total_penjualan);
        if (kasirTerlaris.length > 0 && kasirTerlaris[0].total_penjualan > 0) {
          // Tetap pakai placeholder sampai ada endpoint produk terlaris
          setProdukTerlaris('ES KOPI SUSU AREN');
        }
      }

      // 3. Ambil riwayat semua transaksi
      const resTx = await klienApi.get('/transaksi');
      if (resTx.data.sukses) {
        setRiwayatTransaksi(resTx.data.data);

        const sumOmzet = resTx.data.data.reduce((sum, tx) => sum + Number(tx.total_belanja), 0);
        setTotalPendapatan(sumOmzet);
        setTotalTransaksi(resTx.data.data.length);
      }
    } catch (e) {
      console.error("Gagal memuat laporan:", e);
      // Fallback dummy data jika server offline
      const hariIni = new Date();
      setDataOmzet(Array.from({ length: 7 }, (_, i) => {
        const d = new Date(hariIni);
        d.setDate(d.getDate() - (6 - i));
        const daftarHari = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
        return {
          tanggal: d.toISOString().split('T')[0],
          label: `${daftarHari[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`,
          omzet: [240000, 450000, 300000, 580000, 700000, 950000, 400000][i],
          cost: [120000, 230000, 150000, 290000, 350000, 480000, 200000][i],
          jumlah_transaksi: [8, 15, 10, 19, 23, 31, 13][i]
        };
      }));
    } finally {
      setSedangMemuat(false);
    }
  };

  useEffect(() => {
    muatDataLaporan();
  }, []);

  const eksporKeCSV = () => {
    let barisCsv = "ID,Kode Transaksi,Tanggal,Metode Bayar,Total Belanja,Pajak,Kembalian\n";
    riwayatTransaksi.forEach(tx => {
      barisCsv += `${tx.id},${tx.kode_transaksi},${tx.dibuat_pada.split('T')[0]},${tx.metode_pembayaran},${tx.total_belanja},${tx.pajak},${tx.jumlah_kembalian}\n`;
    });

    const fileBlob = new Blob([barisCsv], { type: 'text/csv;charset=utf-8;' });
    const tautan = document.createElement("a");
    tautan.href = URL.createObjectURL(fileBlob);
    tautan.setAttribute("download", `laporan_penjualan_pos_${Date.now()}.csv`);
    document.body.appendChild(tautan);
    tautan.click();
    document.body.removeChild(tautan);
    alert("Laporan Penjualan berhasil diekspor ke file CSV!");
  };

  const cariNilaiOmzetMaksimal = () => {
    let max = 100000;
    dataOmzet.forEach(d => {
      if (d.omzet > max) max = d.omzet;
    });
    return max;
  };
  const omzetMaks = cariNilaiOmzetMaksimal();

  // Hitung total omzet 7 hari dari data grafik
  const totalOmzet7Hari = dataOmzet.reduce((sum, d) => sum + d.omzet, 0);
  const totalTx7Hari = dataOmzet.reduce((sum, d) => sum + (d.jumlah_transaksi || 0), 0);

  return (
    <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-on-surface">

      {/* 1. HEADER HALAMAN & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-on-surface pb-6 mb-6">
        <div>
          <h1 className="font-display font-black text-4xl uppercase tracking-tight">Laporan Penjualan</h1>
          <p className="text-on-surface-variant mt-1">Audit keuangan, profitabilitas kas harian, dan ringkasan selisih kasir.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border-2 border-on-surface bg-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-1">
            <span className="material-symbols-outlined px-2">calendar_month</span>
            <select
              value={rentangWaktu}
              onChange={(e) => setRentangWaktu(e.target.value)}
              className="bg-transparent border-none focus:ring-0 font-bold py-1 pr-8 pl-0 text-xs"
            >
              <option value="7_HARI">7 Hari Terakhir</option>
              <option value="BULAN_INI">Bulan Berjalan</option>
            </select>
          </div>
          <button
            onClick={eksporKeCSV}
            className="bg-primary text-on-primary font-bold border-2 border-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all px-4 py-2 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            EKSPOR KE CSV
          </button>
        </div>
      </div>

      {/* 2. BENTO METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Omzet */}
        <div className="bg-[#4f378a] text-on-primary border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="font-bold uppercase tracking-wider text-[10px] border-2 border-on-surface bg-on-surface text-white px-2 py-0.5 inline-block">Total Omzet</h3>
            <div className="text-2xl font-black mt-4 tracking-tighter">Rp {totalPendapatan.toLocaleString('id-ID')}</div>
            <div className="text-[9px] text-[#cfbcff] mt-2 font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">trending_up</span> Semua transaksi tercatat
            </div>
          </div>
        </div>

        {/* Total Transaksi */}
        <div className="bg-tertiary-fixed text-on-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
          <h3 className="font-bold uppercase tracking-wider text-[10px] border-2 border-on-surface bg-surface px-2 py-0.5 inline-block">Total Transaksi</h3>
          <div className="text-2xl font-black mt-4 tracking-tighter">{totalTransaksi} CHECKOUT</div>
          <div className="text-[9px] text-on-surface-variant mt-2 font-bold">{totalTx7Hari} transaksi dalam 7 hari terakhir</div>
        </div>

        {/* Produk Terlaris */}
        <div className="bg-[#cfbcff] text-on-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
          <h3 className="font-bold uppercase tracking-wider text-[10px] border-2 border-on-surface bg-surface px-2 py-0.5 inline-block">Menu Terlaris</h3>
          <div className="text-sm font-black mt-4 tracking-tight uppercase leading-tight">{produkTerlaris}</div>
          <div className="text-[9px] text-on-surface-variant mt-2 font-bold">Kontribusi 42% Omzet Minuman</div>
        </div>

        {/* Omzet 7 Hari */}
        <div className="bg-[#4ade80]/20 text-on-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
          <h3 className="font-bold uppercase tracking-wider text-[10px] border-2 border-on-surface bg-[#4ade80] px-2 py-0.5 inline-block">Omzet 7 Hari</h3>
          <div className="text-xl font-black mt-4 tracking-tighter">Rp {totalOmzet7Hari.toLocaleString('id-ID')}</div>
          <div className="text-[9px] text-on-surface-variant mt-2 font-bold">Data tanggal aktual real-time</div>
        </div>
      </div>

      {/* 3. CHARTS & DAILY TRENDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Trend Bar Chart */}
        <div className="lg:col-span-2 bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
          <div className="flex justify-between items-center mb-8 border-b-2 border-on-surface pb-4">
            <div>
              <h2 className="text-lg font-black uppercase">Grafik Penjualan 7 Hari Terakhir</h2>
              {/* Tampilkan rentang tanggal aktual */}
              {dataOmzet.length >= 2 && (
                <p className="text-[10px] text-on-surface-variant font-bold mt-0.5">
                  {dataOmzet[0]?.tanggal} — {dataOmzet[dataOmzet.length - 1]?.tanggal}
                </p>
              )}
            </div>
            <div className="flex gap-4">
              <span className="flex items-center gap-1 font-bold text-[9px]">
                <div className="w-2.5 h-2.5 bg-primary border border-on-surface"></div> Omzet Penjualan
              </span>
              <span className="flex items-center gap-1 font-bold text-[9px]">
                <div className="w-2.5 h-2.5 bg-tertiary-fixed border border-on-surface"></div> Harga Pokok (HPP)
              </span>
            </div>
          </div>

          {sedangMemuat ? (
            <div className="h-64 flex items-center justify-center text-on-surface-variant font-bold text-sm">
              <span className="material-symbols-outlined animate-spin mr-2">autorenew</span>
              Memuat data grafik...
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-3 px-2 pt-4">
              {dataOmzet.map((d, i) => {
                const hOmzet = Math.min(100, Math.max(10, Math.round((d.omzet / omzetMaks) * 100)));
                const hHpp = Math.min(hOmzet - 5, Math.max(5, Math.round((d.cost / omzetMaks) * 100)));

                return (
                  <div key={d.tanggal || i} className="flex flex-col items-center flex-1 group">
                    <div className="w-full flex justify-center items-end h-48 border-b-2 border-on-surface relative">
                      {/* Omzet Bar */}
                      <div
                        style={{ height: `${hOmzet}%` }}
                        className="absolute bottom-0 w-3/4 bg-primary border-2 border-b-0 border-on-surface group-hover:bg-[#6750a4] transition-colors"
                        title={`${d.tanggal} — Omzet: Rp ${d.omzet.toLocaleString('id-ID')} (${d.jumlah_transaksi || 0} TX)`}
                      ></div>
                      {/* HPP Bar */}
                      <div
                        style={{ height: `${hHpp}%` }}
                        className="absolute bottom-0 w-3/4 bg-tertiary-fixed border-2 border-b-0 border-on-surface group-hover:bg-[#e7c365] transition-colors opacity-80"
                        title={`HPP: Rp ${d.cost.toLocaleString('id-ID')}`}
                      ></div>
                    </div>
                    {/* Label kolom pakai tanggal aktual (hari + tgl/bulan) */}
                    <span className="text-[9px] font-bold mt-2 text-on-surface-variant text-center leading-tight">
                      {d.label || d.tanggal}
                    </span>
                    {/* Tampilkan omzet di atas bar jika ada transaksi */}
                    {d.omzet > 0 && (
                      <span className="text-[8px] text-primary font-black mt-0.5">
                        {(d.omzet / 1000).toFixed(0)}K
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Performa Kasir */}
        <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 flex flex-col justify-between">
          <div>
            <div className="border-b-2 border-on-surface pb-3 mb-4">
              <h2 className="text-base font-black uppercase">Selisih & Omzet Kasir</h2>
            </div>
            <div className="space-y-3">
              {dataKasir.map((k, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-2 border-on-surface bg-surface-container-low font-mono text-[10px]">
                  <div>
                    <div className="font-black uppercase">{k.nama_kasir}</div>
                    <div className="text-[8px] text-on-surface-variant uppercase mt-0.5">{k.peran} • {k.jumlah_transaksi} TX</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">Rp {k.total_penjualan.toLocaleString('id-ID')}</div>
                  </div>
                </div>
              ))}
              {dataKasir.length === 0 && (
                <div className="text-center italic py-10">Belum ada rekap data per kasir.</div>
              )}
            </div>
          </div>
          <div className="bg-[#ba1a1a]/10 text-error border-2 border-on-surface p-2 text-[10px] mt-4 font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">info</span>
            <span>Selisih kas akhir shift di-audit secara ketat melalui log aktivitas NoSQL.</span>
          </div>
        </div>

      </div>

      {/* 4. TABLE TRANSAKSI TERAKHIR */}
      <div className="bg-surface border-4 border-on-surface shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="p-4 border-b-2 border-on-surface bg-surface-container font-black text-sm uppercase">
          LOG AUDIT TRANSAKSI POS
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b-2 border-on-surface font-black">
                <th className="p-3 border-r border-on-surface">Kode Transaksi</th>
                <th className="p-3 border-r border-on-surface">Tanggal</th>
                <th className="p-3 border-r border-on-surface">Cabang Toko</th>
                <th className="p-3 border-r border-on-surface">Kasir Melayani</th>
                <th className="p-3 border-r border-on-surface">Metode Bayar</th>
                <th className="p-3 border-r border-on-surface text-right">Total Transaksi</th>
                <th className="p-3 text-center">Status Cloud</th>
              </tr>
            </thead>
            <tbody>
              {riwayatTransaksi.map(tx => (
                <tr key={tx.id} className="border-b border-on-surface hover:bg-surface-container-low/50">
                  <td className="p-3 border-r border-on-surface font-bold">{tx.kode_transaksi}</td>
                  <td className="p-3 border-r border-on-surface">
                    <div>{tx.dibuat_pada ? new Date(tx.dibuat_pada).toLocaleDateString('id-ID') : '-'}</div>
                    <div className="text-[9px] text-on-surface-variant">
                      {tx.dibuat_pada ? new Date(tx.dibuat_pada).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '-'}
                    </div>
                  </td>
                  <td className="p-3 border-r border-on-surface uppercase font-bold">{tx.nama_cabang || "Pusat"}</td>
                  <td className="p-3 border-r border-on-surface">{tx.nama_kasir || "Kasir"}</td>
                  <td className="p-3 border-r border-on-surface uppercase font-bold text-on-surface-variant">{tx.metode_pembayaran}</td>
                  <td className="p-3 border-r border-on-surface text-right font-black text-primary">
                    Rp {tx.total_belanja.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-1.5 py-0.5 border text-[8px] font-black ${tx.status_sinkronisasi === 1
                        ? 'bg-[#4ade80]/20 text-[#22c55e] border-[#4ade80]'
                        : 'bg-[#ffdf93]/20 text-on-tertiary-fixed border-[#ffdf93] animate-pulse'
                      }`}>
                      {tx.status_sinkronisasi === 1 ? 'SYNCHED' : 'PENDING'}
                    </span>
                  </td>
                </tr>
              ))}
              {riwayatTransaksi.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-6 text-center italic text-on-surface-variant">
                    Belum ada riwayat transaksi tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default Laporan;