@echo off
setlocal

set PYTHON_EXE=%~dp0.venv\Scripts\python.exe

echo [1/5] Backend bagimliliklari yukleniyor...
cd /d "%~dp0backend"
"%PYTHON_EXE%" -m pip install -r requirements.txt
if errorlevel 1 goto :fail

echo [2/5] PyInstaller yukleniyor...
"%PYTHON_EXE%" -m pip install pyinstaller
if errorlevel 1 goto :fail

echo [3/5] Backend exe olusturuluyor...
"%PYTHON_EXE%" -m PyInstaller --noconfirm --clean --onefile --name mufyard-backend --paths "%~dp0backend" "%~dp0backend\run_backend.py"
if errorlevel 1 goto :fail

echo [4/5] Frontend bagimliliklari yukleniyor...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 goto :fail

echo [5/5] Windows installer uretiliyor...
call npm run dist:win
if errorlevel 1 goto :fail

echo [6/6] Cikti klasoru:
echo %~dp0frontend\release

echo [6/6] Tamamlandi.
goto :eof

:fail
echo Build islemi basarisiz oldu.
exit /b 1
