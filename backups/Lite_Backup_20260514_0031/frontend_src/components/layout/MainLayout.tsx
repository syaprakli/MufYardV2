import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DraggableRadioWidget } from "./DraggableRadioWidget";
import { cn } from "../../lib/utils";

export function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    
    const isReportEditor = location.pathname.includes("/report") && location.pathname.includes("/audit/");
    const isFullScreen = isReportEditor;

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="h-screen w-full flex bg-slate-50 dark:bg-slate-950 overflow-hidden font-outfit transition-colors duration-300">
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
                <div className={cn(
                    "flex-1 overflow-y-auto relative bg-slate-50 dark:bg-slate-950 scrollbar-none transition-colors duration-300",
                    !isFullScreen ? "px-4 lg:px-8 py-6 lg:py-8" : "p-0"
                )}>
                    <Outlet />
                </div>
                
                {/* Draggable Widgets */}
                {!isFullScreen && <DraggableRadioWidget />}
            </main>
        </div>
    );
}
