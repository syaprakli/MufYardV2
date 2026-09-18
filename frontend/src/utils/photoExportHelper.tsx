import toast from "react-hot-toast";

/**
 * Dosyayı yerel cihaza indirip galeri/indirilenler klasörüne yazan iç yardımcı
 */
function downloadFileLocally(file: File | Blob, fileName: string) {
    const blobUrl = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

/**
 * Fotoğraf çekildiğinde / yüklendiğinde kullanıcıya onay sorar:
 * Kullanıcı isterse "Evet, Galeriye Kaydet" ile onaylar,
 * isterse "Reddet (Sadece Bulut)" ile galeriye kaydetmeden devam eder.
 */
export function savePhotoToLocalDevice(
    filesOrFile: (File | Blob)[] | File | Blob,
    prefix = "MufYard_Foto"
): void {
    const files = Array.isArray(filesOrFile) ? filesOrFile : [filesOrFile];
    if (!files || files.length === 0) return;

    const count = files.length;
    const firstFile = files[0];
    let previewUrl = "";
    try {
        previewUrl = URL.createObjectURL(firstFile);
    } catch {
        // ignore
    }

    toast((t) => (
        <div className="flex flex-col gap-3 p-1 min-w-[280px] max-w-sm sm:max-w-md">
            <div className="flex items-start gap-3">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt="Önizleme"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0 text-xl">
                        📸
                    </div>
                )}
                <div className="flex-1">
                    <h5 className="text-xs font-bold text-slate-850 dark:text-slate-100">
                        {count === 1 ? "Fotoğraf Galeriye Kaydedilsin mi?" : `${count} Adet Fotoğraf Galeriye Kaydedilsin mi?`}
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        Bulut kaydına ek olarak telefonunuzun / cihazınızın fotoğraf galerisine de kaydedilsin mi?
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                    type="button"
                    onClick={() => {
                        toast.dismiss(t.id);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        toast("Fotoğraf sadece buluta yüklendi.", {
                            id: "photo-skipped",
                            icon: "☁️",
                            duration: 2500
                        });
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95 cursor-pointer"
                >
                    Reddet (Sadece Bulut)
                </button>

                <button
                    type="button"
                    onClick={() => {
                        toast.dismiss(t.id);
                        const now = new Date();
                        const dateStr = now.getFullYear().toString() +
                            String(now.getMonth() + 1).padStart(2, "0") +
                            String(now.getDate()).padStart(2, "0") + "_" +
                            String(now.getHours()).padStart(2, "0") +
                            String(now.getMinutes()).padStart(2, "0") +
                            String(now.getSeconds()).padStart(2, "0");

                        files.forEach((f, idx) => {
                            let ext = ".jpg";
                            if (f instanceof File && f.name) {
                                const match = f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                                if (match) ext = `.${match[1].toLowerCase()}`;
                            }
                            const fileName = count === 1 ? `${prefix}_${dateStr}${ext}` : `${prefix}_${dateStr}_${idx + 1}${ext}`;
                            downloadFileLocally(f, fileName);
                        });

                        if (previewUrl) {
                            setTimeout(() => URL.revokeObjectURL(previewUrl), 6000);
                        }

                        toast.success(
                            count === 1 ? "Fotoğraf cihaz galerisine kaydedildi." : `${count} fotoğraf cihaz galerisine kaydedildi.`,
                            { id: "photo-saved-success", icon: "💾", duration: 3500 }
                        );
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm shadow-blue-500/25 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                    <span>Evet, Galeriye Kaydet</span>
                </button>
            </div>
        </div>
    ), {
        id: "photo-gallery-confirm",
        duration: 15000,
        position: "bottom-center"
    });
}

/**
 * Electron uygulamasında fotoğrafları tek tıkla Windows klasörüne aktarır.
 * Web ortamında (telefon, tablet veya tarayıcı) ise fotoğrafları sırayla yerel cihaza indirir.
 */
export async function exportPhotosToComputer(
    photos: (string | { url: string; title?: string })[],
    folderName = "Denetim_Fotograflari"
): Promise<void> {
    if (!photos || photos.length === 0) {
        toast.error("Aktarılacak fotoğraf bulunamadı.");
        return;
    }

    const electronAPI = (window as any)?.electronAPI;

    // 1. Electron Masaüstü Uygulamasında Çalışıyorsa
    if (electronAPI?.exportPhotosToComputer) {
        const toastId = toast.loading(`${photos.length} fotoğraf bilgisayara aktarılıyor...`);
        try {
            const rawUrls = photos.map(p => typeof p === "string" ? p : p.url).filter(Boolean);
            const res = await electronAPI.exportPhotosToComputer(rawUrls, folderName);

            if (res?.canceled) {
                toast.dismiss(toastId);
                return;
            }

            if (res?.ok) {
                toast.success(
                    `${res.successCount || rawUrls.length} fotoğraf bilgisayarınıza aktarıldı ve klasör açıldı.`,
                    { id: toastId, duration: 5000, icon: "📂" }
                );
            } else {
                toast.error(res?.error || "Fotoğraflar aktarılamadı.", { id: toastId });
            }
        } catch (error: any) {
            console.error("Electron export error:", error);
            toast.error(error?.message || "Fotoğraflar aktarılırken hata oluştu.", { id: toastId });
        }
        return;
    }

    // 2. Web Ortamında (Telefon, Tablet veya Tarayıcı) Çalışıyorsa
    const toastId = toast.loading(`${photos.length} fotoğraf indiriliyor...`);
    try {
        let count = 0;
        for (let i = 0; i < photos.length; i++) {
            const item = photos[i];
            const url = typeof item === "string" ? item : item.url;
            if (!url) continue;

            const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
            const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : ".jpg";
            const fileName = `${folderName}_Foto_${String(i + 1).padStart(2, "0")}${ext}`;

            try {
                const resp = await fetch(url);
                const blob = await resp.blob();
                downloadFileLocally(blob, fileName);
                count++;
                await new Promise(r => setTimeout(r, 250)); // Tarayıcı indirme engellerini önle
            } catch (fetchErr) {
                console.warn(`Fotoğraf ${i + 1} indirilemedi:`, fetchErr);
            }
        }

        toast.success(`${count} fotoğraf başarıyla indirildi.`, { id: toastId, duration: 4000 });
    } catch (err: any) {
        console.error("Web export error:", err);
        toast.error("Fotoğraflar indirilirken bir hata oluştu.", { id: toastId });
    }
}
