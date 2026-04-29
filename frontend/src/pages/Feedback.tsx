import { useState, useEffect } from 'react';
import { Star, Send, Shield, CheckCircle2, User } from 'lucide-react';
import { useAuth } from '../lib/hooks/useAuth';
import { fetchWithTimeout } from '../lib/api/utils';
import { API_URL } from '../lib/config';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { fetchProfile } from '../lib/api/profiles';

export default function Feedback() {
    const { user } = useAuth();
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchProfile(user.uid, user.email || undefined).then(p => {
                if (p.role === 'admin') {
                    setIsAdmin(true);
                    loadFeedbacks();
                } else {
                    setLoading(false);
                }
            });
        }
    }, [user]);

    const loadFeedbacks = async () => {
        try {
            const res = await fetchWithTimeout(`${API_URL}/feedback/`);
            const data = await res.json();
            setFeedbacks(data);
        } catch (err) {
            console.error("Feedback list load error", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            toast.error("Lütfen bir puan seçin.");
            return;
        }
        if (!comment.trim()) {
            toast.error("Lütfen görüşünüzü yazın.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetchWithTimeout(`${API_URL}/feedback/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rating,
                    comment,
                    user_id: user?.uid,
                    user_name: user?.displayName || "Müfettiş",
                    user_email: user?.email
                })
            });

            if (res.ok) {
                setSubmitted(true);
                toast.success("Değerlendirmeniz için teşekkür ederiz!");
            } else {
                toast.error("Gönderim sırasında hata oluştu.");
            }
        } catch (err) {
            toast.error("Bağlantı hatası.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="text-center space-y-4">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
                        <Star size={32} />
                    </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Sistemi Değerlendirin</h1>
                <p className="text-slate-500 max-w-lg mx-auto font-medium">
                    MufYard deneyiminizi iyileştirmemize yardımcı olun. Görüşleriniz bizim için çok değerlidir.
                </p>
            </div>

            {isAdmin && feedbacks.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <Shield className="text-primary" size={20} />
                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Gelen Değerlendirmeler (Yönetici Paneli)</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {feedbacks.map((fb) => (
                            <Card key={fb.id} className="p-6 border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star key={s} size={16} className={s <= fb.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                                        ))}
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                                            <User size={12} /> {fb.user_name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold">{fb.user_email}</div>
                                        <div className="text-[9px] text-slate-300 font-medium">{new Date(fb.created_at).toLocaleString('tr-TR')}</div>
                                    </div>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-relaxed italic">
                                    "{fb.comment}"
                                </p>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            <Card className="p-8 sm:p-12 border-slate-100 dark:border-slate-800 relative overflow-hidden bg-card/50 backdrop-blur-sm">
                {!submitted ? (
                    <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                        <div className="space-y-4 text-center">
                            <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400">Genel Memnuniyetiniz</label>
                            <div className="flex justify-center gap-4">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHover(star)}
                                        onMouseLeave={() => setHover(0)}
                                        className="transition-all hover:scale-125 focus:outline-none"
                                    >
                                        <Star
                                            size={48}
                                            className={cn(
                                                "transition-colors duration-200",
                                                (hover || rating) >= star ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"
                                            )}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Görüşleriniz ve Önerileriniz</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Sistemde neyi iyileştirebiliriz? Neyi çok beğendiniz?"
                                className="w-full min-h-[150px] p-6 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-primary/10 rounded-3xl outline-none font-medium text-slate-700 dark:text-slate-200 transition-all resize-none shadow-inner"
                            />
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
                            <Shield className="text-emerald-600 shrink-0" size={20} />
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed">
                                <strong>Gizlilik Taahhüdü:</strong> Bu değerlendirme sisteminde kimliğiniz anonim tutulur ve diğer kullanıcılara asla gösterilmez. 
                            </p>
                        </div>

                        <Button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20"
                        >
                            {isSubmitting ? "Gönderiliyor..." : (
                                <span className="flex items-center gap-2">
                                    Değerlendirmeyi Gönder <Send size={18} />
                                </span>
                            )}
                        </Button>
                    </form>
                ) : (
                    <div className="py-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
                        <div className="flex justify-center">
                            <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <CheckCircle2 size={48} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Harika!</h2>
                            <p className="text-slate-500 font-medium">Geri bildiriminiz başarıyla iletildi. Teşekkür ederiz.</p>
                        </div>
                        <Button variant="outline" onClick={() => setSubmitted(false)} className="rounded-xl font-bold">
                            Yeni Bir Görüş Bildir
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
