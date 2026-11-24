import { useCallback, useEffect, useRef, useState } from "react";

const TURLER = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const MAKS_SURE_MS = 10 * 60 * 1000; // deşifre servisi ~20 MB kabul ediyor; 10 dk opus ≈ 5 MB

/** Mikrofon kaydı: `baslat` → `durdur` sonunda kaydedilen sesi döndürür. */
export function useSesKaydi() {
    const [kaydediyor, setKaydediyor] = useState(false);
    const [sure, setSure] = useState(0);
    const kaydedici = useRef<MediaRecorder | null>(null);
    const parcalar = useRef<Blob[]>([]);
    const bitince = useRef<((b: Blob | null) => void) | null>(null);
    const sayac = useRef<number | null>(null);

    const temizle = () => {
        if (sayac.current) window.clearInterval(sayac.current);
        sayac.current = null;
        setKaydediyor(false);
    };

    const baslat = useCallback(async (): Promise<void> => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            throw new Error("Bu cihaz/tarayıcı ses kaydını desteklemiyor.");
        }
        const akis = await navigator.mediaDevices.getUserMedia({ audio: true });
        const tur = TURLER.find(t => MediaRecorder.isTypeSupported?.(t)) || "";
        const k = new MediaRecorder(akis, tur ? { mimeType: tur } : undefined);
        parcalar.current = [];
        k.ondataavailable = e => { if (e.data.size > 0) parcalar.current.push(e.data); };
        k.onstop = () => {
            akis.getTracks().forEach(t => t.stop());
            const ses = new Blob(parcalar.current, { type: (k.mimeType || "audio/webm").split(";")[0] });
            temizle();
            bitince.current?.(ses.size > 1000 ? ses : null);
            bitince.current = null;
        };
        kaydedici.current = k;
        k.start(500);
        setSure(0);
        const basla = Date.now();
        sayac.current = window.setInterval(() => {
            const gecen = Date.now() - basla;
            setSure(Math.floor(gecen / 1000));
            if (gecen >= MAKS_SURE_MS && k.state !== "inactive") k.stop();
        }, 500);
        setKaydediyor(true);
    }, []);

    /** Kaydı bitirir; ses çok kısaysa null döner. */
    const durdur = useCallback((): Promise<Blob | null> => {
        return new Promise(resolve => {
            const k = kaydedici.current;
            if (!k || k.state === "inactive") return resolve(null);
            bitince.current = resolve;
            k.stop();
        });
    }, []);

    useEffect(() => () => {
        const k = kaydedici.current;
        if (k && k.state !== "inactive") k.stop();
        if (sayac.current) window.clearInterval(sayac.current);
    }, []);

    return { kaydediyor, sure, baslat, durdur };
}
