import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import packageJson from '../../../package.json';

export function useVersionCheck() {
    const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
    const currentVersion = packageJson.version;

    useEffect(() => {
        const checkVersion = async () => {
            try {
                // system/config dökümanından en güncel sürümü oku
                const configRef = doc(db, 'system', 'config');
                const snap = await getDoc(configRef);
                
                if (snap.exists()) {
                    const data = snap.data();
                    const latestVersion = data.latest_version;
                    
                    // Eğer buluttaki sürüm yerel sürümden farklıysa (ve daha yeniyse)
                    if (latestVersion && isNewer(latestVersion, currentVersion)) {
                        setUpdateAvailable(latestVersion);
                    }
                }
            } catch (error) {
                console.warn("Sürüm kontrolü atlandı (izin/bağlantı hatası):", (error as any)?.code || error);
            }
        };

        checkVersion();
    }, [currentVersion]);

    return { updateAvailable, currentVersion };
}

// Basit sürüm karşılaştırma (v1.2.3 formatı için)
function isNewer(latest: string, current: string) {
    const l = latest.split('.').map(Number);
    const c = current.split('.').map(Number);
    
    for (let i = 0; i < Math.max(l.length, c.length); i++) {
        const lv = l[i] || 0;
        const cv = c[i] || 0;
        if (lv > cv) return true;
        if (lv < cv) return false;
    }
    return false;
}
