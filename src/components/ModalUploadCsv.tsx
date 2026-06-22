import React, { useState, useRef } from "react";
import { X, FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

interface ModalUploadCsvProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export const ModalUploadCsv: React.FC<ModalUploadCsvProps> = ({
  isOpen,
  onClose,
  onUploadSuccess
}) => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMode, setUploadMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validateFile = (file: File): boolean => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      return true;
    }
    return false;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setExcelFile(file);
        setStatus(null);
      } else {
        setStatus({ success: false, message: "Hanya menerima berkas Excel (.xlsx, .xls) atau (.csv)!" });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setExcelFile(file);
        setStatus(null);
      } else {
        setStatus({ success: false, message: "Hanya menerima berkas Excel (.xlsx, .xls) atau (.csv)!" });
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    window.open("/api/admin/download-template", "_blank");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) {
      return setStatus({ success: false, message: "Silakan pilih berkas Excel terlebih dahulu!" });
    }

    setLoading(true);
    setStatus(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];

        const response = await fetch("/api/admin/upload-database", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            excelBase64: base64,
            mode: uploadMode
          })
        });

        const data = await response.json();
        if (data.success) {
          setStatus({ success: true, message: data.message });
          setExcelFile(null);
          onUploadSuccess();
        } else {
          setStatus({ success: false, message: data.message || "Gagal mengunggah database." });
        }
      } catch (err: any) {
        setStatus({ success: false, message: "Koneksi terputus: " + err.message });
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setStatus({ success: false, message: "Gagal membaca berkas di komputer lokal." });
      setLoading(false);
    };

    reader.readAsDataURL(excelFile);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1c1715] border border-[#2d2420] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in text-[#d4cdcb]">
        
        {/* Header */}
        <div className="p-5 border-b border-[#2d2420] flex items-center justify-between bg-gradient-to-r from-[#241a16] to-[#1c1715]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white uppercase tracking-wider">Perbarui / Sinkronisasi Excel</h3>
              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mt-1">Impor Data Excel &amp; CSV Utama</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            type="button"
            className="text-stone-400 hover:text-white transition p-1 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Instructions / Template Download button */}
          <div className="p-4 rounded-xl bg-[#241a16] border border-[#3e2e26]/40 flex items-start gap-3">
            <Download className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-stone-300 leading-snug">
                Gunakan template standar agar kolom teridentifikasi secara otomatis oleh sistem (id, kecamatan, sekolah, nama, nip, nik, golongan, dll). Format Excel meminimalkan kegagalan pembacaan karakter khusus.
              </p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-[#141110] text-[10px] font-black uppercase tracking-widest rounded-lg transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Template Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop File Upload Input */}
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
              dragActive 
                ? "border-amber-500 bg-amber-500/5" 
                : excelFile 
                ? "border-emerald-500/50 bg-emerald-500/5" 
                : "border-[#3d2f29] hover:border-amber-500/50 hover:bg-[#251e1b]/30"
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleFileChange}
              className="hidden" 
            />

            {excelFile ? (
              <>
                <FileSpreadsheet className="h-10 w-10 text-emerald-400" />
                <p className="text-xs font-black text-white">{excelFile.name}</p>
                <p className="text-[10px] text-stone-400 font-mono font-bold">Ukuran: {(excelFile.size / 1024).toFixed(2)} KB</p>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExcelFile(null);
                  }}
                  className="mt-2 text-[10px] font-black uppercase text-red-400 border border-red-900/40 px-2.5 py-1 rounded bg-red-950/10 hover:bg-red-950/30 cursor-pointer"
                >
                  Ganti File
                </button>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-stone-500 group-hover:text-amber-500" />
                <p className="text-xs font-black text-stone-200">Seret &amp; letakkan file Excel Anda di sini, atau klik untuk memilih</p>
                <p className="text-[10px] text-stone-500 uppercase font-black tracking-wider">Mendukung format (.xlsx, .xls, .csv)</p>
              </>
            )}
          </div>

          {/* Sync Mode Choice */}
          <div>
            <label className="block text-[10px] font-extrabold text-stone-500 uppercase tracking-widest mb-2">Metode Sinkronisasi</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                uploadMode === "merge" 
                  ? "bg-[#f25c05]/10 border-[#f25c05] text-stone-100" 
                  : "bg-[#141110] border-[#2c221e] text-stone-400"
              }`}>
                <input 
                  type="radio" 
                  name="syncMode" 
                  checked={uploadMode === "merge"} 
                  onChange={() => setUploadMode("merge")} 
                  className="mt-0.5 accent-[#f25c05]"
                />
                <div>
                  <p className="text-xs font-black">Gabungkan &amp; Update</p>
                  <p className="text-[9px] text-stone-500 font-bold mt-0.5">Memutakhirkan baris lama dan menambahkan PTK baru tanpa menghapus data lain.</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                uploadMode === "replace" 
                  ? "bg-[#ef4444]/10 border-red-500/50 text-stone-100" 
                  : "bg-[#141110] border-[#2c221e] text-stone-400"
              }`}>
                <input 
                  type="radio" 
                  name="syncMode" 
                  checked={uploadMode === "replace"} 
                  onChange={() => setUploadMode("replace")} 
                  className="mt-0.5 accent-red-500"
                />
                <div>
                  <p className="text-xs font-black text-red-400">Ganti Seluruh Data</p>
                  <p className="text-[9px] text-stone-500 font-bold mt-0.5">Menghapus total data PTK saat ini dan menyalin murni data dari Excel baru.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Feedback alerts */}
          {status && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 animate-fade-in ${
              status.success 
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                : "bg-red-500/5 border-red-500/20 text-red-400"
            }`}>
              {status.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              )}
              <p className="text-xs font-bold leading-normal">{status.message}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 justify-end border-t border-[#2d2420] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-stone-400 hover:text-white text-xs font-bold transition rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !excelFile}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-900 text-xs font-black uppercase tracking-wider rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Sedang Sinkronisasi...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>Proses Sinkronisasi</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
