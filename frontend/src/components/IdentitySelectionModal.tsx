import { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Search, UserCheck, Loader2 } from "lucide-react";
import { fetchInspectors, type Inspector } from "../lib/api/inspectors";
import { fetchProfile, updateProfile } from "../lib/api/profiles";
import { auth } from "../lib/firebase";
import { toast } from "react-hot-toast";

interface IdentitySelectionModalProps {
    uid: string;
    onComplete: (name: string) => void;
}

export function IdentitySelectionModal({ uid, onComplete }: IdentitySelectionModalProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [search, setSearch] = useState("");
    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState(false);
    const [submittedSearch, setSubmittedSearch] = useState("");

    useEffect(() => {
        const loadInspectors = async () => {
            try {
                const data = await fetchInspectors();
                setInspectors(data || []);
            } catch (err) {
                console.error("Müfettiş listesi yüklenemedi:", err);
            } finally {
                setLoading(false);
            }
        };
        loadInspectors();
    }, []);

    const query = (submittedSearch || search).toLowerCase().trim();
    const filtered = inspectors.filter(i => 
        (i.name || "").toLowerCase().includes(query) ||
        (i.title || "").toLowerCase().includes(query)
    ).slice(0, 5);

    const handleSelect = async (inspector: Inspector) => {
        setSelecting(true);
        try {
            const currentUserEmail = auth.currentUser?.email || "";
            const currentProfile = await fetchProfile(uid, currentUserEmail || undefined, auth.currentUser?.displayName || undefined);
            const mergedEmails = Array.from(new Set([
                ...(Array.isArray(currentProfile?.emails) ? currentProfile.emails : []),
                currentProfile?.email,
                currentUserEmail,
                inspector.email,
            ].filter(Boolean).map(v => String(v).trim().toLowerCase())));

            await updateProfile(uid, {
                full_name: inspector.name,
                title: inspector.title,
                institution: "Gençlik ve Spor Bakanlığı",
                email: inspector.email,
                emails: mergedEmails,
                verified: true
            });
            localStorage.setItem(`id_skip_${uid}`, "true");
            toast.success(`Kimlik doğrulandı: ${inspector.name}`);
            setIsOpen(false);
            onComplete(inspector.name);
            window.location.reload(); // Bilgilerin her yerde güncellenmesi için
        } catch (err) {
            toast.error("Kimlik eşleştirilemedi.");
        } finally {
            setSelecting(false);
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={() => {
                localStorage.setItem(`id_skip_${uid}`, "true");
                setIsOpen(false);
            }} 
            title="Sizi Tanıyalım 🤝"
        >
            <button 
                onClick={() => {
                    localStorage.setItem(`id_skip_${uid}`, "true");
                    setIsOpen(false);
                }}
                className="absolute top-4 right-12 p-2 text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-black uppercase tracking-widest"
            >
                Kapat [×]
            </button>
            <div className="space-y-6 py-4 font-outfit">
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                        MufYard sistemine hoş geldiniz! Sizi kurumsal rehberimizle eşleştiremedik. 
                        Lütfen listeden kendinizi seçerek devam edin.
                    </p>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold text-slate-700"
                        placeholder="İsminizi yazın..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                setSubmittedSearch(search);
                            }
                        }}
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={() => setSubmittedSearch(search)}
                        className="px-4 py-2 rounded-xl text-xs font-black border border-primary/20 text-primary hover:bg-primary/5 transition-all"
                    >
                        Ara
                    </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
                    ) : filtered.length > 0 ? (
                        filtered.map((inspector) => (
                            <button
                                key={inspector.id}
                                onClick={() => handleSelect(inspector)}
                                disabled={selecting}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-primary hover:bg-primary/5 transition-all group"
                            >
                                <div className="text-left">
                                    <h4 className="font-black text-slate-900 group-hover:text-primary transition-colors">{inspector.name}</h4>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{inspector.title}</p>
                                </div>
                                <UserCheck className="text-slate-300 group-hover:text-primary transition-all transform group-hover:scale-110" />
                            </button>
                        ))
                    ) : (
                        <p className="text-center py-8 text-slate-400 font-medium">Kayıt bulunamadı. Lütfen isminizi kontrol edin.</p>
                    )}
                </div>

                <div className="pt-2">
                    <p className="text-[10px] text-center text-slate-400 uppercase font-black tracking-widest">
                        Listede yoksanız lütfen yönetici ile iletişime geçin.
                    </p>
                </div>
            </div>
        </Modal>
    );
}
