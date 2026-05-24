import React, { useState } from 'react';
import { useGlobalData } from '../lib/context/GlobalDataContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Shield, Lock, Loader2, Sparkles, Key, Mail, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_URL } from '../lib/config';
import { getAuthHeaders, fetchWithTimeout } from '../lib/api/utils';

export const TrialOverlay: React.FC = () => {
    const { data, refreshProfile } = useGlobalData();
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);

    if (!data.isTrialExpired) return null;

    const handleActivate = async () => {
        if (!key.trim()) {
            toast.error("Lütfen bir lisans anahtarı giriniz.");
            return;
        }

        setLoading(true);
        try {
            const headers = await getAuthHeaders({ "Content-Type": "application/json" });
            const res = await fetchWithTimeout(`${API_URL}/licenses/activate`, {
                method: "POST",
                headers,
                body: JSON.stringify({ key: key.trim() }),
            });

            if (res.ok) {
                toast.success("Tebrikler! Pro sürüm başarıyla aktifleştirildi.");
                // Test modunu temizle
                localStorage.removeItem('mufyard_debug_expired');

                if (data.profile?.uid) {
                    await refreshProfile(data.profile.uid, data.profile.email);
                }
                // Refresh to clear the overlay
                window.location.reload();
            } else {
                const err = await res.json();
                toast.error(err.detail || "Geçersiz lisans anahtarı.");
            }
        } catch (error) {
            toast.error("Sunucuya bağlanılamadı.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
            <Card className="w-full max-w-lg p-8 md:p-12 border-none bg-card shadow-2xl rounded-[2.5rem] relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -ml-16 -mb-16" />

                <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <Lock size={40} className="animate-pulse" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-3xl font-black font-outfit tracking-tight text-foreground">Deneme Süreniz Doldu</h2>
                        <p className="text-muted-foreground font-medium">
                            MufYard V2.0 platformunu 30 gün boyunca ücretsiz denediniz. Devam etmek için Pro lisans anahtarınızı giriniz.
                        </p>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="relative group">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                            <input
                                type="text"
                                value={key}
                                onChange={(e) => setKey(e.target.value.toUpperCase())}
                                placeholder="PRO-XXXX-XXXX-XXXX"
                                className="w-full h-14 pl-12 pr-4 bg-muted border border-border rounded-2xl text-lg font-mono font-black tracking-widest text-center focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                            />
                        </div>

                        <Button 
                            onClick={handleActivate} 
                            disabled={loading}
                            className="w-full h-14 rounded-2xl text-lg font-black shadow-xl shadow-primary/20"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <><Sparkles size={20} className="mr-2" /> Lisansı Aktifleştir</>}
                        </Button>
                    </div>

                    <div className="pt-4 border-t border-border w-full flex flex-col items-center gap-4">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest flex items-center gap-2">
                            <Shield size={14} className="text-primary" /> Verileriniz Güvende
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">
                            Lisans Aktivasyon Destek Hattı
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                            <a 
                                href="mailto:sefayaprakli@hotmail.com" 
                                className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/10 text-primary hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/20 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                    <Mail size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">E-POSTA</p>
                                    <p className="text-xs font-black">sefayaprakli@hotmail.com</p>
                                </div>
                            </a>
                            <a 
                                href="tel:05368318846" 
                                className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/10 text-primary hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/20 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                    <Phone size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60">TELEFON</p>
                                    <p className="text-xs font-black">0536 831 88 46</p>
                                </div>
                            </a>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
