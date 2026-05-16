import React, { useState } from 'react';
import { useGlobalData } from '../lib/context/GlobalDataContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Play, Sparkles, Shield, CheckCircle2, Loader2 } from 'lucide-react';
import { updateProfile } from '../lib/api/profiles';
import { toast } from 'react-hot-toast';

export const TrialStartOverlay: React.FC = () => {
    const { data } = useGlobalData();
    const [loading, setLoading] = useState(false);

    // Sadece trialStarted false ise ve admin değilse göster
    if (data.trialStarted !== false || data.profile?.role === 'admin') return null;

    const handleStartTrial = async () => {
        if (!data.profile?.uid) return;
        
        setLoading(true);
        try {
            await updateProfile(data.profile.uid, { trial_started: true });
            toast.success("30 Günlük deneme süreniz başarıyla başlatıldı!");
            // Kısa bir bekleme sonrası sayfayı yenile ki state kesin temizlensin
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            toast.error("Deneme süresi başlatılamadı.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl p-8 md:p-12 border-none bg-card shadow-2xl rounded-[3rem] relative overflow-hidden">
                {/* Background Decorations */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -mr-32 -mt-32 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full -ml-32 -mb-32 animate-pulse" />

                <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                    <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-white shadow-2xl shadow-primary/40 rotate-3 hover:rotate-0 transition-transform duration-500">
                        <Sparkles size={48} />
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-4xl md:text-5xl font-black font-outfit tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                            MufYard V2.0'a Hoş Geldiniz!
                        </h2>
                        <p className="text-lg text-muted-foreground font-medium max-w-lg mx-auto leading-relaxed">
                            Profesyonel denetim ve yönetim platformunu tam kapasiteyle keşfetmek için 30 günlük ücretsiz deneme sürenizi şimdi başlatın.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
                        {[
                            "Yapay Zeka Destekli Analizler",
                            "Sınırsız Mevzuat Taraması",
                            "Gelişmiş Raporlama Sistemi",
                            "Ekip İçi Canlı İşbirliği"
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 p-4 bg-muted/50 rounded-2xl border border-border/50">
                                <CheckCircle2 className="text-primary shrink-0" size={20} />
                                <span className="text-sm font-bold text-foreground/80">{feature}</span>
                            </div>
                        ))}
                    </div>

                    <div className="w-full pt-4">
                        <Button 
                            onClick={handleStartTrial} 
                            disabled={loading}
                            className="w-full h-16 rounded-[1.5rem] text-xl font-black shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all bg-gradient-to-r from-primary to-blue-600 border-none"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <><Play size={24} className="mr-3 fill-current" /> Deneme Süresini Başlat</>
                            )}
                        </Button>
                        <p className="mt-4 text-[10px] text-muted-foreground font-semibold uppercase tracking-widest flex items-center justify-center gap-2">
                            <Shield size={14} className="text-primary" /> Kredi kartı gerekmez
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};
