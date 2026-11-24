const { contextBridge, ipcRenderer } = require('electron');

// Güvenli köprü: Renderer sürecine sınırlı, kontrollü API sunar.
// nodeIntegration: false + contextIsolation: true ile kullanılır.
contextBridge.exposeInMainWorld('electronAPI', {
    showNotification: (title, body) => {
        ipcRenderer.send('show-notification', { title, body });
    },
    downloadFile: (url, fileName) => {
        return ipcRenderer.invoke('download-file-with-dialog', { url, fileName });
    },
    openFolder: (folderPath) => {
        return ipcRenderer.invoke('open-folder', folderPath);
    },
    showItemInFolder: (filePath) => {
        return ipcRenderer.invoke('show-item-in-folder', filePath);
    },
    exportPhotosToComputer: (photos, folderName) => {
        return ipcRenderer.invoke('export-photos-to-computer', { photos, folderName });
    },
    // Ayarlar > Masaüstü (açılışta başlat, arka planda çalış, genel kısayol)
    masaustuAyarlariAl: () => ipcRenderer.invoke('masaustu-ayarlar-al'),
    masaustuAyarlariKaydet: (degisiklik) => ipcRenderer.invoke('masaustu-ayarlar-kaydet', degisiklik),
    // Platform bilgisi
    platform: process.platform,
    isElectron: true,
});
