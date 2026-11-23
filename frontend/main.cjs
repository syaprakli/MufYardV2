const { app, BrowserWindow, ipcMain, Notification: NativeNotification, Menu, dialog, shell, Tray } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const net = require('net');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

let backendProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let hasShownTrayBalloon = false;

// Yetki hatalarını ve GPU cache hatalarını engellemek için ayarlar
const userDataPath = path.join(os.homedir(), 'AppData', 'Local', 'MufYardV2');
app.setPath('userData', userDataPath);

// GPU disk cache hatalarını susturmak için (Terminaldeki hataları giderir)
app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-http-cache');

// Cache dizinini temp altına taşıyarak "Erişim engellendi" hatalarını azalt.
const electronCacheDir = path.join(os.tmpdir(), 'MufYardV2', 'electron-cache');
try {
    if (!fs.existsSync(electronCacheDir)) {
        fs.mkdirSync(electronCacheDir, { recursive: true });
    }
    app.commandLine.appendSwitch('disk-cache-dir', electronCacheDir);
} catch {
    // cache dizini oluşturulamazsa varsayılan davranışla devam et.
}

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

function isPortReachable(port, host = '127.0.0.1', timeoutMs = 800) {
    return new Promise((resolve) => {
        const sock = net.createConnection({ port, host });
        const finalize = (result) => {
            try {
                sock.destroy();
            } catch {
                // no-op
            }
            resolve(result);
        };

        sock.setTimeout(timeoutMs);
        sock.on('connect', () => finalize(true));
        sock.on('timeout', () => finalize(false));
        sock.on('error', () => finalize(false));
    });
}

function killPortProcess(port) {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        // Find and kill any process tree using the port
        exec(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}.*LISTENING') do taskkill /F /T /PID %a`, 
            { shell: 'cmd.exe' },
            () => {
                setTimeout(resolve, 800);
            }
        );
    });
}

async function startBackend() {
    if (app.isPackaged) {
        // Paketli masaüstü uygulamasında yerel backend başlatılmaz; merkezi Railway backend kullanılır.
        app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: [] });
        return;
    }

    const backendPath = getBackendPath();
    const backendAlreadyRunning = await isPortReachable(8000);

    if (backendAlreadyRunning) {
        console.log('[DEV] Port 8000 aktif. Eski backend süreci sonlandırılıp güncel backend başlatılacak.');
        await killPortProcess(8000);
    }

    const venvPython = path.join(backendPath, '.venv', 'Scripts', 'python.exe');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python';
    const args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'];

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

function stopBackend() {
    if (!backendProcess || backendProcess.killed) {
        return;
    }
    backendProcess.kill();
}

function getTrayIconPath() {
    const candidates = [
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'public', 'favicon.ico'),
        path.join(__dirname, 'dist', 'favicon.ico'),
        path.join(process.resourcesPath, 'icon.ico'),
        path.join(process.resourcesPath, 'app', 'icon.ico')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return path.join(__dirname, 'public', 'favicon.ico');
}

function createTray() {
    if (tray) return;

    try {
        const iconPath = getTrayIconPath();
        tray = new Tray(iconPath);
        tray.setToolTip('MufYARD V-2.0');

        const contextMenu = Menu.buildFromTemplate([
            {
                label: "MufYARD'ı Göster",
                click: () => {
                    if (mainWindow) {
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Çıkış',
                click: () => {
                    isQuitting = true;
                    stopBackend();
                    app.quit();
                }
            }
        ]);

        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (!mainWindow) return;
            if (mainWindow.isVisible()) {
                if (mainWindow.isMinimized()) {
                    mainWindow.restore();
                    mainWindow.focus();
                } else if (!mainWindow.isFocused()) {
                    mainWindow.focus();
                } else {
                    mainWindow.hide();
                }
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        });

        tray.on('double-click', () => {
            if (!mainWindow) return;
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        });
    } catch (err) {
        console.error('Tray simgesi oluşturulamadı:', err);
    }
}

function createWindow() {
    app.setAppUserModelId('com.gsb.mufyardv2');
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "MufYARD",
        icon: getTrayIconPath(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
            plugins: true,
            webSecurity: !app.isPackaged, // Geliştirmede kapalı (localhost CORS), üretimde açık
            allowRunningInsecureContent: false,
        }
    });

    mainWindow = win;

    // Pencereyi ekranı kaplayacak şekilde aç (başlık çubuğu görünür kalır)
    win.maximize();

    // Menü çubuğunu gizle ama kısayolları (Ctrl+R, Ctrl+Shift+I) aktif bırak
    win.setMenuBarVisibility(false);
    
    // Dış bağlantıları (ve window.open çağrılarını) varsayılan sistem tarayıcısında aç
    win.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'https:') {
                shell.openExternal(parsed.href);
            } else {
                console.warn('[ELECTRON] Blocked non-https external URL:', parsed.protocol);
            }
        } catch {
            console.warn('[ELECTRON] Blocked invalid external URL');
        }
        return { action: 'deny' };
    });

    // Kapatma (X) butonuna basıldığında uygulamayı tamamen kapatmak yerine sistem tepsisine (saatin yanına) gizle
    win.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            win.hide();

            if (!hasShownTrayBalloon) {
                hasShownTrayBalloon = true;
                try {
                    if (tray && process.platform === 'win32') {
                        tray.displayBalloon({
                            title: 'MufYARD Arka Planda',
                            content: 'Uygulama bildirim alanında çalışmaya devam ediyor. Tamamen kapatmak için simgeye sağ tıklayıp "Çıkış"ı seçin.',
                            iconType: 'info'
                        });
                    } else if (NativeNotification.isSupported()) {
                        new NativeNotification({
                            title: 'MufYARD Arka Planda',
                            body: 'Uygulama bildirim alanında çalışmaya devam ediyor. Tamamen kapatmak için sistem tepsisindeki simgeden çıkış yapabilirsiniz.'
                        }).show();
                    }
                } catch {
                    // Bildirim gösterilemezse sessizce devam et
                }
            }
            return false;
        }
    });
    
    if (app.isPackaged) {
        win.loadFile(path.join(__dirname, 'dist', 'index.html'));
        return;
    }

    // Vite sunucusuna hem localhost hem 127.0.0.1 üzerinden erişimi dene
    win.loadURL('http://localhost:5173').catch(() => {
        return win.loadURL('http://127.0.0.1:5173');
    }).catch(() => {
        console.error("Vite sunucusuna baglanilamadi. Lutfen 'npm run dev' komutunun acik oldugundan emin olun.");
    });
}

// Tekil çalışma kontrolü (Single Instance Lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        await startBackend();
        
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
        createTray();
    });

    app.on('window-all-closed', () => {
        if (isQuitting) {
            stopBackend();
            if (process.platform !== 'darwin') app.quit();
        }
    });

    app.on('before-quit', () => {
        isQuitting = true;
        stopBackend();
    });

    app.on('activate', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        } else if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}

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

ipcMain.handle('download-file-with-dialog', async (_event, { url, fileName }) => {
    try {
        if (!url || typeof url !== 'string') {
            return { ok: false, error: 'Geçersiz dosya adresi.' };
        }

        const safeName = String(fileName || 'dosya').replace(/[\\/:*?"<>|]/g, '_');
        const browserWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        const saveResult = await dialog.showSaveDialog(browserWindow, {
            title: 'Dosyayı Kaydet',
            defaultPath: path.join(app.getPath('downloads'), safeName)
        });

        if (saveResult.canceled || !saveResult.filePath) {
            return { ok: false, canceled: true };
        }

        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return { ok: false, error: 'Yalnızca http/https adreslerine izin verilir.' };
        }
        const client = parsed.protocol === 'https:' ? https : http;

        await new Promise((resolve, reject) => {
            const request = client.get(parsed, (response) => {
                if (response.statusCode && response.statusCode >= 400) {
                    reject(new Error(`Dosya indirilemedi (HTTP ${response.statusCode})`));
                    response.resume();
                    return;
                }

                const writer = fs.createWriteStream(saveResult.filePath);
                response.pipe(writer);

                writer.on('finish', () => {
                    writer.close(resolve);
                });

                writer.on('error', reject);
                response.on('error', reject);
            });

            request.on('error', reject);
        });

        return { ok: true, filePath: saveResult.filePath };
    } catch (err) {
        return {
            ok: false,
            error: err && err.message ? err.message : 'Dosya kaydedilemedi.'
        };
    }
});

function getSafeMufyardRoot() {
    const rootDir = path.resolve(os.homedir(), 'Documents', 'MufYARD');
    if (!fs.existsSync(rootDir)) {
        fs.mkdirSync(rootDir, { recursive: true });
    }
    return rootDir;
}

function resolveSafeMufyardPath(inputPath, defaultSubdir = 'Mevzuat') {
    const rootDir = getSafeMufyardRoot();
    if (!inputPath || typeof inputPath !== 'string' || !inputPath.trim()) {
        return path.join(rootDir, defaultSubdir);
    }
    const raw = inputPath.trim();
    const resolved = path.isAbsolute(raw)
        ? path.resolve(raw)
        : path.resolve(rootDir, raw.replace(/^[/\\]+/, ''));
    const rel = path.relative(rootDir, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error('Geçersiz yol: yalnızca Documents/MufYARD altındaki yollara izin verilir.');
    }
    return resolved;
}

ipcMain.handle('open-folder', async (_event, folderPath) => {
    try {
        const fullPath = resolveSafeMufyardPath(folderPath, 'Mevzuat');
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        console.log('[ELECTRON] open-folder resolving path:', fullPath);
        const err = await shell.openPath(fullPath);
        if (err) {
            console.error('[ELECTRON] openPath hatasi:', err);
            return { ok: false, error: err };
        }
        return { ok: true, path: fullPath };
    } catch (e) {
        console.error('[ELECTRON] open-folder hatasi:', e);
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('show-item-in-folder', async (_event, filePath) => {
    try {
        console.log('[ELECTRON] show-item-in-folder requested:', filePath);
        const isWebUrl = typeof filePath === 'string' && (filePath.startsWith('http://') || filePath.startsWith('https://'));
        if (!filePath || isWebUrl) {
            const defaultDir = resolveSafeMufyardPath('', 'Mevzuat');
            if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });
            await shell.openPath(defaultDir);
            return { ok: true, type: 'folder', path: defaultDir, message: isWebUrl ? "Bu mevzuat web ?zerinden eklenmi?; genel mevzuat klas?r? a??ld?." : undefined };
        }

        let fullPath;
        if (path.isAbsolute(filePath)) {
            fullPath = resolveSafeMufyardPath(filePath, 'Mevzuat');
        } else {
            const clean = String(filePath).replace(/^[/\\]+/, '').replace(/^Mevzuat[/\\]+/i, '');
            const cand = resolveSafeMufyardPath(path.join('Mevzuat', clean), 'Mevzuat');
            if (fs.existsSync(cand)) {
                fullPath = cand;
            } else {
                const cand2 = resolveSafeMufyardPath(filePath, 'Mevzuat');
                fullPath = fs.existsSync(cand2) ? cand2 : cand;
            }
        }

        console.log('[ELECTRON] Resolved item path:', fullPath, 'Exists:', fs.existsSync(fullPath));

        if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                await shell.openPath(fullPath);
                return { ok: true, type: 'folder', path: fullPath };
            } else {
                shell.showItemInFolder(fullPath);
                return { ok: true, type: 'file', path: fullPath };
            }
        } else {
            const parentDir = resolveSafeMufyardPath(path.dirname(fullPath), 'Mevzuat');
            if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
            await shell.openPath(parentDir);
            return { ok: true, type: 'folder', path: parentDir, message: "Dosya yerel klas?rde bulunamad?, ilgili klas?r a??ld?." };
        }
    } catch (e) {
        console.error('[ELECTRON] show-item-in-folder hatasi:', e);
        return { ok: false, error: e.message };
    }
});

function downloadUrlToFile(fileUrl, destPath, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (!fileUrl || typeof fileUrl !== 'string') {
            return reject(new Error('Geçersiz URL'));
        }

        if (fileUrl.startsWith('data:')) {
            try {
                const base64Data = fileUrl.replace(/^data:image\/\w+;base64,/, '');
                fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
                return resolve();
            } catch (err) {
                return reject(err);
            }
        }

        const fetchAttempt = (currentUrl, redirectsLeft) => {
            if (redirectsLeft <= 0) {
                return reject(new Error('Çok fazla yönlendirme (redirect limit).'));
            }
            try {
                const parsed = new URL(currentUrl);
                if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                    return reject(new Error('Yalnızca http/https adreslerine izin verilir.'));
                }
                const client = parsed.protocol === 'https:' ? https : http;
                const req = client.get(parsed, (res) => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        const redirectUrl = new URL(res.headers.location, currentUrl).href;
                        res.resume();
                        return fetchAttempt(redirectUrl, redirectsLeft - 1);
                    }
                    if (res.statusCode >= 400) {
                        res.resume();
                        return reject(new Error(`İndirme hatası: HTTP ${res.statusCode}`));
                    }
                    const fileStream = fs.createWriteStream(destPath);
                    res.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close(resolve);
                    });
                    fileStream.on('error', (err) => {
                        fs.unlink(destPath, () => {});
                        reject(err);
                    });
                });
                req.on('error', reject);
            } catch (err) {
                reject(err);
            }
        };

        fetchAttempt(fileUrl, maxRedirects);
    });
}

ipcMain.handle('export-photos-to-computer', async (_event, { photos, folderName }) => {
    try {
        if (!photos || !Array.isArray(photos) || photos.length === 0) {
            return { ok: false, error: 'Aktarılacak fotoğraf bulunamadı.' };
        }

        const safeFolderName = String(folderName || 'Denetim_Fotograflari')
            .replace(/[\\/:*?"<>|]/g, '_')
            .trim() || 'Denetim_Fotograflari';

        const defaultDir = path.join(os.homedir(), 'Documents', 'MufYARD', 'Fotograflar', safeFolderName);
        if (!fs.existsSync(defaultDir)) {
            fs.mkdirSync(defaultDir, { recursive: true });
        }

        const browserWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        const openResult = await dialog.showOpenDialog(browserWindow, {
            title: 'Fotoğrafların Aktarılacağı Klasörü Seçin',
            defaultPath: defaultDir,
            properties: ['openDirectory', 'createDirectory'],
            buttonLabel: 'Bu Klasöre Aktar'
        });

        if (openResult.canceled || !openResult.filePaths || openResult.filePaths.length === 0) {
            return { ok: false, canceled: true };
        }

        const targetFolder = openResult.filePaths[0];
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, { recursive: true });
        }

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < photos.length; i++) {
            const item = photos[i];
            const rawUrl = typeof item === 'string' ? item : (item && item.url ? item.url : '');
            if (!rawUrl) continue;

            const extMatch = rawUrl.match(/\.(jpg|jpeg|png|webp|gif)/i);
            const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.jpg';
            const fileName = `Foto_${String(i + 1).padStart(2, '0')}${ext}`;
            const targetFilePath = path.join(targetFolder, fileName);

            try {
                await downloadUrlToFile(rawUrl, targetFilePath);
                successCount++;
            } catch (err) {
                console.error(`Fotoğraf #${i + 1} indirilemedi:`, err);
                failCount++;
            }
        }

        // Klasörü Windows Gezgini'nde aç
        await shell.openPath(targetFolder);

        return {
            ok: true,
            folderPath: targetFolder,
            total: photos.length,
            successCount,
            failCount
        };
    } catch (err) {
        console.error('[ELECTRON] export-photos-to-computer hatasi:', err);
        return { ok: false, error: err && err.message ? err.message : 'Fotoğraflar aktarılamadı.' };
    }
});

