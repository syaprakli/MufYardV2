import { useState, useEffect } from 'react';
import { Star, Clock, User, Mail, MessageSquare, Loader2, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { API_URL } from '../lib/config';
import { fetchWithTimeout } from '../lib/api/utils';
import toast from 'react-hot-toast';
import { useConfirm } from '../lib/context/ConfirmContext';
import { useAuth } from '../lib/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface Feedback {
    id: string;
    rating: number;
    comment: string;
    user_name: string;
    user_email: string;
    created_at: string;
}

export default function AdminFeedback() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const isFounder = user?.email === "sefayaprakli@hotmail.com" || 
                      user?.email === "sefa.yaprakli@gsb.gov.tr" ||
                      user?.email === "syaprakli@gmail.com";

    useEffect(() => {
        if (!isFounder && user) {
            toast.error("Bu sayfaya erişim yetkiniz bulunmamaktadır.");
            navigate("/");
        }
    }, [isFounder, user, navigate]);

    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const confirm = useConfirm();

    const loadFeedbacks = async () => {
        try {
            const res = await fetchWithTimeout(`${API_URL}/feedback/`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setFeedbacks(data);
        } catch {
            toast.error("Değerlendirmeler yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFeedbacks();
    }, []);

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: "Değerlendirmeyi Sil",
            message: "Bu değerlendirmeyi kalıcı olarak silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            cancelText: "Vazgeç",
            variant: "danger"
        });
        if (!ok) return;
        try {
            const res = await fetchWithTimeout(`${API_URL}/feedback/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("Değerlendirme silindi.");
            setFeedbacks(prev => prev.filter(f => f.id !== id));
        } catch {
            toast.error("Silme işlemi başarısız.");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-slate-400 mt-4 font-medium">Yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
                <button 
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-primary transition-colors mb-2 group w-fit"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest">Kurucu Paneline Dön</span>
                </button>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit">Kullanıcı Değerlendirmeleri</h1>
                <p className="text-slate-500 font-medium font-inter">Uygulama hakkında gelen tüm geri bildirimler.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {feedbacks.map((fb) => (
                    <Card key={fb.id} className="p-6 space-y-4 hover:shadow-lg transition-shadow border-slate-100">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Star 
                                        key={s} 
                                        size={16} 
                                        className={s <= fb.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} 
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <Clock size={12} />
                                    {new Date(fb.created_at).toLocaleDateString('tr-TR')}
                                </div>
                                <button
                                    onClick={() => handleDelete(fb.id)}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Sil"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                "{fb.comment}"
                            </p>
                            
                            <div className="pt-4 border-t border-slate-50 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                                    <User size={14} className="text-primary" />
                                    {fb.user_name}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <Mail size={14} />
                                    {fb.user_email}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {feedbacks.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <MessageSquare size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Henüz değerlendirme bulunmuyor</p>
                </div>
            )}
        </div>
    );
}
