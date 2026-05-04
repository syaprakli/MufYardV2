import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { NotificationDropdown } from "./NotificationDropdown";
import { useAuth } from "../../lib/hooks/useAuth";
import { useConfirm } from "../../lib/context/ConfirmContext";
import { useNotifications } from "../../lib/context/NotificationContext";
import { usePresence } from "../../lib/context/PresenceContext";
import { Search, Bell, ChevronDown, User, LogOut, Menu, Users } from "lucide-react";
import { fetchProfile } from "../../lib/api/profiles";
import { cn } from "../../lib/utils";

interface HeaderProps {
    toggleSidebar: () => void;
}

export function Header({ toggleSidebar }: HeaderProps) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { unreadCount } = useNotifications();
    const { onlineUsers } = usePresence();
    const [showNotifications, setShowNotifications] = useState(false);




    const [showUserMenu, setShowUserMenu] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user?.uid) {
            fetchProfile(user.uid, user.email || undefined)
                .then(setProfile)
                .catch(err => console.error("Header profile load error:", err));
        }
    }, [user]);

    
    // Build initials from first and last words (e.g. "Selin Yilmaz" -> "SY").
    const displayName = (profile?.full_name && profile.full_name !== "Kullanıcı") 
        ? profile.full_name 
        : (user?.displayName || user?.email?.split('@')[0] || "Müfettiş");

    const nameParts = displayName
        .replace(/[._-]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const initials = nameParts.length >= 2
        ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toLocaleUpperCase("tr-TR")
        : (nameParts[0]?.[0] || "?").toLocaleUpperCase("tr-TR");

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        const confirmed = await confirm({
            title: "Güvenli Çıkış",
            message: "Sistemden güvenli çıkış yapmak istediğinize emin misiniz?",
            confirmText: "Çıkış Yap",
            cancelText: "Vazgeç",
            variant: "danger"
        });
        
        if (confirmed) {
            await logout();
            navigate("/login");
        }
    };



    return (
        <header className={cn(
            "fixed top-0 right-0 h-16 border-b border-border bg-background flex items-center justify-between px-4 lg:px-8 z-40 transition-all duration-300",
            "lg:left-64 left-0"
        )}>
            <div className="flex items-center gap-4">
                {/* Menu Toggle for Mobile */}
                <button 
                    onClick={toggleSidebar}
                    className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <Menu size={24} />
                </button>

                <div className="hidden md:flex items-center bg-muted border border-border rounded-full px-4 py-2 w-64 lg:w-96 focus-within:ring-2 focus-within:ring-primary/5 transition-all">
                    <Search size={18} className="text-slate-400 mr-2" />
                    <input
                        type="text"
                        placeholder="Sistem genelinde ara..."
                        className="bg-transparent border-none outline-none text-sm w-full font-medium"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 lg:gap-6">
                {/* Online Users Indicator */}
                <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                    <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Users size={12} />
                        {onlineUsers.length > 0 ? onlineUsers.length : '...'} AKTİF
                    </span>
                </div>

                <div className="relative" ref={notificationRef}>
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`relative p-2 rounded-xl transition-all ${
                            showNotifications 
                            ? 'text-primary bg-primary/5 shadow-inner' 
                            : 'text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] text-white font-black leading-none">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>


                    {showNotifications && <NotificationDropdown />}
                </div>

                <div className="relative" ref={userMenuRef}>
                    <button 
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-3 pl-6 border-l border-slate-100 dark:border-slate-800 group"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 leading-none truncate max-w-[100px] lg:max-w-[150px] group-hover:text-primary transition-colors">
                                {displayName}
                            </p>
                            <p className="text-[9px] lg:text-[10px] text-slate-400 font-black tracking-widest mt-1 truncate max-w-[100px] lg:max-w-[150px]">
                                {user?.uid === "demo-user-123" ? "DEMO HESABI" : (profile?.title?.toLocaleUpperCase("tr-TR") || "MÜFETTİŞ")}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 font-black text-xs relative overflow-hidden transform group-hover:scale-105 transition-all">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="p" className="w-full h-full rounded-2xl object-cover" />
                            ) : (
                                <span>{initials}</span>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-300", showUserMenu && "rotate-180")} />
                    </button>

                    {showUserMenu && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-xl py-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 mb-1">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Hesap Ayarları</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{user?.email}</p>
                            </div>
                            
                            <button 
                                onClick={() => {
                                    navigate("/settings");
                                    setShowUserMenu(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:text-primary hover:bg-primary/5 transition-all font-bold text-sm"
                            >
                                <User size={18} /> Profil Düzenle
                            </button>


                            
                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all font-bold text-sm border-t border-slate-50 dark:border-slate-800 mt-1"
                            >
                                <LogOut size={18} /> Güvenli Çıkış Yap
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>



    );
}
