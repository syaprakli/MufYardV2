@echo off
echo MufYard V-2.0 Baslatiliyor...
echo.

:: Eski surecleri temizle
taskkill /F /IM node.exe /IM electron.exe /IM python.exe /IM mufyard-backend.exe /IM mufyard-frontend.exe /IM MufYard.exe /T 2>nul

:: Vite dev server'i ayri pencerede baslat
start "MufYard Vite" cmd /c "cd frontend && npm run dev -- --host"

:: Vite hazir olana kadar bekle (3 saniye yeterli)
timeout /t 3 /nobreak > nul

:: Electron'u baslat - backend'i kendisi yonetir (venv python ile)
echo Masaustu uygulamasi aciliyor...
cd frontend && npm run electron

pause
