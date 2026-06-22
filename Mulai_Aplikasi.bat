@echo off
:: Mengaktifkan warna konsol jika didukung (Hijau Cerah)
color 0a
title SI-PTK DIKBUD BULUKUMBA (Local Distribution Mode)

echo ==========================================================
echo         SISTEM INFORMASI PTK DIKBUD BULUKUMBA
echo             (MODE DISTRIBUSI DESKTOP LOKAL)
echo ==========================================================
echo.
echo Database: Menyimpan data ke folder '/database/' (Format CSV)
echo Status: Sedang mendeteksi lingkungan lokal...
echo.

:: 1. Cek apakah Node.js terpasang di sistem
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan di komputer ini!
    echo Aplikasi ini membutuhkan Node.js agar dapat dijalankan.
    echo.
    echo Sila unduh dan pasang Node.js terlebih dahulu melalui link resmi:
    echo https://nodejs.org/ (Disarankan versi LTS)
    echo.
    echo Setelah menginstal Node.js, sila klik ulang berkas ini.
    echo ==========================================================
    pause
    exit /b
)

:: 2. Cek apakah folder 'node_modules' sudah di-install
if not exist node_modules (
    echo [INFO] Mendeteksi aplikasi baru pertama kali dijalankan.
    echo [INFO] Sedang mengunduh dan memasang dependensi (npm install)...
    echo [INFO] Harap tunggu sebentar, ini hanya dilakukan SEKALI saja.
    echo.
    call npm install
)

:: Cek kembali setelah npm install
if not exist node_modules (
    echo [ERROR] Gagal memasang dependensi. Pastikan koneksi internet aktif untuk pemasangan pertama!
    echo ==========================================================
    pause
    exit /b
)

:: 3. Jalankan server lokal
echo.
echo [OK] Mengaktifkan Server Lokal...
echo [OK] Browser Anda akan otomatis terbuka sesaat lagi!
echo [INFO] JANGAN TUTUP jendela Command Prompt ini selama aplikasi sedang digunakan.
echo ==========================================================
echo.

npm run dev

pause
