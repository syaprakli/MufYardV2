import React from "react";
import { Bell, Shield, Key, FileText, AlertTriangle, Database, Zap, HardDrive, Globe } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cn } from "../../lib/utils";

// --- Bildirim Sekmesi ---
export const NotificationSection = ({ 
    profile, isElectron, handleSistemBildirimiAc, handleSendTestNotification 
}: any) => (
    <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Bell className="text-primary" size={24} />
                <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Bildirim Tercihleri</h3>
            </div>
            <div 
                onClick={handleSistemBildirimiAc}
                className={cn(
                    "w-14 h-8 rounded-full relative cursor-pointer transition-all duration-300",
                    profile?.notifications_enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                )}
            >
                <div className={cn(
                    "absolute top-1 w-6 h-6 bg-card rounded-full shadow-lg transition-all duration-300",
                    profile?.notifications_enabled ? "right-1" : "left-1"
                )} />
            </div>
        </div>
        <div className="space-y-4">
            <div className="flex items-start justify-between p-4 rounded-2xl bg-muted/50 border border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                    <h4 className="text-sm font-bold">Sistem Bildirimleri</h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                        {isElectron ? "Önemli gelişmeleri Windows bildirim merkezi ile bana ilet." : "Uygulama bildirimlerini tarayıcı üzerinden aktif et."}
                    </p>
                </div>
            </div>
            {profile?.notifications_enabled && (
                <Button variant="outline" onClick={handleSendTestNotification} className="w-full rounded-2xl h-12 font-bold">
                    Test Bildirimi Gönder
                </Button>
            )}
        </div>
    </Card>
);

// --- Güvenlik Sekmesi ---
export const SecuritySection = ({ handlePasswordReset, resettingPassword, resetCooldown }: any) => (
    <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
        <div className="flex items-center gap-3">
            <Shield className="text-primary" size={24} />
            <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Hesap Güvenliği</h3>
        </div>
        <div className="p-6 bg-muted dark:bg-slate-800 rounded-3xl space-y-4">
            <div className="flex items-center gap-3 text-primary">
                <Key size={20} />
                <span className="font-bold text-sm">Şifre İşlemleri</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Hesap güvenliğiniz için şifrenizi düzenli aralıklarla güncelleyin.</p>
            <Button variant="outline" className="w-full rounded-2xl h-12 font-bold" onClick={handlePasswordReset} disabled={resettingPassword || resetCooldown > 0}>
                {resettingPassword ? "Gönderiliyor..." : resetCooldown > 0 ? `Tekrar gönder (${resetCooldown}s)` : "Şifre Sıfırlama Bağlantısı Gönder"}
            </Button>
        </div>
    </Card>
);

// --- Lisans Sekmesi ---
export const LicenseSection = ({ 
    profile, licenseKey, setLicenseKey, handleActivateLicense, activatingLicense 
}: any) => (
    <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Zap className="text-primary" size={24} />
                <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Lisans & Abonelik</h3>
            </div>
            {profile?.has_premium_ai && <div className="px-4 py-2 bg-emerald-500 text-white rounded-2xl font-black text-[10px]">PRO AKTİF</div>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-4">
                <span className="text-[10px] font-black uppercase text-slate-400">Mevcut Durum</span>
                <h4 className="text-3xl font-black">
                    {profile?.has_premium_ai 
                        ? (profile?.premium_until 
                            ? (profile?.premium_type ? profile.premium_type.toUpperCase() : "SÜRELİ") + " PRO" 
                            : (profile?.premium_type || "SINIRSIZ").toUpperCase() + " PRO")
                        : "KAYITLI"}
                </h4>
                {profile?.has_premium_ai && profile?.premium_until && (
                    <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-wider">
                        <Zap size={14} className="fill-rose-500" />
                        Süre Sonu: {new Date(profile.premium_until).toLocaleDateString('tr-TR')}
                    </div>
                )}
            </div>
            <div className="p-8 rounded-[2rem] bg-primary/5 border border-primary/10 space-y-4">
                <span className="text-[10px] font-black uppercase text-primary">Lisans Etkinleştir</span>
                <input 
                    type="text" value={licenseKey} 
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    className="w-full h-12 px-4 rounded-xl border border-primary/20 text-sm font-black"
                    placeholder="XXXX-XXXX-XXXX"
                />
                <Button onClick={handleActivateLicense} disabled={activatingLicense || !licenseKey.trim()} className="w-full h-12 font-bold">
                    {activatingLicense ? "İşleniyor..." : "PRO'YU AKTİFLEŞTİR"}
                </Button>
            </div>
        </div>
    </Card>
);

// --- Veri Ayarları Sekmesi ---
export const DataSection = ({ 
    handleLocalBackup, handleDriveBackup, backupLoading, driveBackupLoading, handleDataImport
}: any) => {
    const importRef = React.useRef<HTMLInputElement>(null);
    return (
    <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
        <div className="flex items-center gap-3">
            <Database className="text-primary" size={24} />
            <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Veri Yönetimi & Yedekleme</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-muted rounded-3xl space-y-4">
                <div className="flex items-center gap-3 text-primary"><HardDrive size={20} /><span className="font-bold text-sm">Yerel Yedekleme & Geri Yükleme</span></div>
                <p className="text-xs text-slate-500">Tüm verilerinizi bilgisayarınıza indirin veya geri yükleyin.</p>
                <div className="flex gap-2">
                    <Button variant="outline" className="w-full h-12 font-bold" onClick={handleLocalBackup} disabled={backupLoading}>
                        {backupLoading ? "İndiriliyor..." : "Veri İndir"}
                    </Button>
                    <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleDataImport} />
                    <Button variant="outline" className="w-full h-12 font-bold" onClick={() => importRef.current?.click()}>
                        Veri Yükle
                    </Button>
                </div>
            </div>
            <div className="p-6 bg-primary/5 rounded-3xl space-y-4 border border-primary/10">
                <div className="flex items-center gap-3 text-primary"><Globe size={20} /><span className="font-bold text-sm">Bulut Yedekleme</span></div>
                <p className="text-xs text-slate-500">Verilerinizi güvenli bir şekilde Google Drive'a yedekleyin.</p>
                <Button className="w-full h-12 font-bold" onClick={handleDriveBackup} disabled={driveBackupLoading}>
                    {driveBackupLoading ? "Yükleniyor..." : "Drive'a Yedekle"}
                </Button>
            </div>
        </div>
    </Card>
    );
};

// --- Rapor Ayarları Sekmesi ---
export const ReportSection = ({ raporOnek, setRaporOnek, handleSave, saving }: any) => (
    <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
        <div className="flex items-center gap-3">
            <FileText className="text-primary" size={24} />
            <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Kodlama Standartları</h3>
        </div>
        <div className="p-6 bg-muted dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
            <label className="text-[11px] font-bold text-slate-400 mb-3 block">Varsayılan Rapor Kodu Ön Eki</label>
            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    className="flex-1 p-4 bg-card border border-border text-foreground rounded-xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none"
                    value={raporOnek}
                    onChange={(e) => setRaporOnek(e.target.value)}
                    placeholder="Örn: S.Y.64"
                />
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto rounded-xl px-8 h-14 font-bold"
                >
                    {saving ? "Kaydediliyor..." : "Güncelle ve Kaydet"}
                </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 font-medium flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-500" />
                Örnek Görünüm: <span className="font-bold text-primary">{raporOnek}/{new Date().getFullYear()}/001</span>
            </p>
        </div>
    </Card>
);
