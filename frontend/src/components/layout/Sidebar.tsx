import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    FileText,
    Calendar,
    Users,
    CheckSquare,
    FolderTree,
    StickyNote,
    BookOpen,
    Settings,
    Bot,
    HelpCircle,
    Sparkles,
    Star,
    MessageSquare,
    X
} from "lucide-react";
import { cn } from "../../lib/utils";
import { isElectron } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}


const navItems = [
    { icon: LayoutDashboard, label: "Genel Bakış", href: "/" },
    { icon: CheckSquare, label: "Görevler", href: "/tasks" },
    { icon: FileText, label: "Raporlar", href: "/audit" },
    { icon: Calendar, label: "Takvim", href: "/calendar" },
    { icon: Users, label: "Rehber", href: "/contacts" },
    { icon: MessageSquare, label: "Mesajlar", href: "/messages" },
    { icon: BookOpen, label: "Kamusal Alan", href: "/public-space" },
    { icon: FolderTree, label: "Dosyalar", href: "/files" },
    { icon: StickyNote, label: "Hızlı Notlar", href: "/notes" },
    { icon: BookOpen, label: "Mevzuat", href: "/legislation" },
    { icon: Bot, label: "Dijital Müfettiş", href: "/assistant" },
    { icon: Star, label: "Bize Puan Verin", href: "/feedback" },
];

const comingSoonItems = [
    { icon: Sparkles, label: "AI Bilgi Bankası", href: "/ai-knowledge" },
];

const bottomNavItems = [
    { icon: HelpCircle, label: "Hakkında", href: "/about" },
    { icon: Settings, label: "Ayarlar", href: "/settings" },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { user } = useAuth();
    const isAdmin = user?.email === "sefayaprakli@hotmail.com" || user?.email === "mufettis@gsb.gov.tr";

    return (
        <aside className={cn(
            "w-64 bg-slate-950 text-white h-screen flex flex-col fixed left-0 top-0 z-50 border-r border-slate-900/50 transition-all duration-300 ease-in-out",
            "lg:translate-x-0", // Always show on desktop
            isOpen ? "translate-x-0" : "-translate-x-full" // Toggle on mobile
        )}>
            <div className="p-6 border-b border-primary-light flex items-center justify-between">
                <NavLink 
                    to="/" 
                    onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                    }}
                    className="hover:opacity-80 transition-opacity"
                >
                    <h1 className="text-2xl font-black font-outfit tracking-tight text-white">MüfYard</h1>
                    <p className="text-[10px] font-bold text-white/60 tracking-widest mt-1 uppercase">Dijital Müfettiş Yardımcısı</p>
                </NavLink>
                {/* Close button for mobile */}
                <button 
                    onClick={onClose}
                    className="lg:hidden p-2 text-white/50 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-0.5">
                {navItems.filter(item => {
                    // Dosyalar sayfası sadece Electron (Masaüstü Paket) sürümünde görünsün
                    if (item.href === "/files") return isElectron;
                    return true;
                }).map((item) => (
                    <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={() => {
                            if (window.innerWidth < 1024) onClose();
                        }}
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200",
                            isActive
                                ? "bg-primary-light text-white shadow-md shadow-black/5"
                                : "text-secondary hover:bg-white/10 hover:text-white"
                        )}
                    >
                        <item.icon size={18} />
                        <span className="font-semibold text-sm">{item.label}</span>
                    </NavLink>
                ))}

                {/* Yakında gelecek özellikler */}
                {comingSoonItems.map((item) => (
                    <div
                        key={item.href}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl opacity-50 cursor-not-allowed select-none"
                        title="Yakında kullanıma açılacak"
                    >
                        <item.icon size={18} />
                        <span className="font-semibold text-sm flex-1">{item.label}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 text-white px-1.5 py-0.5 rounded-md">
                            Yakında
                        </span>
                    </div>
                ))}

                {isAdmin && (
                    <NavLink
                        to="/admin/feedback"
                        onClick={() => {
                            if (window.innerWidth < 1024) onClose();
                        }}
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 border border-amber-500/20 bg-amber-500/5",
                            isActive
                                ? "bg-amber-500 text-white shadow-md"
                                : "text-amber-500 hover:bg-amber-500/10"
                        )}
                    >
                        <Star size={18} className="fill-current" />
                        <span className="font-bold text-sm">Değerlendirmeleri Gör</span>
                    </NavLink>
                )}
            </nav>

            <div className="p-4 border-t border-primary-light space-y-1">
                {bottomNavItems.map((item) => (
                    <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={() => {
                            if (window.innerWidth < 1024) onClose();
                        }}
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                            isActive
                                ? "bg-primary-light text-white shadow-inner"
                                : "text-secondary hover:bg-primary-light/50 hover:text-white"
                        )}
                    >
                        <item.icon size={20} />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </aside>
    );
}
