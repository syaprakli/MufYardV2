import { 
    Wand2, Mail, Globe2, CheckCircle2, Star, Users, Cpu, 
    MessageSquare, BookOpen, ClipboardList, FileText, Calendar, 
    HardDrive, Flame, Zap, Globe

} from "lucide-react";
import { useRef } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function About() {
    const modulesRef = useRef<HTMLDivElement | null>(null);
    const changelogRef = useRef<HTMLDivElement | null>(null);

    return (
        <div className="max-w-6xl mx-auto space-y-20 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32">
            {/* Hero Section */}
            <header className="relative text-center space-y-6 pt-16 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/5 blur-[120px] rounded-full -z-10" />
                
                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white shadow-xl shadow-primary/5 rounded-full border border-primary/10 text-primary text-[10px] font-black tracking-[0.3em] animate-bounce">
                    <Star size={12} className="fill-current" /> VERSİYON 2.50 • İLKBAHAR GÜNCELLEMESİ
                </div>
                
                <h1 className="text-7xl font-black font-outfit text-primary tracking-tighter leading-tight">
                    MüfYard <span className="text-slate-200">V2</span>
                </h1>
                
                <p className="text-xl text-slate-500 font-medium max-w-3xl mx-auto leading-relaxed px-4">
                    "Geleneksel denetim tecrübesini, <span className="text-primary font-bold">Yapay Zeka</span> ve <span className="text-primary font-bold">Hibrit Bulut</span> teknolojileriyle geleceğe taşıyan dijital asistanınız."
                </p>

                <div className="flex justify-center gap-4 pt-8">
                    <Button
                        onClick={() => modulesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="h-14 px-10 rounded-[20px] font-black shadow-2xl shadow-primary/20 bg-primary hover:scale-105 transition-transform"
                    >
                        Platform Rehberi
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => changelogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="h-14 px-10 rounded-[20px] font-black border-slate-200 hover:bg-slate-50 transition-all"
                    >
                        Değişim Günlüğü
                    </Button>
                </div>
            </header>

            {/* Platform Modules Overview */}
            <section ref={modulesRef} className="space-y-12">
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black font-outfit text-slate-800 tracking-tight">Kapsamlı <span className="text-primary">Modül</span> Mimarisi</h2>
                    <p className="text-sm text-slate-400 font-bold tracking-widest px-4">HER DENETİM ANINDA İHTİYACINIZ OLAN TÜM ARAÇLAR TEK BİR PLATFORMDA.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                    <ModuleCard 
                        icon={MessageSquare} 
                        title="Canlı Sohbet" 
                        desc="Denetim ekipleri için uçtan uca şifreli, süreli ve güvenli mesajlaşma alanı."
                        tag="Gerçek Zamanlı"
                    />
                    <ModuleCard 
                        icon={BookOpen} 
                        title="Mevzuat Kütüphanesi" 
                        desc="Hibrit depolama, yerel klasör senkronizasyonu ve gelişmiş arama motoru."
                        tag="HİBRİT BULUT"
                    />
                    <ModuleCard 
                        icon={Users} 
                        title="Müfettiş Rehberi" 
                        desc="Kurumsal iletişim ağı, aktif görev durumu ve doğrudan dosya paylaşımı."
                        tag="Kurumsal"
                    />
                    <ModuleCard 
                        icon={FileText} 
                        title="Akıllı Raporlama" 
                        desc="AI destekli rapor taslağı oluşturma ve GSB standartlarında dokümantasyon."
                        tag="Yapay Zeka"
                    />
                    <ModuleCard 
                        icon={ClipboardList} 
                        title="Görev Yönetimi" 
                        desc="Denetim süreçlerini dijital iş akışları ve önceliklendirme ile takip edin."
                        tag="Operasyonel"
                    />
                    <ModuleCard 
                        icon={Calendar} 
                        title="Takvim Planlama" 
                        desc="Görev ve denetim tarihlerinin uygulama içinden planlanması ve takip edilmesi."
                        tag="Planlama"
                    />
                    <ModuleCard 
                        icon={HardDrive} 
                        title="Dosya Depolama" 
                        desc="Denetim dosyaları için AES-256 şifreleme ve güvenli önizleme motoru."
                        tag="KRİPTOLU"
                    />
                    <ModuleCard 
                        icon={Zap} 
                        title="Hızlı Notlar" 
                        desc="Denetim esnasında alınan dinamik notların raporlara anlık aktarımı."
                        tag="DİNAMİK"
                    />
                </div>
            </section>

            {/* AI Focus Section */}
            <div className="bg-slate-900 rounded-[3rem] p-12 md:p-20 relative overflow-hidden group mx-4 shadow-3xl">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/10 text-white text-[11px] font-black tracking-widest">
                            <Flame size={14} className="text-orange-400 animate-pulse" /> GEMİNİ 1.5 PRO ENTEGRASYONU
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black font-outfit text-white tracking-tight leading-tight">
                            Denetimde <br />
                            <span className="text-blue-400 italic">Yapay Zeka</span> Çağı
                        </h2>

                        <p className="text-slate-400 text-lg font-medium leading-relaxed">
                            MufYard, karmaşık mevzuat taramalarını ve saatler süren rapor taslağı hazırlama süreçlerini saniyelere indirir. 
                            Yapay zeka sadece bir araç değil, sizinle birlikte düşünen bir iş ortağıdır.
                        </p>
                        <div className="flex gap-4">
                            <a href="https://www.gsb.gov.tr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all group">
                                <Globe size={16} className="text-primary group-hover:rotate-12 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/70 group-hover:text-white">WEB SİTESİ</span>
                            </a>
                            <a href="mailto:sefa.yaprakli@gsb.gov.tr" className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all group">
                                <Mail size={16} className="text-primary group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/70 group-hover:text-white">İLETİŞİM</span>
                            </a>
                        </div>
                    </div>
                    <div className="relative aspect-square flex items-center justify-center">
                         <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping duration-[3000ms]" />
                         <div className="w-64 h-64 bg-slate-800 rounded-[3rem] border border-white/10 shadow-2xl flex items-center justify-center relative transform group-hover:rotate-6 transition-transform duration-500">
                             <Cpu size={80} className="text-primary animate-pulse" />
                             <div className="absolute -top-4 -right-4 bg-white p-4 rounded-2xl shadow-xl">
                                 <Wand2 size={24} className="text-primary" />
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            <section ref={changelogRef} className="px-4 space-y-5">
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black font-outfit text-slate-800 tracking-tight">Değişim Günlüğü</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Son sürümde yapılan öne çıkan güncellemeler</p>
                </div>
                <Card className="p-6 rounded-3xl border-none shadow-sm bg-white">
                    <ul className="space-y-3 text-sm font-medium text-slate-600">
                        <li>• Açılış performansı ve dashboard veri yükleme süresi iyileştirildi.</li>
                        <li>• Dosya yönetimi ekranında işlemler sadeleştirildi.</li>
                        <li>• Kullanılmayan veya deneysel özellik metinleri gerçek durumla uyumlu hale getirildi.</li>
                    </ul>
                </Card>
            </section>

            {/* Vision & Mission */}
            <div className="px-4 text-center space-y-8">
                <h3 className="text-3xl font-black font-outfit text-slate-800">Dijital Dönüşümün <span className="text-primary underline decoration-primary/20 underline-offset-8">Öncüsü</span></h3>
                <p className="text-lg text-slate-500 font-medium max-w-4xl mx-auto leading-relaxed">
                    "MufYard, Gençlik ve Spor Bakanlığı müfettişlerinin denetim kalitesini artırmak, 
                    hata payını minimize etmek ve kurumsal hafızayı güvenli bir şekilde dijitalleştirmek vizyonuyla inşa edilmiştir."
                </p>
            </div>

            {/* Links & Contact Section */}
            <footer className="pt-20 border-t border-slate-100 flex flex-col items-center gap-10 px-4">
                <div className="flex flex-wrap justify-center gap-12">
                    <SocialLink href="https://mufyard.com" icon={Globe2} label="WEB SİTESİ" />
                    <SocialLink href="#" icon={Globe2} label="BAKANLIK PORTAL" />
                    <SocialLink href="mailto:sefa.yaprakli@gsb.gov.tr" icon={Mail} label="İLETİŞİM" />
                </div>
                
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-4 text-slate-200">
                        <CheckCircle2 size={16} />
                        <span className="w-12 h-px bg-slate-100" />
                        <CheckCircle2 size={16} />
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">© 2026 MUFYARD PROJECT • SEFA YAPRAKLI</p>
                        <p className="text-[10px] text-slate-300 font-bold mt-2 tracking-[0.2em] italic">DAHA HIZLI VE VERİMLİ DENETİMLER İÇİN GSB MÜFETTİŞLERİ TARAFINDAN HAZIRLANDI</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function ModuleCard({ icon: Icon, title, desc, tag }: any) {
    return (
        <Card className="p-8 border-none shadow-xl hover:shadow-2xl transition-all duration-500 bg-white group hover:-translate-y-3 relative overflow-hidden rounded-[2.5rem]">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            <div className={`w-14 h-14 bg-slate-50 text-primary rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:bg-primary group-hover:text-white transition-all duration-500 rotate-3 group-hover:rotate-0`}>
                <Icon size={28} />
            </div>
            <div className="inline-block px-2.5 py-1 bg-slate-100 rounded-md text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                {tag}
            </div>
            <h3 className="text-md font-black font-outfit text-slate-800 tracking-tight mb-3 leading-tight">{String(title).toLocaleUpperCase("tr-TR")}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed font-bold">{desc}</p>
        </Card>
    );
}

function SocialLink({ icon: Icon, href, label }: any) {
    return (
        <a href={href} className="flex items-center gap-3 text-slate-400 hover:text-primary transition-all group overflow-hidden">
            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-primary/10 group-hover:scale-110 transition-all">
                <Icon size={20} className="group-hover:text-primary transition-colors" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">{label}</span>
        </a>
    );
}

