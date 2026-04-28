@echo off
setlocal
set PYTHON_EXE=%~dp0.venv\Scripts\python.exe
set BACKEND_EXE=%~dp0backend\dist\mufyard-backend.exe

echo ===================================================
echo  MufYARD - Release Build
echo ===================================================
echo.

REM --- [1/4] Backend bagimliliklari ---
echo [1/4] Backend bagimliliklari yukleniyor...
cd /d "%~dp0backend"
"%PYTHON_EXE%" -m pip install -r requirements.txt -q || goto :fail

REM --- [2/4] PyInstaller - Her zaman guncel kodu derle ---
echo [2/4] Guncer backend kodu derleniyor (PyInstaller)...
"%PYTHON_EXE%" -m pip install pyinstaller -q || goto :fail
"%PYTHON_EXE%" -m PyInstaller --noconfirm --clean --onedir --name mufyard-backend ^
    --collect-all app ^
    --paths "%~dp0backend" ^
    "%~dp0backend\run_backend.py" || goto :fail
echo [2/4] Backend exe guncellendi.

REM --- [3/4] Frontend build ---
echo [3/4] Frontend derleniyor...
cd /d "%~dp0frontend"
call npm install --silent || goto :fail
call npm run build || goto :fail

REM --- [4/4] Windows installer ---
echo [4/4] Windows installer (NSIS) uretiliyor...
echo       NOT: Kod imzalama sertifikasi gerekmiyor, installer imzasiz olacak.
call npx electron-builder --win nsis --config.win.forceCodeSigning=false || goto :fail

echo.
echo ===================================================
echo [!] BASARILI: Yeni kurulum dosyasi olusturuldu.
echo     Cikti Klasoru: %~dp0frontend\release
echo ===================================================
pause
goto :eof

:fail
echo.
echo [X] HATA: Build islemi sirasinda bir sorun olustu.
pause
exit /b 1
