const { app, BrowserWindow, ipcMain, Notification: NativeNotification, Menu } = require('electron');
const path = require('path');
const os = require('os');
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

function startBackend() {
    if (app.isPackaged) {
        const backendExe = getBackendPath();
        backendProcess = spawn(backendExe, [], {
            stdio: 'ignore',
            windowsHide: true,
        });
    } else {
        const backendPath = getBackendPath();
        const args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'];

        backendProcess = spawn('python', args, {
            cwd: backendPath,
            stdio: 'ignore',
            windowsHide: true,
        });
    }

    backendProcess.on('error', (error) => {
        console.error('Backend baslatilamadi:', error.message);
    });
}

function stopBackend() {
    if (!backendProcess || backendProcess.killed) {
        return;
    }
    backendProcess.kill();
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "MufYard V-2.0",
        icon: path.join(__dirname, 'public/favicon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: true, // Güvenliği etkinleştir, CORS backend tarafından yönetilecek
        }
    });

    // Pencereyi ekranı kaplayacak şekilde aç (başlık çubuğu görünür kalır)
    win.maximize();

    // Menü çubuğunu kaldır (File, Edit, View vs.)
    Menu.setApplicationMenu(null);

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

app.whenReady().then(() => {
    startBackend();
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
