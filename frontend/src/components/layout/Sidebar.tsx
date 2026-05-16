import { useState, useEffect } from "react";
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
    ClipboardCheck,
    Globe,
    X,
    Shield
} from "lucide-react";
import { cn } from "../../lib/utils";
import { isElectron } from "../../lib/firebase";
import { useAuth } from "../../lib/hooks/useAuth";
import { usePresence } from "../../lib/context/PresenceContext";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}


const navItems = [
    { icon: LayoutDashboard, label: "Genel Bakış", href: "/" },
    { icon: CheckSquare, label: "Görevler", href: "/tasks" },
    { icon: ClipboardCheck, label: "Görev Analizleri", href: "/report-analytics" },
    { icon: FileText, label: "Raporlar", href: "/audit" },
    { icon: StickyNote, label: "Hızlı Notlar", href: "/notes" },
    { icon: FolderTree, label: "Dosyalar", href: "/files" },
    { icon: BookOpen, label: "Mevzuat", href: "/legislation" },
    { icon: Calendar, label: "Takvim", href: "/calendar" },
    { icon: Users, label: "Rehber", href: "/contacts" },
    { icon: MessageSquare, label: "Mesajlar", href: "/messages" },
    { icon: Globe, label: "Kamusal Alan", href: "/public-space" },
    { icon: Bot, label: "Dijital Müfettiş", href: "/assistant" },
];

const comingSoonItems = [
    { icon: Sparkles, label: "AI Bilgi Bankası", href: "/ai-knowledge" },
    { icon: ClipboardCheck, label: "Denetim", href: "/denetim" },
];

const bottomNavItems = [
    { icon: Star, label: "Puan Ver", href: "/feedback" },
    { icon: HelpCircle, label: "Hakkında", href: "/about" },
    { icon: Settings, label: "Ayarlar", href: "/settings" },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { user, profile } = useAuth();
    const { unreadMessages } = usePresence();
    
    const totalUnread = Object.values(unreadMessages).reduce((a, b) => a + b, 0);
    
    const isFounder = user?.email === "sefayaprakli@hotmail.com" || 
                      user?.email === "sefa.yaprakli@gsb.gov.tr" ||
                      user?.email === "syaprakli@gmail.com";

    // Check role from profile, or fallback to hardcoded emails for initial setup
    const isAdmin = profile?.role === 'admin' || isFounder;
    
    const isModerator = profile?.role === 'moderator' || isAdmin;
    
    const [modPermissions, setModPermissions] = useState<string[]>([]);
    
    useEffect(() => {
        if (isModerator && !isAdmin) {
            import("../../lib/api/settings").then(mod => {
                mod.fetchRolesSettings().then(data => {
                    setModPermissions(data.moderator_permissions || []);
                }).catch(err => console.error("Could not load moderator permissions", err));
            });
        }
    }, [isModerator, isAdmin]);

    // Role-based visibility check
    const isVisible = (href: string) => {
        if (isAdmin) return true; // Admin sees everything
        if (!isModerator) return true; // Standard user sees everything by default
        
        const pathMapping: Record<string, string> = {
            "/": "dashboard",
            "/tasks": "tasks",
            "/report-analytics": "report-analytics",
            "/audit": "audit",
            "/notes": "notes",
            "/files": "files",
            "/legislation": "legislation",
            "/calendar": "calendar",
            "/contacts": "contacts",
            "/messages": "messages",
            "/public-space": "public_space",
            "/assistant": "assistant",
            "/feedback": "feedback"
        };
        
        const modId = pathMapping[href];
        if (modId) {
            return modPermissions.includes(modId);
        }
        return true; // Other pages (settings, etc) are visible
    };

    return (
        <aside className={cn(
            "w-64 bg-slate-950 text-white h-[100dvh] flex flex-col fixed left-0 top-0 z-50 border-r border-slate-900/50 transition-all duration-300 ease-in-out",
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
                    if (item.href === "/files" && !isElectron) return false;
                    return isVisible(item.href);
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
                        <span className="font-semibold text-sm flex-1">{item.label}</span>
                        {item.href === "/messages" && totalUnread > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg shadow-red-500/20">
                                {totalUnread}
                            </span>
                        )}
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

                {isFounder && (
                    <div className="pt-2">
                        <div className="flex items-center gap-1.5 px-4 pb-1.5">
                            <div className="h-px flex-1 bg-amber-500/20" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/70">Kurucu Paneli</span>
                            <div className="h-px flex-1 bg-amber-500/20" />
                        </div>
                        <NavLink
                            to="/admin"
                            onClick={() => {
                                if (window.innerWidth < 1024) onClose();
                            }}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 border border-amber-500/20 bg-amber-500/5",
                                isActive
                                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-[1.02]"
                                    : "text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/40"
                            )}
                        >
                            <Shield size={18} className={cn("transition-transform duration-300")} />
                            <span className="font-bold text-sm">Kurucu Paneli</span>
                        </NavLink>
                    </div>
                )}
            </nav>

            <div className="p-3 border-t border-white/5 space-y-0.5">
                <div className="flex flex-col gap-0.5">
                    {bottomNavItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            onClick={() => {
                                if (window.innerWidth < 1024) onClose();
                            }}
                            className={({ isActive }) => cn(
                                "flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all duration-200",
                                isActive
                                    ? "bg-white/10 text-white"
                                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                            )}
                        >
                            <item.icon size={15} />
                            <span className="font-medium text-[11px] uppercase tracking-wider">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            </div>
        </aside>
    );
}
