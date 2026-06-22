import React, { useState } from "react";
import { DbStatus } from "../types";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, Terminal } from "lucide-react";

interface DbAlertProps {
  status: DbStatus | null;
  onRefresh: () => void;
}

export const DbAlert: React.FC<DbAlertProps> = ({ status, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!status) return null;

  const isLocal = status.status === "fallback";

  const sqlCode = `-- 1. Table: sekolah_db (Database Sekolah)
CREATE TABLE IF NOT EXISTS sekolah_db (
    id TEXT PRIMARY KEY,
    kecamatan TEXT NOT NULL,
    nama_sekolah TEXT NOT NULL
);

-- 2. Table: pengguna_db (Database Kredensial Pengguna)
CREATE TABLE IF NOT EXISTS pengguna_db (
    role TEXT NOT NULL,
    identifier TEXT PRIMARY KEY, -- 'admin' atau 'Kecamatan|Nama Sekolah'
    password TEXT NOT NULL
);

-- 3. Table: gtk_data (Database Personel GTK)
CREATE TABLE IF NOT EXISTS gtk_data (
    id TEXT PRIMARY KEY,
    kecamatan TEXT NOT NULL,
    sekolah TEXT NOT NULL,
    nama TEXT NOT NULL,
    nip TEXT,
    status_pegawai TEXT NOT NULL,
    nik TEXT NOT NULL,
    golongan TEXT,
    tmt_golongan TEXT,
    tmt_kgb_terakhir TEXT,
    jabatan TEXT,
    pendidikan TEXT NOT NULL,
    beban_tugas TEXT NOT NULL,
    tmt_kepsek TEXT,
    sertifikasi TEXT DEFAULT 'Belum',
    mapel TEXT,
    no_hp TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults
INSERT INTO sekolah_db (id, kecamatan, nama_sekolah) VALUES
('id-sek-satu', 'KEC. BULUKUMPA', 'SDN 58 TANETE'),
('id-sek-dua', 'KEC. BULUKUMPA', 'SDN 59 TANETE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pengguna_db (role, identifier, password) VALUES
('Admin Dinas', 'admin', 'ammatoa'),
('Sekolah', 'KEC. BULUKUMPA|SDN 58 TANETE', 'dikerja'),
('Sekolah', 'KEC. BULUKUMPA|SDN 59 TANETE', 'dikerja')
ON CONFLICT (identifier) DO NOTHING;

-- 4. NONAKTIFKAN Row Level Security (RLS) di Supabase agar bisa tulis/baca
ALTER TABLE sekolah_db DISABLE ROW LEVEL SECURITY;
ALTER TABLE pengguna_db DISABLE ROW LEVEL SECURITY;
ALTER TABLE gtk_data DISABLE ROW LEVEL SECURITY;

-- Berikan hak akses penuh ke role anon dan service_role
GRANT ALL ON TABLE sekolah_db TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE pengguna_db TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE gtk_data TO postgres, anon, authenticated, service_role;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-b bg-stone-900 border-orange-500/10 text-orange-300 px-4 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs font-semibold">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-4.5 w-4.5 text-[#ed6900] flex-shrink-0" />
          <div>
            <span className="font-extrabold uppercase tracking-wide text-[10px] px-1.5 py-0.5 rounded bg-black/30 mr-1.5 text-orange-300">
              DATABASE LOKAL AKTIF
            </span>{" "}
            <span className="text-stone-300">
              Aplikasi berjalan offline. Data Anda tersimpan aman dalam format CSV di folder <code className="bg-black/40 px-1.5 py-0.5 rounded font-mono text-orange-200">/database/</code> di komputer ini.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="px-3 py-1 rounded text-[10px] font-bold uppercase transition duration-150 cursor-pointer bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 border border-transparent"
          >
            Segarkan Status
          </button>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[11px] underline font-semibold cursor-pointer opacity-80 hover:opacity-100 text-orange-200"
          >
            Petunjuk Penggunaan Berkas {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-w-7xl mx-auto mt-4 p-5 rounded-xl bg-stone-900 border border-stone-850 text-stone-100 font-sans shadow-xl text-xs">
          <div className="flex items-center gap-2 text-xs text-orange-400 font-mono font-bold mb-4 border-b border-stone-800 pb-2.5">
            <Terminal className="h-4 w-4 text-[#ed6900]" />
            <span>PANDUAN DATABASE LOKAL (EXCEL &amp; CSV)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 leading-relaxed">
            <div className="space-y-2">
              <span className="font-bold text-[#ed6900] text-sm block">1. Struktur Berkas</span>
              <p className="text-stone-400 text-xs">
                Sistem menyimpan data dalam folder <code className="bg-black/40 px-1 py-0.5 rounded font-mono text-stone-200">database/</code> di folder instalasi utama aplikasi ini:
              </p>
              <ul className="list-disc pl-4 text-stone-400 space-y-1 mt-1 font-mono text-[11px]">
                <li><b className="text-stone-200">database/gtk.csv</b> - Menyimpan seluruh data guru, NIK, golongan, status, dll.</li>
                <li><b className="text-stone-200">database/sekolah.csv</b> - Daftar referensi sekolah.</li>
                <li><b className="text-stone-200">database/pengguna.csv</b> - Kredensial password dan akun login.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-[#ed6900] text-sm block">2. Membuka di Microsoft Excel</span>
              <p className="text-stone-400 text-xs">
                Berkas CSV dapat langsung dibuka menggunakan Microsoft Excel atau LibreOffice untuk diolah secara bebas:
              </p>
              <ol className="list-decimal pl-4 text-stone-400 space-y-1 mt-1">
                <li>Buka aplikasi Microsoft Excel.</li>
                <li>Pilih <b className="text-stone-300">File &gt; Open &gt; Browse</b>.</li>
                <li>Ubah filter tipe berkas menjadi <b className="text-stone-300">All Files (*.*)</b> atau <b className="text-stone-300">Text Files (*.prn; *.txt; *.csv)</b>.</li>
                <li>Pilih berkas dari folder <code className="bg-black/40 px-1 py-0.5 rounded text-[11px] font-mono text-stone-300">database/</code>.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-[#ed6900] text-sm block">3. Salinan Cadangan (Backup)</span>
              <p className="text-stone-400 text-xs">
                Untuk mencegah terjadinya kehilangan data akibat virus, kerusakan sistem, atau instalasi ulang sistem operasi:
              </p>
              <p className="text-stone-400 text-xs mt-1">
                Cukup <b className="text-stone-300">salin (copy) seluruh folder "database"</b> ke media eksternal (seperti flashdisk, harddisk eksternal, atau penyimpanan cloud pribadi Anda secara rutin).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

