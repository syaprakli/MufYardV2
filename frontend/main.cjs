const { app, BrowserWindow, ipcMain, Notification: NativeNotification, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

let backendProcess = null;

// Yetki hatalarını ve GPU cache hatalarını engellemek için ayarlar
const userDataPath = path.join(os.homedir(), 'AppData', 'Local', 'MufYardV2');
app.setPath('userData', userDataPath);

// GPU disk cache hatalarını susturmak için (Terminaldeki hataları giderir)
app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Windows Bildirimleri için Uygulama Kimliği (App ID)
if (process.platform === 'win32') {
    app.setAppUserModelId('MufYard V-2.0');
}

function getBackendPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'backend-dist', 'mufyard-backend.exe');
    }
    return path.resolve(__dirname, '..', 'backend');
}

function getLogDir() {
    const logDir = path.join(os.homedir(), 'Documents', 'MufYARD');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    return logDir;
}

function waitForPort(port, retries = 8, delayMs = 2000) {
    return new Promise((resolve, reject) => {
        const attempt = (n) => {
            const sock = net.createConnection({ port, host: '127.0.0.1' });
            sock.on('connect', () => { sock.destroy(); resolve(true); });
            sock.on('error', () => {
                sock.destroy();
                if (n <= 0) return reject(new Error(`Backend port ${port} yanıt vermiyor.`));
                setTimeout(() => attempt(n - 1), delayMs);
            });
        };
        attempt(retries);
    });
}

function killPortProcess(port) {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        // Find and kill any process using the port
        exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}.*LISTENING') do taskkill /F /PID %a`, 
            { shell: 'cmd.exe' },
            () => resolve() // Ignore errors - port might not be in use
        );
    });
}

function startBackend() {
    const backendExe = getBackendPath();
    if (app.isPackaged) {
        app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: [] });

        const logDir = getLogDir();
        const crashLog = path.join(logDir, 'backend_crash.log');
        const logStream = fs.createWriteStream(crashLog, { flags: 'a' });
        logStream.write(`\n\n=== Backend başlatıldı: ${new Date().toISOString()} ===\n`);
        logStream.write(`Exe path: ${backendExe}\n`);
        logStream.write(`CWD: ${path.dirname(backendExe)}\n\n`);

        // Kill any process already on port 8000, then start our backend
        killPortProcess(8000).then(() => {
            backendProcess = spawn(backendExe, [], {
                cwd: path.dirname(backendExe),
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });

            if (backendProcess.stdout) backendProcess.stdout.on('data', d => logStream.write('[OUT] ' + d));
            if (backendProcess.stderr) backendProcess.stderr.on('data', d => logStream.write('[ERR] ' + d));

            backendProcess.on('error', (err) => logStream.write('[SPAWN_ERR] ' + err.message + '\n'));

            backendProcess.on('exit', (code, signal) => {
                logStream.write(`[EXIT] Kod: ${code}, Sinyal: ${signal}\n`);
                if (code !== 0 && code !== null) {
                    if (NativeNotification.isSupported()) {
                        new NativeNotification({
                            title: 'MufYARD - Servis Hatası',
                            body: `Arka plan servisi beklenmedik şekilde kapandı (kod: ${code}). Lütfen uygulamayı yeniden başlatın.`,
                        }).show();
                    }
                }
            });

            // Wait for port 8000 to be ready, notify if it never comes up
            waitForPort(8000)
                .then(() => logStream.write('[INFO] Backend port 8000 hazır.\n'))
                .catch(err => {
                    logStream.write('[FATAL] ' + err.message + '\n');
                    if (NativeNotification.isSupported()) {
                        new NativeNotification({
                            title: 'MufYARD - Bağlantı Hatası',
                            body: `Arka plan servisi başlatılamadı. Log: ${crashLog}`,
                        }).show();
                    }
                });
        });
    } else {
        const backendPath = getBackendPath();
        // Use venv python if available, fallback to system python
        const venvPython = path.join(backendPath, '.venv', 'Scripts', 'python.exe');
        const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';
        const args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'];
        
        console.log(`[DEV] Backend başlatılıyor: ${pythonCmd} ${args.join(' ')}`);
        console.log(`[DEV] CWD: ${backendPath}`);
        
        backendProcess = spawn(pythonCmd, args, {
            cwd: backendPath,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        
        backendProcess.stdout.on('data', (d) => console.log('[BACKEND]', d.toString().trim()));
        backendProcess.stderr.on('data', (d) => console.error('[BACKEND]', d.toString().trim()));
        
        backendProcess.on('error', (error) => {
            console.error('[DEV] Backend başlatılamadı:', error.message);
        });
        
        backendProcess.on('exit', (code) => {
            console.log(`[DEV] Backend kapandı (kod: ${code})`);
        });
    }
}

function stopBackend() {
    if (!backendProcess || backendProcess.killed) {
        return;
    }
    backendProcess.kill();
}

function createWindow() {
    app.setAppUserModelId('com.gsb.mufyardv2');
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "MufYARD",
        icon: path.join(__dirname, 'public/favicon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: true, // Güvenliği etkinleştir, CORS backend tarafından yönetilecek
        }
    });

    // Pencereyi ekranı kaplayacak şekilde aç (başlık çubuğu görünür kalır)
    win.maximize();

    // Menü çubuğunu gizle ama kısayolları (Ctrl+R, Ctrl+Shift+I) aktif bırak
    win.setMenuBarVisibility(false);
    
    if (app.isPackaged) {
        win.loadFile(path.join(__dirname, 'dist', 'index.html'));
        return;
    }

    // Geliştirici araçlarını aç (Sorunu anlamak için geçici olarak aktif)
    win.webContents.openDevTools();

    // Vite sunucusuna hem localhost hem 127.0.0.1 üzerinden erişimi dene
    win.loadURL('http://localhost:5173').catch(() => {
        return win.loadURL('http://127.0.0.1:5173');
    }).catch(() => {
        console.error("Vite sunucusuna baglanilamadi. Lutfen 'npm run dev' komutunun acik oldugundan emin olun.");
    });
}

app.whenReady().then(async () => {
    startBackend();
    
    if (!app.isPackaged) {
        // Dev modda backend'in hazır olmasını bekle
        console.log('[DEV] Backend hazır olması bekleniyor...');
        try {
            await waitForPort(8000, 15, 1500); // 15 deneme, 1.5s aralık = max ~22s
            console.log('[DEV] Backend hazır! Pencere açılıyor.');
        } catch (e) {
            console.error('[DEV] Backend başlatılamadı, pencere yine de açılacak.');
        }
    }
    
    createWindow();
});

app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    stopBackend();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Bildirim Köprüsü: Renderer sürecinden gelen talepleri dinle
ipcMain.on('show-notification', (event, { title, body }) => {
    console.log(`\n[!] BİLDİRİM TALEBİ ALINDI: ${title}`);
    
    if (!NativeNotification.isSupported()) {
        console.log("[-] HATA: Bu sistemde NativeNotification desteklenmiyor.");
        return;
    }

    const notification = new NativeNotification({
        title: title,
        body: body,
        silent: false,
        timeoutType: 'never', // Kullanıcı kapatana kadar durur
        urgency: 'critical', // Bazı sistemlerde önceliği artırır
    });
    
    console.log("[+] Bildirim gösteriliyor...");
    notification.show();

    notification.on('click', () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    notification.on('show', () => console.log("[+] Bildirim ekrana fırlatıldı."));
    notification.on('error', (err) => console.error("[-] BİLDİRİM HATASI:", err));
});
