import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Loader2, Camera, User, Mail, Shield, Smartphone, Landmark } from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../lib/hooks/useAuth";
import { fetchProfile, updateProfile, uploadAvatar, type Profile } from "../../lib/api/profiles";
import { updateProfile as firebaseUpdateProfile } from "firebase/auth";
import { BASE_URL } from "../../lib/config";
import { isElectron } from "../../lib/firebase";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [formData, setFormData] = useState({
        full_name: "",
        title: "",
        institution: "",
        phone: ""
    });

    const resolveUrl = (url: string | null | undefined) => {
        if (!url) return null;
        const raw = String(url).trim();
        
        // Local avatars check: ensure correct path for both Web (absolute) and Electron (relative)
        if (raw.includes('avatars/')) {
            const clean = raw.startsWith('/') ? raw.substring(1) : raw;
            return isElectron ? clean : `/${clean}`;
        }

        if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.includes('dicebear.com')) return raw;
        
        if (raw.startsWith('http')) return raw;
        
        const cleanRaw = raw.startsWith('/') ? raw : `/${raw}`;
        return `${BASE_URL.replace(/\/$/, '')}${cleanRaw}`;
    };

    useEffect(() => {
        if (isOpen && user) {
            loadProfile();
        }
    }, [isOpen, user]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const data = await fetchProfile(user!.uid);
            setProfile(data);
            setFormData({
                full_name: data.full_name || "",
                title: data.title || "",
                institution: data.institution || "",
                phone: (data as any).phone || ""
            });
        } catch (error) {
            toast.error("Profil bilgileri yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            setSaving(true);
            
            // 1. Update Backend
            await updateProfile(user.uid, formData);

            // 2. Update Firebase Display Name if changed
            if (formData.full_name !== user.displayName) {
                await firebaseUpdateProfile(user, {
                    displayName: formData.full_name
                });
            }

            toast.success("Profiliniz başarıyla güncellendi.");
            onClose();
            // Refresh page or trigger re-auth to update header (simplified reload for now)
            setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            toast.error("Profil güncellenemedi.");
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        try {
            setSaving(true);
            const { avatar_url } = await uploadAvatar(user.uid, file);
            
            // Update Firebase photoURL
            await firebaseUpdateProfile(user, {
                photoURL: avatar_url
            });

            setProfile(prev => prev ? { ...prev, avatar_url } : null);
            toast.success("Profil fotoğrafı güncellendi.");
             setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            toast.error("Fotoğraf yüklenemedi.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Profil Ayarlarım"
            size="medium"
        >
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Bilgileriniz Getiriliyor...</p>
                </div>
            ) : (
                <form onSubmit={handleSave} className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center pb-6 border-b border-slate-50">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-[2rem] bg-primary flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-primary/20 relative overflow-hidden">
                                {resolveUrl(profile?.avatar_url) ? (
                                    <img src={resolveUrl(profile?.avatar_url) || ''} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span>{formData.full_name.substring(0, 2).toUpperCase()}</span>
                                )}
                                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <Camera className="text-white" size={24} />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={saving} />
                                </label>
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center text-primary">
                                <Shield size={14} />
                            </div>
                        </div>
                        <p className="mt-4 text-sm font-black text-slate-800 tracking-tight">{formData.full_name || user?.email}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{formData.title || "Resmi Görevli"}</p>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <User size={12} /> Ad Soyad
                            </label>
                            <input
                                required
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                placeholder="Ad Soyad..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Shield size={12} /> Ünvan / Statü
                            </label>
                            <input
                                required
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                placeholder="Örn: Başmüfettiş"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Landmark size={12} /> Birim / Kurum
                            </label>
                            <input
                                value={formData.institution}
                                onChange={e => setFormData({ ...formData, institution: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                placeholder="Örn: Rehberlik ve Teftiş"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Smartphone size={12} /> Telefon Numarası
                            </label>
                            <input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                placeholder="0(5xx)..."
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                            <Mail size={12} /> Kayıtlı E-posta
                        </label>
                        <p className="text-sm font-bold text-slate-600 pl-1">{user?.email}</p>
                        <p className="text-[9px] text-slate-400 font-bold mt-1 pl-1 italic">E-posta adresi sistem yöneticisi tarafından değiştirilebilir.</p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl text-slate-500 font-bold" onClick={onClose} disabled={saving}>Vazgeç</Button>
                        <Button type="submit" disabled={saving} className="flex-1 h-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 font-bold">
                            {saving ? <Loader2 className="animate-spin mr-2" /> : null}
                            Bilgileri Güncelle
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
