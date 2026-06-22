#!/bin/bash
# Ubah direktori kerja ke folder tempat script berada
cd "$(dirname "$0")"

clear
echo "=========================================================="
echo "        SISTEM INFORMASI PTK DIKBUD BULUKUMBA"
echo "            (MODE DISTRIBUSI DESKTOP LOKAL)"
echo "=========================================================="
echo ""
echo "Database: Menyimpan data ke folder '/database/' (Format CSV)"
echo "Status: Sedang memeriksa lingkungan lokal..."
echo ""

# 1. Cek apakah Node.js terpasang
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js tidak ditemukan di sistem macOS/Linux ini!"
    echo "Aplikasi ini membutuhkan Node.js agar dapat dijalankan."
    echo ""
    echo "Silakan unduh dan pasang Node.js terlebih dahulu melalui:"
    echo "https://nodejs.org/"
    echo ""
    read -p "Tekan [ENTER] untuk menutup..."
    exit 1
fi

# 2. Cek dependensi node_modules
if [ ! -d "node_modules" ]; then
    echo "[INFO] Mendeteksi aplikasi baru pertama kali dijalankan."
    echo "[INFO] Sedang mengunduh dan memasang dependensi (npm install)..."
    echo "[INFO] Harap tunggu sebentar, ini hanya dilakukan SEKALI..."
    echo ""
    npm install
fi

if [ ! -d "node_modules" ]; then
    echo "[ERROR] Gagal mengunduh dependensi lokal!"
    read -p "Tekan [ENTER] untuk menutup..."
    exit 1
fi

# 3. Jalankan server lokal
echo ""
echo "[OK] Mengaktifkan Server Lokal..."
echo "[OK] Browser Anda akan otomatis terbuka sesaat lagi!"
echo "[INFO] JANGAN TUTUP jendela Terminal ini selama aplikasi sedang digunakan."
echo "=========================================================="
echo ""

npm run dev
