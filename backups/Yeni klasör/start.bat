@echo off
echo MufYard V-2.0 Temizleniyor ve Baslatiliyor...
echo.

:: Eski portlari temizle
taskkill /F /IM node.exe /IM electron.exe /IM python.exe /T 2>nul

:: Backend'i ayri bir pencerede baslat
start "MufYard Backend" cmd /c "cd backend && python -m uvicorn app.main:app --reload --port 8000 --host 127.0.0.1"

:: Frontend Dev Server'i baslat
start "MufYard Vite" cmd /c "cd frontend && npm run dev -- --host"

:: Vite'in hazir olmasi icin kisa bir sure bekle (4 saniye)
timeout /t 4 /nobreak > nul

:: Electron penceresini ac
echo Masaustu penceresi aciliyor...
cd frontend && npm run electron

pause
