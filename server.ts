import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import dotenv from "dotenv";

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

// Parse a complete CSV file safely
const readCSV = (filePath: string, defaultData: any[]): any[] => {
  ensureDbDir();
  if (!fs.existsSync(filePath)) {
    writeCSV(filePath, defaultData);
    return defaultData;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (!content || content.trim() === "") return [];

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
    ID: d.id,
    Kecamatan: d.kecamatan,
    Sekolah: d.sekolah,
    Nama: d.nama,
    NIP: d.nip || "",
    Status_Pegawai: d.status_pegawai,
    NIK: d.nik,
    Golongan: d.golongan || "",
    TMT_Golongan_Formatted: d.tmt_golongan || "",
    TMT_KGB_Terakhir_Formatted: d.tmt_kgb_terakhir || "",
    Jabatan: d.jabatan || "",
    Pendidikan: d.pendidikan,
    Beban_Tugas: d.beban_tugas,
    TMT_Kepsek_Formatted: d.tmt_kepsek || "",
    Sertifikasi: d.sertifikasi || "Belum",
    Mapel: d.mapel || "",
    No_HP: d.no_hp
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`=======================================================`);
    console.log(`  SISTEM INFORMASI PTK DIKBUD BULUKUMBA SIAP!`);
    console.log(`  Server berjalan pada: http://localhost:${PORT}`);
    console.log(`  Seluruh data disimpan di folder local: /database/`);
    console.log(`=======================================================`);

    // Auto-open browser on local machine setup (non-cloud environment check)
    if (process.env.K_SERVICE === undefined) {
      try {
        const url = `http://localhost:${PORT}`;
        const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${openCmd} ${url}`);
      } catch (e) {
        console.log("Could not auto-open browser, please open http://localhost:3000 manually:", e);
      }
    }
  });
}

startServer();
