import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { NotificationDropdown } from "./NotificationDropdown";
import { useAuth } from "../../lib/hooks/useAuth";
import { useConfirm } from "../../lib/context/ConfirmContext";
import { useGlobalData } from "../../lib/context/GlobalDataContext";
import { useNotifications } from "../../lib/context/NotificationContext";
import { Search, Bell, ChevronDown, User, LogOut, Menu, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";
import { usePresence } from "../../lib/context/PresenceContext";
import { fetchPendingRequests } from "../../lib/api/collaboration";
import type { PendingRequest } from "../../lib/api/collaboration";
import { UserPlus } from "lucide-react";
import { isElectron } from "../../lib/firebase";

interface HeaderProps {
    toggleSidebar: () => void;
}

export function Header({ toggleSidebar }: HeaderProps) {
    const { user, logout } = useAuth();
    const { onlineUsers, wsConnected } = usePresence();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { unreadCount, markAllAsRead } = useNotifications();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showCollaborationRequests, setShowCollaborationRequests] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const collaborationRef = useRef<HTMLDivElement>(null);




    const { data: { profile, trialDaysLeft }, refreshProfile } = useGlobalData();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const presenceReady = wsConnected || onlineUsers.length > 0;

    const resolveUrl = (url: string | null) => {
        if (!url) return null;
        let processed = url.trim();
        
        // Local avatars check: ensure correct path for both Web (absolute) and Electron (relative)
        if (processed.includes('avatars/')) {
            const clean = processed.startsWith('/') ? processed.substring(1) : processed;
            return isElectron ? clean : `/${clean}`;
        }

        if (processed.startsWith('data:') || processed.startsWith('blob:') || processed.includes('dicebear.com') || processed.includes('liara.run') || processed.includes('unavatar.io') || processed.includes('robohash.org') || processed.includes('ui-avatars.com')) return processed;
        
        if (processed.includes('localhost:8000') || processed.includes('127.0.0.1:8000')) {
            processed = processed.split(':8000')[1];
        }
        if (processed.startsWith('http')) return processed;
        
        // Önce Railway'i dene (Ana sunucu)
        const RAILWAY_URL = "https://mufyardv2.up.railway.app";
        return `${RAILWAY_URL}${processed.startsWith('/') ? '' : '/'}${processed}`;
    };

    useEffect(() => {
        if (user?.uid && !profile) {
            refreshProfile(user.uid, user.email || undefined);
        }
    }, [user, profile, refreshProfile]);

    useEffect(() => {
        if (user?.uid) {
            // Bekleyen istekleri çek ve periyodik olarak güncelle (30 saniye)
            const updateRequests = () => fetchPendingRequests(user.uid, user.email || undefined).then(setPendingRequests);
            updateRequests();
            const interval = setInterval(updateRequests, 30000);
            return () => clearInterval(interval);
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
            if (collaborationRef.current && !collaborationRef.current.contains(event.target as Node)) {
                setShowCollaborationRequests(false);
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

    const getRequestRoute = (type: PendingRequest["type"]) => {
        if (type === "CONTACT") return "/contacts?view=pending";
        if (type === "NOTE") return "/notes";
        return "/tasks";
    };

    const getRequestTypeText = (type: PendingRequest["type"]) => {
        if (type === "CONTACT") return "Rehber paylaşımı";
        if (type === "NOTE") return "Not paylaşımı";
        return "Görev paylaşımı";
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
                {/* Trial Countdown Reminder */}
                {profile && profile.role !== 'admin' && !profile.has_premium_ai && (
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-full animate-pulse-slow">
                        <Sparkles size={14} className="text-primary" />
                        <span className="text-[11px] font-black text-primary uppercase tracking-wider">
                            Deneme Süresi: {trialDaysLeft} Gün Kaldı
                        </span>
                    </div>
                )}

                {/* Online Users Indicator */}
                <div className="relative group flex items-center gap-2 text-xs font-bold whitespace-nowrap">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${presenceReady ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 animate-pulse'}`} />
                    {!presenceReady ? (
                        <span className="text-slate-400">Bağlanıyor...</span>
                    ) : onlineUsers.length > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                            {onlineUsers.length} kişi online
                        </span>
                    ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">Online</span>
                    )}
                    {presenceReady && onlineUsers.length > 0 && (
                        <div className="pointer-events-none absolute left-0 top-7 z-50 hidden group-hover:block bg-card border border-border rounded-xl shadow-xl p-2 min-w-[220px] max-w-[320px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Çevrimiçi ({onlineUsers.length})</p>
                            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed break-words max-h-44 overflow-y-auto pr-1">
                                {onlineUsers.map((u: any) => (
                                    <p key={u.uid} className="truncate">
                                        {u.name || u.uid}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
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

                <div className="relative" ref={collaborationRef}>
                    <button 
                        onClick={() => {
                            const next = !showCollaborationRequests;
                            setShowCollaborationRequests(next);
                            if (next) {
                                markAllAsRead();
                            }
                        }}
                        className={`relative p-2 rounded-xl transition-all ${
                            showCollaborationRequests 
                            ? 'text-primary bg-primary/5 shadow-inner' 
                            : 'text-slate-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        title="Paylaşım İstekleri"
                    >
                        <UserPlus size={20} />
                        {pendingRequests.length > 0 && (
                            <span className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] text-white font-black leading-none">
                                {pendingRequests.length}
                            </span>
                        )}
                    </button>

                    {showCollaborationRequests && (
                        <div className="absolute top-full right-[-80px] sm:right-0 mt-2 w-[280px] sm:w-80 bg-card border border-border rounded-[24px] shadow-2xl py-4 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-[9999]">
                            <div className="px-6 pb-3 border-b border-slate-50 flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paylaşım İstekleri</p>
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black">{pendingRequests.length} Yeni</span>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                                {pendingRequests.length === 0 ? (
                                    <div className="py-12 px-6 text-center space-y-3">
                                        <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                                            <UserPlus size={24} />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400">Bekleyen istek bulunmuyor.</p>
                                    </div>
                                ) : (
                                    pendingRequests.map((req) => (
                                        <div key={`${req.type}-${req.id}`} className="px-6 py-4 hover:bg-muted/50 transition-colors border-b border-slate-50 last:border-none group">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
                                                    {req.type === 'TASK' ? <Bell size={18} /> : (req.type === 'NOTE' ? <Menu size={18} /> : <User size={18} />)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-slate-800 truncate mb-0.5">{req.title}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 truncate">{req.sender_name} • {getRequestTypeText(req.type)}</p>
                                                    <div className="flex items-center gap-2 mt-3">
                                                        <button 
                                                            onClick={() => {
                                                                navigate(getRequestRoute(req.type));
                                                                setShowCollaborationRequests(false);
                                                            }}
                                                            className="flex-1 h-8 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1"
                                                        >
                                                            Paylaşımı Gör
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
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
                            {resolveUrl(profile?.avatar_url) || user?.photoURL ? (
                                <img 
                                    src={resolveUrl(profile?.avatar_url) || user?.photoURL || ''} 
                                    alt="p" 
                                    className="w-full h-full rounded-2xl object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        // Eğer Railway başarısız olursa Localhost'u dene
                                        if (target.src.includes('railway.app')) {
                                            const LOCAL_URL = "http://127.0.0.1:8000";
                                            const path = target.src.split('railway.app')[1];
                                            target.src = `${LOCAL_URL}${path}`;
                                        } else {
                                            // İkisi de yoksa Baş Harflere dön
                                            target.style.display = 'none';
                                            const parent = target.parentElement;
                                            if (parent && !parent.querySelector('.avatar-fallback')) {
                                                const span = document.createElement('span');
                                                span.className = 'avatar-fallback';
                                                span.innerText = initials;
                                                parent.appendChild(span);
                                            }
                                        }
                                    }}
                                />
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
