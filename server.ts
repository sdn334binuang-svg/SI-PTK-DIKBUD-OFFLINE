import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import dotenv from "dotenv";
import * as XLSX from "xlsx";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ==========================================
// DIRECTORY & CSV DATABASE SETUP
// ==========================================
const DB_DIR = path.join(process.cwd(), "database");
const SEKOLAH_CSV_PATH = path.join(DB_DIR, "sekolah.csv");
const PENGGUNA_CSV_PATH = path.join(DB_DIR, "pengguna.csv");
const GTK_CSV_PATH = path.join(DB_DIR, "gtk.csv");

// Ensure database directory exists
const ensureDbDir = () => {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
};

// Seed datasets
const defaultSchools = [
  { id: "id-sek-satu", kecamatan: "KEC. BULUKUMPA", nama_sekolah: "SDN 58 TANETE" },
  { id: "id-sek-dua", kecamatan: "KEC. BULUKUMPA", nama_sekolah: "SDN 59 TANETE" }
];

const defaultUsers = [
  { role: "Admin Dinas", identifier: "admin", password: "ammatoa" },
  { role: "Sekolah", identifier: "KEC. BULUKUMPA|SDN 58 TANETE", password: "dikerja" },
  { role: "Sekolah", identifier: "KEC. BULUKUMPA|SDN 59 TANETE", password: "dikerja" }
];

const defaultGtk = [
  {
    id: "ID178069900785899",
    kecamatan: "KEC. BULUKUMPA",
    sekolah: "SDN 58 TANETE",
    nama: "IRA INDIRA, S.Pd., M.Pd",
    nip: "197601152002122005",
    status_pegawai: "PNS",
    nik: "7302075501760004",
    golongan: "IV/b",
    tmt_golongan: "2023-04-01",
    jabatan: "Guru Ahli Madya",
    pendidikan: "S2",
    beban_tugas: "Guru Kelas SD",
    tmt_kepsek: "",
    sertifikasi: "Ya",
    mapel: "Guru Kelas SD",
    no_hp: "6281342685961",
    tmt_kgb_terakhir: "",
    created_at: new Date().toISOString()
  }
];

// ==========================================
// CSV PARSING & SERIALIZATION UTILITIES
// ==========================================

// Get a value from an object using a list of potential aliases, ignoring spaces, case, and underscores
const getVal = (obj: any, aliases: string[]): string => {
  if (!obj) return "";
  for (const alias of aliases) {
    const cleanedAlias = alias.toLowerCase().replace(/[\s_\-]/g, "");
    for (const key of Object.keys(obj)) {
      const cleanedKey = key.toLowerCase().replace(/[\s_\-]/g, "");
      if (cleanedKey === cleanedAlias && obj[key] !== undefined && obj[key] !== null) {
        return String(obj[key]).trim();
      }
    }
  }
  return "";
};

// Parse a complete CSV file safely
const readCSV = (filePath: string, defaultData: any[]): any[] => {
  ensureDbDir();
  if (!fs.existsSync(filePath)) {
    writeCSV(filePath, defaultData);
    return defaultData;
  }

  try {
    let content = fs.readFileSync(filePath, "utf8");
    if (!content || content.trim() === "") return [];

    // Strip UTF-8 Byte Order Mark (BOM) if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    const lines: string[] = [];
    let currentLine = "";
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
      } else if (char === '\n' && !inQuotes) {
        lines.push(currentLine);
        currentLine = "";
      } else if (char === '\r' && !inQuotes) {
        // Ignore carriage return
      } else {
        currentLine += char;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    if (lines.length === 0) return [];

    const headers = parseCSVLine(lines[0]);
    const parsedRows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "") continue;
      const rowValues = parseCSVLine(lines[i]);
      const rowObj: any = {};
      headers.forEach((header, idx) => {
        rowObj[header] = rowValues[idx] !== undefined ? rowValues[idx] : "";
      });
      parsedRows.push(rowObj);
    }

    return parsedRows;
  } catch (err) {
    console.error("Error reading CSV file:", err);
    return defaultData;
  }
};

// Parse a single CSV line acknowledging optional quotes and separator types
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentVal += '"';
        i++; // skip next escapable quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(currentVal);
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal);
  return result.map(v => v.trim());
};

// Serialize objects list to double-quote qualified CSV formatting
const stringifyToCSV = (data: any[]): string => {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(",");

  const rows = data.map(row => {
    return headers.map(header => {
      const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : "";
      if (val.includes(",") || val.includes(";") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return val;
    }).join(",");
  });

  return [headerRow, ...rows].join("\n");
};

// Write raw dataset list in CSV style
const writeCSV = (filePath: string, data: any[]) => {
  ensureDbDir();
  const content = stringifyToCSV(data);
  fs.writeFileSync(filePath, content, "utf8");
};

// Initialize CSV backups at startup
ensureDbDir();
readCSV(SEKOLAH_CSV_PATH, defaultSchools);
readCSV(PENGGUNA_CSV_PATH, defaultUsers);
readCSV(GTK_CSV_PATH, defaultGtk);

// ==========================================
// API ENDPOINTS
// ==========================================

// Inspect local database status
app.get("/api/db-status", (req, res) => {
  res.json({
    status: "fallback",
    message: "Terhubung ke Database CSV Lokal komputer Anda. Folder: /database/*",
    url: "Local Directory Mode"
  });
});

// Authenticate session from local pengguna.csv list
app.post("/api/login", async (req, res) => {
  const { role, identifier, password } = req.body;
  if (!role || !identifier || !password) {
    return res.status(400).json({ success: false, message: "Kredensial tidak lengkap!" });
  }

  const users = readCSV(PENGGUNA_CSV_PATH, defaultUsers);
  const found = users.find(
    (u: any) => u.role === role && u.identifier === identifier && String(u.password) === String(password)
  );

  if (found) {
    return res.json({ success: true, role, identifier });
  }

  return res.json({ success: false, message: "Username/Sekolah atau Password salah!" });
});

// Update password directly (School role login instance)
app.post("/api/change-password", async (req, res) => {
  const { identifier, oldPass, newPass } = req.body;
  if (!identifier || !oldPass || !newPass) {
    return res.status(400).json({ success: false, message: "Parameter tidak lengkap." });
  }

  const users = readCSV(PENGGUNA_CSV_PATH, defaultUsers);
  const index = users.findIndex(
    (u: any) => u.role === "Sekolah" && u.identifier === identifier && String(u.password) === String(oldPass)
  );

  if (index !== -1) {
    users[index].password = String(newPass);
    writeCSV(PENGGUNA_CSV_PATH, users);
    return res.json({ success: true, message: "Password berhasil diubah secara offline." });
  }

  return res.json({ success: false, message: "Password lama tidak sesuai!" });
});

// Admin Dinas: Download Excel Template for GTK/PTK
app.get("/api/admin/download-template", (req, res) => {
  const templateObjects = [
    {
      id: "ID178069900785899",
      kecamatan: "KEC. BULUKUMPA",
      sekolah: "SDN 58 TANETE",
      nama: "IRA INDIRA, S.Pd., M.Pd",
      nip: "197601152002122005",
      status_pegawai: "PNS",
      nik: "7302075501760004",
      golongan: "IV/b",
      tmt_golongan: "2023-04-01",
      jabatan: "Guru Ahli Madya",
      pendidikan: "S2",
      beban_tugas: "Guru Kelas SD",
      tmt_kepsek: "",
      sertifikasi: "Ya",
      mapel: "Guru Kelas SD",
      no_hp: "6281342685961",
      tmt_kgb_terakhir: "2022-12-01"
    },
    {
      id: "ID178069900785800",
      kecamatan: "KEC. BULUKUMPA",
      sekolah: "SDN 58 TANETE",
      nama: "BUDI SANTOSO, S.Pd",
      nip: "198510102010011002",
      status_pegawai: "PPPK",
      nik: "7302071010850005",
      golongan: "IX",
      tmt_golongan: "2020-03-01",
      jabatan: "Guru Pertama",
      pendidikan: "S1",
      beban_tugas: "Guru Mapel - PJOK",
      tmt_kepsek: "",
      sertifikasi: "Belum",
      mapel: "PJOK",
      no_hp: "6281234567890",
      tmt_kgb_terakhir: "2022-03-01"
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateObjects);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template PTK");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=template_ptk_dikbud.xlsx");
  return res.send(buffer);
});

// Admin Dinas: Upload and Sync Excel / CSV Database
app.post("/api/admin/upload-database", async (req, res) => {
  const { excelBase64, mode } = req.body;
  if (!excelBase64) {
    return res.status(400).json({ success: false, message: "Konten berkas Excel kosong atau tidak terkirim!" });
  }

  try {
    const fileBuffer = Buffer.from(excelBase64, "base64");
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const parsedRows = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (!parsedRows || parsedRows.length === 0) {
      return res.status(400).json({ success: false, message: "Berkas Excel tidak memiliki data valid di baris pertama!" });
    }

    // Map into normalized format
    const cleanedRows = parsedRows.map((d: any) => {
      const idVal = getVal(d, ["id"]) || "ID" + Date.now() + Math.floor(Math.random() * 100000);
      return {
        id: idVal,
        kecamatan: getVal(d, ["kecamatan", "kec"]).toUpperCase().trim(),
        sekolah: getVal(d, ["sekolah", "nama_sekolah", "nama sekolah", "nama_satuan_pendidikan"]).toUpperCase().trim(),
        nama: getVal(d, ["nama", "nama_lengkap", "nama lengkap"]),
        nip: getVal(d, ["nip"]) ? String(getVal(d, ["nip"])).trim() : "",
        status_pegawai: getVal(d, ["status_pegawai", "status", "statuspegawai", "status_kepegawaian"]),
        nik: getVal(d, ["nik"]) ? String(getVal(d, ["nik"])).trim() : "",
        golongan: getVal(d, ["golongan", "gol", "pangkat_golongan"]),
        tmt_golongan: getVal(d, ["tmt_golongan", "tmtgolongan", "tmt_gol"]),
        jabatan: getVal(d, ["jabatan"]),
        pendidikan: getVal(d, ["pendidikan"]),
        beban_tugas: getVal(d, ["beban_tugas", "beban_tugas_pokok"]),
        tmt_kepsek: getVal(d, ["tmt_kepsek"]),
        sertifikasi: getVal(d, ["sertifikasi"]) || "Belum",
        mapel: getVal(d, ["mapel"]),
        no_hp: getVal(d, ["no_hp", "nohp", "hp", "nomor_hp"]),
        tmt_kgb_terakhir: getVal(d, ["tmt_kgb_terakhir", "tmt_kgb", "tmt_kgb_terakhir_formatted"]),
        created_at: new Date().toISOString()
      };
    });

    // Validations: require name, nik, sekolah, kecamatan as essentials
    const validRows = cleanedRows.filter(r => r.nama && r.nik && r.sekolah && r.kecamatan);
    if (validRows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Tidak ditemukan baris data valid! Pastikan tabel memiliki kolom 'nama', 'nik', 'sekolah', dan 'kecamatan' dengan baris data lengkap." 
      });
    }

    let finalRows: any[] = [];
    if (mode === "merge") {
      const existingRows = readCSV(GTK_CSV_PATH, defaultGtk);
      const rowMap = new Map<string, any>();
      
      // Load current keys
      existingRows.forEach((item: any) => {
        const key = item.id || item.nik || "";
        if (key) rowMap.set(key.toLowerCase().trim(), item);
      });

      // Overlay with uploaded rows matching either ID or NIK key
      validRows.forEach((item: any) => {
        const cleanId = item.id ? String(item.id).toLowerCase().trim() : "";
        const cleanNik = item.nik ? String(item.nik).toLowerCase().trim() : "";
        
        if (cleanId && rowMap.has(cleanId)) {
          rowMap.set(cleanId, item);
        } else if (cleanNik && rowMap.has(cleanNik)) {
          rowMap.set(cleanNik, item);
        } else {
          // New row to map
          const uniqueKey = cleanId || cleanNik || ("ID" + Date.now() + Math.floor(Math.random() * 100000));
          rowMap.set(uniqueKey, item);
        }
      });

      finalRows = Array.from(rowMap.values());
    } else {
      // replace
      finalRows = validRows;
    }

    writeCSV(GTK_CSV_PATH, finalRows);
    return res.json({ 
      success: true, 
      message: `Database berhasil diperbarui! Berhasil mengimpor & mengolah ${validRows.length} data guru/tenaga kependidikan.` 
    });

  } catch (err: any) {
    console.error("Excel Import error:", err);
    return res.status(500).json({ success: false, message: "Gagal memproses berkas Excel: " + err.message });
  }
});

// Load reference indices mapping school dropdowns
app.get("/api/dropdown-data", async (req, res) => {
  const schools = readCSV(SEKOLAH_CSV_PATH, defaultSchools);
  const rawSekolahs = schools.map((s: any) => ({
    id: s.id,
    kec: s.kecamatan,
    nama: s.nama_sekolah
  }));
  const rawKecamatans = Array.from(new Set(schools.map((s: any) => s.kecamatan)));

  res.json({
    kecamatans: rawKecamatans.sort(),
    sekolahs: rawSekolahs.sort((a, b) => a.nama.localeCompare(b.nama))
  });
});

// Get all GTK data for tables (with pension and KGB checks)
app.post("/api/gtk/list", async (req, res) => {
  const { role, identifier } = req.body;
  const rawGtk = readCSV(GTK_CSV_PATH, defaultGtk);

  let filtered = rawGtk.map((d: any) => ({
    ID: getVal(d, ["id"]),
    Kecamatan: getVal(d, ["kecamatan", "kec"]),
    Sekolah: getVal(d, ["sekolah", "nama_sekolah", "nama sekolah"]),
    Nama: getVal(d, ["nama", "nama_lengkap", "nama lengkap"]),
    NIP: getVal(d, ["nip"]) || "",
    Status_Pegawai: getVal(d, ["status_pegawai", "status"]) as any,
    NIK: getVal(d, ["nik"]),
    Golongan: getVal(d, ["golongan", "gol"]),
    TMT_Golongan_Formatted: getVal(d, ["tmt_golongan", "tmt_gol"]),
    TMT_KGB_Terakhir_Formatted: getVal(d, ["tmt_kgb_terakhir", "tmt_kgb"]),
    Jabatan: getVal(d, ["jabatan"]),
    Pendidikan: getVal(d, ["pendidikan"]),
    Beban_Tugas: getVal(d, ["beban_tugas", "beban_tugas_pokok"]),
    TMT_Kepsek_Formatted: getVal(d, ["tmt_kepsek"]),
    Sertifikasi: (getVal(d, ["sertifikasi"]) || "Belum") as any,
    Mapel: getVal(d, ["mapel"]),
    No_HP: getVal(d, ["no_hp", "nohp", "hp"])
  }));

  if (role === "Sekolah" && identifier) {
    const [kec, sek] = identifier.split("|");
    filtered = filtered.filter((item: any) => item.Kecamatan === kec && item.Sekolah === sek);
  }

  const today = new Date();
  const processedList = filtered.map((item, idx) => {
    let isPensiun = false;
    let isMendekatiPensiun = false;
    let telatNaikPangkat = false;

    // Promotion calculations (4 years threshold)
    if (item.TMT_Golongan_Formatted) {
      try {
        const tmtDate = new Date(item.TMT_Golongan_Formatted);
        const diffYears = (today.getTime() - tmtDate.getTime()) / (1000 * 3600 * 24 * 365.25);
        if (diffYears > 4) telatNaikPangkat = true;
      } catch (e) {}
    }

    // Pension calculation
    const nipStr = (item.NIP || "").toString().trim();
    if (nipStr.length >= 8 && (item.Status_Pegawai === "PNS" || item.Status_Pegawai.includes("PPPK"))) {
      const year = parseInt(nipStr.substring(0, 4), 10);
      const month = parseInt(nipStr.substring(4, 6), 10) - 1;
      const day = parseInt(nipStr.substring(6, 8), 10);

      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        let batasUmur = 58;
        const guruKeywords = ["Guru", "Kepala Sekolah"];
        if (guruKeywords.some(kw => item.Beban_Tugas && item.Beban_Tugas.includes(kw))) {
          batasUmur = 60;
        }

        const pensionDate = new Date(year + batasUmur, month, day);
        const timeDiff = pensionDate.getTime() - today.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);

        if (daysDiff <= 0) {
          isPensiun = true;
        } else if (daysDiff <= 365) {
          isMendekatiPensiun = true;
        }
      }
    }

    let telatKgb = false;
    let akanKgb = false;
    let kgbWarningMessage = "";

    if (item.Status_Pegawai === "PNS" && item.TMT_KGB_Terakhir_Formatted) {
      try {
        const lastKgbDate = new Date(item.TMT_KGB_Terakhir_Formatted);
        if (!isNaN(lastKgbDate.getTime())) {
          const nextKgbDate = new Date(lastKgbDate);
          nextKgbDate.setFullYear(lastKgbDate.getFullYear() + 2);

          const timeDiff = nextKgbDate.getTime() - today.getTime();
          const daysDiff = timeDiff / (1000 * 3600 * 24);

          if (daysDiff < 0) {
            telatKgb = true;
            kgbWarningMessage = "Telat KGB";
          } else if (daysDiff <= 91) {
            akanKgb = true;
            const remainingMonths = Math.ceil(daysDiff / 30.415);
            if (remainingMonths > 0 && remainingMonths <= 3) {
              kgbWarningMessage = `${remainingMonths} Bulan lagi KGB`;
            } else {
              kgbWarningMessage = "Segera KGB";
            }
          }
        }
      } catch (e) {}
    }

    return {
      ...item,
      rowNumber: idx + 2,
      isPensiun,
      isMendekatiPensiun,
      telatNaikPangkat,
      telatKgb,
      akanKgb,
      kgbWarningMessage
    };
  });

  res.json(processedList);
});

// Save or Update GTK data directly inside CSV
app.post("/api/gtk/save", async (req, res) => {
  const {
    id,
    kecamatan,
    sekolah,
    nama,
    nik,
    statusPegawai,
    nip,
    golongan,
    tmtGolongan,
    jabatan,
    pendidikan,
    bebanTugas,
    tmtKepsek,
    sertifikasi,
    mapel,
    hp,
    rowNumber,
    tmtKgbTerakhir
  } = req.body;

  if (!kecamatan || !sekolah || !nama || !nik || !statusPegawai || !pendidikan || !bebanTugas || !hp) {
    return res.status(400).json({ success: false, message: "Data wajib tidak lengkap!" });
  }

  let formattedHp = String(hp).trim();
  if (formattedHp.startsWith("0")) {
    formattedHp = "62" + formattedHp.substring(1);
  }

  const finalId = id || "ID" + Date.now() + Math.floor(Math.random() * 1000);

  const cleanDateVal = (val: any) => {
    if (val === undefined || val === null) return "";
    const s = String(val).trim();
    return s === "" ? "" : s;
  };

  const dbRow = {
    id: finalId,
    kecamatan,
    sekolah,
    nama,
    nip: nip || "",
    status_pegawai: statusPegawai,
    nik,
    golongan: golongan || "",
    tmt_golongan: cleanDateVal(tmtGolongan),
    jabatan: jabatan || "",
    pendidikan,
    beban_tugas: bebanTugas,
    tmt_kepsek: cleanDateVal(tmtKepsek),
    sertifikasi: sertifikasi || "Belum",
    mapel: mapel || "",
    no_hp: formattedHp,
    tmt_kgb_terakhir: cleanDateVal(tmtKgbTerakhir),
    created_at: new Date().toISOString()
  };

  const dbGtk = readCSV(GTK_CSV_PATH, defaultGtk);
  const existingIndex = dbGtk.findIndex((item: any) => item.id === finalId);

  if (existingIndex !== -1) {
    dbGtk[existingIndex] = { ...dbGtk[existingIndex], ...dbRow };
  } else {
    if (rowNumber) {
      const idxByRow = parseInt(rowNumber, 10) - 2;
      if (idxByRow >= 0 && idxByRow < dbGtk.length) {
        dbGtk[idxByRow] = { ...dbGtk[idxByRow], ...dbRow };
        writeCSV(GTK_CSV_PATH, dbGtk);
        return res.json({ success: true, message: "Data GTK berhasil diupdate." });
      }
    }
    dbGtk.push(dbRow);
  }

  writeCSV(GTK_CSV_PATH, dbGtk);
  res.json({ success: true, message: "Data GTK offline berhasil disimpan." });
});

// Delete GTK record
app.post("/api/gtk/delete", async (req, res) => {
  const { id, rowNumber } = req.body;

  if (!id && !rowNumber) {
    return res.status(400).json({ success: false, message: "Parameter ID atau nomor baris diperlukan." });
  }

  const dbGtk = readCSV(GTK_CSV_PATH, defaultGtk);

  if (id) {
    const origLen = dbGtk.length;
    const filtered = dbGtk.filter((item: any) => item.id !== id);
    if (filtered.length < origLen) {
      writeCSV(GTK_CSV_PATH, filtered);
      return res.json({ success: true, message: "Data GTK berhasil dihapus." });
    }
  }

  if (rowNumber) {
    const idx = parseInt(rowNumber, 10) - 2;
    if (idx >= 0 && idx < dbGtk.length) {
      dbGtk.splice(idx, 1);
      writeCSV(GTK_CSV_PATH, dbGtk);
      return res.json({ success: true, message: "Data GTK berhasil dihapus." });
    }
  }

  res.json({ success: false, message: "Data GTK tidak ditemukan atau gagal dihapus." });
});

// Adminlookup password
app.post("/api/admin/get-password", async (req, res) => {
  const { role, identifier } = req.body;
  if (!role || !identifier) {
    return res.status(400).json({ success: false, message: "Parameter tidak lengkap." });
  }

  const users = readCSV(PENGGUNA_CSV_PATH, defaultUsers);
  const found = users.find((u: any) => u.role === role && u.identifier === identifier);

  if (found) {
    return res.json({ success: true, password: found.password });
  }

  return res.json({ success: false, message: "Akun tersebut belum terdaftar." });
});

// Admin-level password revision
app.post("/api/admin/change-password", async (req, res) => {
  const { role, identifier, newPassword } = req.body;
  if (!role || !identifier || !newPassword) {
    return res.status(400).json({ success: false, message: "Parameter tidak lengkap." });
  }

  const users = readCSV(PENGGUNA_CSV_PATH, defaultUsers);
  const idx = users.findIndex((u: any) => u.role === role && u.identifier === identifier);

  if (idx !== -1) {
    users[idx].password = String(newPassword);
  } else {
    users.push({ role, identifier, password: String(newPassword) });
  }

  writeCSV(PENGGUNA_CSV_PATH, users);
  res.json({ success: true, message: "Password berhasil diperbarui secara offline." });
});

// Save or update school referentials
app.post("/api/school/save", async (req, res) => {
  const { id, kecamatan, namaSekolah } = req.body;
  if (!kecamatan || !namaSekolah) {
    return res.status(400).json({ success: false, message: "Kecamatan dan Nama Sekolah wajib diisi." });
  }

  const finalId = id || "ID-SCH-" + Date.now();
  const rawRow = {
    id: finalId,
    kecamatan: String(kecamatan).toUpperCase().trim(),
    nama_sekolah: String(namaSekolah).toUpperCase().trim()
  };

  const credRow = {
    role: "Sekolah",
    identifier: `${rawRow.kecamatan}|${rawRow.nama_sekolah}`,
    password: "dikerja"
  };

  const schools = readCSV(SEKOLAH_CSV_PATH, defaultSchools);
  const matchIndex = schools.findIndex((s: any) => s.id === finalId);

  if (matchIndex !== -1) {
    schools[matchIndex] = rawRow;
  } else {
    schools.push(rawRow);
  }
  writeCSV(SEKOLAH_CSV_PATH, schools);

  const users = readCSV(PENGGUNA_CSV_PATH, defaultUsers);
  const userExist = users.some((u: any) => u.identifier === credRow.identifier);
  if (!userExist) {
    users.push(credRow);
    writeCSV(PENGGUNA_CSV_PATH, users);
  }

  res.json({ success: true, message: "Data sekolah offline berhasil disimpan." });
});

// Delete school entity
app.post("/api/school/delete", async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, message: "ID sekolah dibutuhkan." });
  }

  let schools = readCSV(SEKOLAH_CSV_PATH, defaultSchools);
  const matched = schools.find((s: any) => s.id === id);

  if (matched) {
    const identifier = `${matched.kecamatan}|${matched.nama_sekolah}`;
    schools = schools.filter((s: any) => s.id !== id);
    writeCSV(SEKOLAH_CSV_PATH, schools);

    let users = readCSV(PENGGUNA_CSV_PATH, defaultUsers);
    users = users.filter((u: any) => u.identifier !== identifier);
    writeCSV(PENGGUNA_CSV_PATH, users);

    return res.json({ success: true, message: "Data sekolah offline berhasil dihapus." });
  }

  res.json({ success: false, message: "Sekolah tidak ditemukan." });
});

// ==========================================
// VITE CLIENT BUILD / DEVELOPMENT SETUP
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const startListening = (port: number) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`=======================================================`);
      console.log(`  SISTEM INFORMASI PTK DIKBUD BULUKUMBA SIAP!`);
      console.log(`  Server berjalan pada: http://localhost:${port}`);
      console.log(`  Seluruh data disimpan di folder local: /database/`);
      console.log(`=======================================================`);

      // Auto-open browser on local machine setup (non-cloud environment check)
      if (process.env.K_SERVICE === undefined) {
        try {
          const url = `http://localhost:${port}`;
          const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
          exec(`${openCmd} ${url}`);
        } catch (e) {
          console.log(`Could not auto-open browser, please open http://localhost:${port} manually:`, e);
        }
      }
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        if (process.env.K_SERVICE !== undefined) {
          console.error(`[CRITICAL] Port ${port} is already in use inside Cloud Run. Dynamic fallback is disabled in cloud.`);
          process.exit(1);
        } else {
          console.warn(`[PORT CONFLICT] Port ${port} is already in use. Trying available port: ${port + 1}...`);
          startListening(port + 1);
        }
      } else {
        console.error("[SERVER ERROR]", err);
      }
    });
  };

  startListening(PORT);
}

startServer();
