import { useState, useEffect } from "react";
import { User, Lock, ArrowRight, AlertCircle, LogIn } from "lucide-react";
import { signIn, signUp } from "../lib/firebase";
import { toast } from "react-hot-toast";

import { Button } from "../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/hooks/useAuth";

export default function Login() {
    const { resetPassword } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("mufettis@gsb.gov.tr");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [rememberMe, setRememberMe] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Otomatik giriş kontrolü
        const savedEmail = localStorage.getItem("remembered_email");
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }

        const demoUser = localStorage.getItem("demo_user");
        if (demoUser) {
            navigate("/dashboard");
        }
    }, [navigate]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // ACİL DURUM BYPASS (Yalnızca Giriş Modunda)
        if (!isRegister && email.trim().toLowerCase() === "mufettis@gsb.gov.tr" && password === "123456") {
            const mockUser = { 
                email: email.trim().toLowerCase(), 
                uid: "mufettis-gsb-unique-id",
                displayName: "Sefa Yapraklı"
            };
            localStorage.setItem("demo_user", JSON.stringify(mockUser));
            navigate("/dashboard");
            return;
        }

        setLoading(true);
        setError("");
        
        try {
            let result;
            if (isRegister) {
                if (!fullName.trim()) throw new Error("Lütfen adınızı ve soyadınızı girin.");
                result = await signUp(email, password, fullName);
            } else {
                result = await signIn(email, password);
            }
            
            // "Beni Hatırla" mantığı
            if (rememberMe) {
                localStorage.setItem("remembered_email", email);
            } else {
                localStorage.removeItem("remembered_email");
            }

            // Başarılı giriş/kayıt
            localStorage.setItem("demo_user", JSON.stringify(result.user));
            
            // Yönlendirme
            setTimeout(() => {
                navigate("/dashboard");
            }, 800);

        } catch (err: unknown) {
            const error = err as any;
            console.error("Kimlik doğrulama hatası:", error);
            let errorMessage = isRegister ? "Kayıt oluşturulamadı." : "Giriş başarısız.";
            
            if (error.code === "auth/invalid-credential") {
                errorMessage = "E-posta veya şifre hatalı.";
            } else if (error.code === "auth/email-already-in-use") {
                errorMessage = "Bu e-posta adresi zaten kullanımda.";
            } else if (error.code === "auth/weak-password") {
                errorMessage = "Şifre en az 6 karakter olmalıdır.";
            } else if (error.code === "auth/operation-not-allowed") {
                errorMessage = "E-posta ile giriş yönetimi şu an devre dışı. Lütfen Firebase konsolunu kontrol edin.";
            } else if (error.code === "auth/too-many-requests") {
                errorMessage = "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.";
            } else if (error.message) {
                errorMessage = error.message;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            setError("Lütfen önce e-posta adresinizi girin.");
            return;
        }

        try {
            await resetPassword(normalizedEmail);
            toast.success(`${normalizedEmail} adresine şifre sıfırlama bağlantısı gönderildi.`);
        } catch (err: any) {
            setError(err?.message || "Şifre sıfırlama bağlantısı gönderilemedi.");
        }
    };



    return (
        <div className="h-screen flex items-center justify-center bg-[#0f172a] font-sans selection:bg-blue-500/30 overflow-hidden sm:p-0">
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

            <div className="relative z-10 w-full max-w-[1050px] flex bg-white rounded-[40px] md:rounded-[50px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] border border-white/10 mx-4 sm:mx-6 animate-in fade-in zoom-in duration-700 h-[92vh] max-h-[850px]">

                {/* Sol Taraf: Kurumsal Alan */}
                <div className="hidden md:flex w-[40%] bg-slate-50 p-12 flex-col relative overflow-hidden border-r border-slate-100">
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center gap-10">
                        <div className="flex flex-col items-center gap-6 lg:gap-8">
                            <div className="w-40 h-40 lg:w-60 lg:h-60 flex items-center justify-center animate-in zoom-in duration-1000">
                                <img src="./logo-login.png" alt="Müf Yard Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="animate-in slide-in-from-bottom-4 duration-700 delay-200">
                                <h1 className="text-4xl lg:text-5xl font-black tracking-tighter font-outfit text-[#0f172a] leading-none mb-4 uppercase">
                                    <span>Müf</span><span className="ml-[1px]">Yard</span>
                                </h1>
                                <div className="inline-block px-4 py-1.5 bg-blue-600 rounded-full">
                                    <p className="text-white text-[9px] lg:text-[10px] uppercase tracking-[0.25em] font-black">V-2.0 Premium Cloud</p>
                                </div>
                            </div>
                        </div>

                        <div className="max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                            <h2 className="text-3xl font-black leading-tight mb-8 font-outfit text-[#0f172a]">
                                Denetimin <span className="text-blue-600">Dijital</span> Gücü
                            </h2>
                            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-slate-500 text-xs font-bold">
                                <p className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full" /> Yapay Zeka</p>
                                <p className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full" /> Bulut Arşiv</p>
                                <p className="flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full" /> Görev Takibi</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 pt-10 border-t border-slate-200 text-center">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] leading-relaxed">
                            T.C. GS Bakanlığı <br /> Rehberlik ve Denetim Bşk.
                        </p>
                    </div>
                </div>

                {/* Sağ Taraf: Giriş/Kayıt Formu */}
                <div className="flex-1 p-8 md:p-14 flex flex-col justify-center bg-white overflow-y-auto custom-scrollbar">
                    <div className="mb-6">
                        <h3 className="text-2xl font-black text-[#0f172a] mb-2 font-outfit tracking-tight">
                            {isRegister ? "Yeni Hesap Oluştur" : "Hoş Geldiniz"}
                        </h3>
                        <p className="text-slate-500 text-[15px] font-medium font-outfit">
                            {isRegister ? "Sistemi kullanmaya başlamak için kayıt olun." : "Sisteme erişmek için kurumsal hesabınızla giriş yapın."}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        {isRegister && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Ad Soyad</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-600 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="block w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-[20px] text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-medium text-[15px]"
                                        placeholder="Ad Soyad"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Kurumsal E-Posta</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-600 transition-colors">
                                    <LogIn size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-[20px] text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-medium text-[15px]"
                                    placeholder="ad.soyad@gsb.gov.tr"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Parola</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-600 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-[20px] text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all font-medium text-[15px]"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {!isRegister && (
                            <div className="flex items-center justify-between px-1">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-600/20" 
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Beni Hatırla</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4 decoration-blue-600/30"
                                >
                                    Şifremi Unuttum
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 flex items-center gap-3 animate-shake">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 md:h-16 bg-[#0f172a] hover:bg-blue-900 text-white rounded-[20px] font-bold text-[14px] md:text-[15px] flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98]"
                        >
                            {loading ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>İşleniyor...</span>
                                </div>
                            ) : (
                                <>
                                    {isRegister ? "Kayıt Ol" : "Sisteme Giriş Yap"} <ArrowRight size={20} />
                                </>
                            )}
                        </Button>

                        <div className="text-center mt-4">
                            <button 
                                type="button"
                                onClick={() => setIsRegister(!isRegister)}
                                className="text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
                            >
                                {isRegister ? (
                                    <>Zaten hesabınız var mı? <span className="text-blue-600 underline underline-offset-4">Giriş Yapın</span></>
                                ) : (
                                    <>Henüz hesabınız yok mu? <span className="text-blue-600 underline underline-offset-4">Hemen Kayıt Olun</span></>
                                )}
                            </button>
                        </div>

                    </form>


                    <footer className="mt-6 flex items-center justify-center gap-8 text-[11px] font-bold text-slate-400 border-t border-slate-50 pt-8">
                        <span className="cursor-pointer hover:text-blue-600 transition-all uppercase tracking-widest flex items-center gap-1.5 group"><span className="w-1.5 h-1.5 bg-slate-200 group-hover:bg-blue-400 rounded-full" /> YARDIM MERKEZİ</span>
                        <span className="cursor-pointer hover:text-blue-600 transition-all uppercase tracking-widest flex items-center gap-1.5 group"><span className="w-1.5 h-1.5 bg-slate-200 group-hover:bg-blue-400 rounded-full" /> GÜVENLİK PROTOKOLÜ</span>
                    </footer>
                </div>
            </div>
        </div>
    );
}
