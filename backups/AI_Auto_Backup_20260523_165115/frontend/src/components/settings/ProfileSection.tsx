import { User, Camera, LayoutGrid, Loader2, Save, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { toast } from "react-hot-toast";
import { updateProfile, type Profile } from "../../lib/api/profiles";

interface ProfileSectionProps {
    user: any;
    profile: Profile | null;
    setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
    uploadingAvatar: boolean;
    setUploadingAvatar: React.Dispatch<React.SetStateAction<boolean>>;
    handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    avatarInputRef: React.RefObject<HTMLInputElement | null>;
    showAvatarModal: boolean;
    setShowAvatarModal: React.Dispatch<React.SetStateAction<boolean>>;
    resolveUrl: (url: string | null) => string | null;
    handleSave: () => Promise<void>;
    saving: boolean;
    globalRefreshProfile: (uid: string, email?: string) => Promise<void>;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
    user,
    profile,
    setProfile,
    uploadingAvatar,
    setUploadingAvatar,
    handleAvatarUpload,
    avatarInputRef,
    showAvatarModal,
    setShowAvatarModal,
    resolveUrl,
    handleSave,
    saving,
    globalRefreshProfile
}) => {
    return (
        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card group">
            {/* Avatar Seçim Modalı */}
            <AnimatePresence>
                {showAvatarModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAvatarModal(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-2xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden"
                        >
                            <div className="p-8 border-b border-border flex justify-between items-center bg-muted/30">
                                <div>
                                    <h3 className="text-xl font-black font-outfit text-primary tracking-tight">Business Avatar Kütüphanesi</h3>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">Sektörel kimliğinize uygun 57 farklı seçenek</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowAvatarModal(false)} className="rounded-full">
                                    <X size={20} />
                                </Button>
                            </div>

                            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-4">
                                        {Array.from({ length: 57 }).map((_, i) => {
                                            const avatarPath = `avatars/avatar_mega_${i + 1}.png`;
                                            return (
                                                <button
                                                    key={`mega-${i}`}
                                                    onClick={async () => {
                                                        try {
                                                            setUploadingAvatar(true);
                                                            const updated = await updateProfile(user!.uid, { avatar_url: avatarPath });
                                                            setProfile(updated);
                                                            await globalRefreshProfile(user!.uid, user?.email || undefined);
                                                            setShowAvatarModal(false);
                                                            toast.success("Avatar başarıyla güncellendi.");
                                                        } catch (err) {
                                                            toast.error("Avatar seçilemedi.");
                                                        } finally {
                                                            setUploadingAvatar(false);
                                                        }
                                                    }}
                                                    className="aspect-square rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-primary hover:scale-110 transition-all p-1 overflow-hidden flex items-center justify-center relative group shadow-sm hover:shadow-lg"
                                                >
                                                    <img 
                                                        src={`${avatarPath}?v=3`} 
                                                        alt={`Mega Avatar ${i+1}`} 
                                                        className="w-full h-full object-contain"
                                                    />
                                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </button>
                                            );
                                        })}
                                    </div>
                            </div>

                            <div className="p-6 bg-muted/30 border-t border-border flex justify-end">
                                <Button variant="outline" onClick={() => setShowAvatarModal(false)} className="rounded-xl px-8 font-bold">Kapat</Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="flex flex-col items-center justify-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-8 relative z-10 text-center w-full">
                <div className="relative group/avatar">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary/5 dark:bg-primary/10 flex items-center justify-center overflow-hidden border-4 border-border shadow-xl ring-2 ring-primary/10 transition-transform group-hover/avatar:scale-105">
                        {uploadingAvatar ? (
                            <Loader2 size={32} className="text-primary animate-spin" />
                        ) : profile?.avatar_url ? (
                            <img 
                                src={resolveUrl(profile.avatar_url) || ""} 
                                alt="Avatar" 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <User size={48} className="text-primary/20 dark:text-muted-foreground" />
                        )}
                    </div>
                    <input 
                        type="file" 
                        className="hidden" 
                        id="avatar-input"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        ref={avatarInputRef}
                    />
                    <button 
                        onClick={() => setShowAvatarModal(true)}
                        className="absolute -bottom-1 -right-1 w-8 h-8 md:w-10 md:h-10 bg-primary text-white rounded-xl shadow-lg border-2 border-card flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                        title="Kütüphaneden Seç"
                    >
                        <LayoutGrid size={14} className="md:size-5" />
                    </button>
                    <button 
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute -bottom-1 -left-1 w-8 h-8 md:w-10 md:h-10 bg-slate-800 text-white rounded-xl shadow-lg border-2 border-card flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                        title="Bilgisayardan Yükle"
                    >
                        <Camera size={14} className="md:size-5" />
                    </button>
                </div>
                
                <div className="space-y-1 md:space-y-2 max-w-lg mx-auto">
                    <h3 className="text-xl md:text-3xl font-black text-foreground tracking-tight uppercase font-outfit truncate">{profile?.full_name || "Müfettiş"}</h3>
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-1">
                        <span className="px-3 py-1 rounded-full bg-primary text-white text-[10px] md:text-xs font-black uppercase tracking-widest">{profile?.title || "Müfettiş"}</span>
                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] md:text-xs font-bold">{profile?.institution || "GSB"}</span>
                    </div>
                    <p className="text-[10px] md:text-xs text-muted-foreground font-medium truncate italic mt-2">{profile?.email}</p>
                    {Array.isArray((profile as any)?.emails) && (profile as any).emails.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {(profile as any).emails.map((mail: string) => (
                                <span key={mail} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold lowercase">
                                    {mail}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative z-10">
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 ml-1">Ad Soyad</label>
                    <input 
                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                        value={profile?.full_name || ""} 
                        onChange={(e) => setProfile(prev => prev ? {...prev, full_name: e.target.value} : null)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 ml-1">Ünvan</label>
                    <input 
                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                        value={profile?.title || ""} 
                        onChange={(e) => setProfile(prev => prev ? {...prev, title: e.target.value} : null)}
                    />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Bağlı Olduğu Kurum</label>
                    <input 
                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                        value={profile?.institution || ""} 
                        onChange={(e) => setProfile(prev => prev ? {...prev, institution: e.target.value} : null)}
                    />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Telefon Numarası</label>
                    <input 
                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                        value={(profile as any)?.phone || ""} 
                        onChange={(e) => setProfile(prev => prev ? {...prev, phone: e.target.value} : null)}
                        placeholder="0(5xx)..."
                    />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Doğum Tarihi</label>
                    <input 
                        type="date"
                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                        value={(profile as any)?.birthday_full || ""} 
                        onChange={(e) => {
                            const val = e.target.value;
                            const mmdd = val ? `${val.slice(5, 7)}-${val.slice(8, 10)}` : '';
                            setProfile(prev => prev ? {...prev, birthday: mmdd, birthday_full: val} : null);
                        }}
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-50 dark:border-slate-800">
                <Button onClick={handleSave} disabled={saving} className="h-14 px-10 rounded-2xl shadow-xl shadow-primary/20 font-bold">
                    {saving ? <Loader2 size={20} className="animate-spin mr-3" /> : <Save size={20} className="mr-3" />}
                    Ayarları Kaydet
                </Button>
            </div>
        </Card>
    );
};
