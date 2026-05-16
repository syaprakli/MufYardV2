import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DraggableRadioWidget } from "./DraggableRadioWidget";
import { TrialOverlay } from "../TrialOverlay";
import { IntroPresentation } from "../IntroPresentation";
import { LayoutDashboard, CheckSquare, FileText, Settings, Shield } from "lucide-react";
import { useGlobalData } from "../../lib/context/GlobalDataContext";
import { cn } from "../../lib/utils";

export function MainLayout() {
    const { data } = useGlobalData();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showIntroForce, setShowIntroForce] = useState(false);
    const location = useLocation();

    // Deneme süresi başlatılmamışsa tanıtımı zorla göster
    useEffect(() => {
        if (data.profile && data.profile.role !== 'admin' && !data.profile.trial_started) {
            const hasSeen = localStorage.getItem(`mufyard_intro_seen_${data.profile.uid}`);
            if (!hasSeen) {
                setShowIntroForce(true);
            }
        }
    }, [data.profile]);
    
    const isReportEditor = location.pathname.includes("/report") && location.pathname.includes("/audit/");
    const isFullScreen = isReportEditor;

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="h-[100dvh] w-full flex bg-slate-50 dark:bg-slate-950 overflow-hidden font-outfit transition-colors duration-300">
            <TrialOverlay />
            {showIntroForce && <IntroPresentation onClose={() => setShowIntroForce(false)} />}
            {/* Sidebar Overlay for Mobile */}
            {isSidebarOpen && !isFullScreen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-[2px] transition-all"
                    onClick={closeSidebar}
                />
            )}

            {!isFullScreen && <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />}
            
            {/* The main content area */}
            <main className={cn(
                "flex-1 flex flex-col min-w-0 relative h-full transition-all duration-300",
                !isFullScreen ? "pt-16 lg:ml-64 ml-0" : "pt-0 ml-0"
            )}>
                {!isFullScreen && <Header toggleSidebar={toggleSidebar} />}
                
                {/* The Outlet area */}
                <div 
                    id="main-scroll-container"
                    className={cn(
                    "flex-1 overflow-y-auto relative bg-slate-50 dark:bg-slate-950 scrollbar-none transition-colors duration-300",
                    !isFullScreen ? "px-4 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8" : "p-0"
                )}>
                    <Outlet />
                </div>
                
                {/* Mobile Bottom Navigation */}
                {!isFullScreen && (
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-40 pb-safe">
                        <NavLink 
                            to="/" 
                            className={({ isActive }) => cn(
                                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all",
                                isActive ? "text-primary" : "text-slate-400"
                            )}
                        >
                            <LayoutDashboard size={20} />
                            <span className="text-[10px] font-bold">Panel</span>
                        </NavLink>
                        <NavLink 
                            to="/tasks" 
                            className={({ isActive }) => cn(
                                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all",
                                isActive ? "text-primary" : "text-slate-400"
                            )}
                        >
                            <CheckSquare size={20} />
                            <span className="text-[10px] font-bold">Görevler</span>
                        </NavLink>
                        <NavLink 
                            to="/audit" 
                            className={({ isActive }) => cn(
                                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all",
                                isActive ? "text-primary" : "text-slate-400"
                            )}
                        >
                            <FileText size={20} />
                            <span className="text-[10px] font-bold">Raporlar</span>
                        </NavLink>
                        {(data.profile?.role === 'admin' || ["sefayaprakli@hotmail.com", "sefa.yaprakli@gsb.gov.tr", "syaprakli@gmail.com"].includes(data.profile?.email || "")) && (
                            <NavLink 
                                to="/admin" 
                                className={({ isActive }) => cn(
                                    "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all",
                                    isActive ? "text-amber-500" : "text-slate-400"
                                )}
                            >
                                <Shield size={20} />
                                <span className="text-[10px] font-bold">Kurucu</span>
                            </NavLink>
                        )}
                        <NavLink 
                            to="/settings" 
                            className={({ isActive }) => cn(
                                "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all",
                                isActive ? "text-primary" : "text-slate-400"
                            )}
                        >
                            <Settings size={20} />
                            <span className="text-[10px] font-bold">Ayarlar</span>
                        </NavLink>
                    </div>
                )}
                
                {/* Draggable Widgets */}
                {!isFullScreen && <DraggableRadioWidget />}
            </main>
        </div>
    );
}
