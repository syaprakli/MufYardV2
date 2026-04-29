import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "../../lib/utils";

export function MainLayout() {

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="h-screen w-full flex bg-slate-50 dark:bg-slate-950 overflow-hidden font-outfit transition-colors duration-300">
            {/* Sidebar Overlay for Mobile */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-[2px] transition-all"
                    onClick={closeSidebar}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
            
            {/* The main content area */}
            <main className={cn(
                "flex-1 flex flex-col min-w-0 relative h-full pt-16 transition-all duration-300",
                "lg:ml-64 ml-0"
            )}>
                <Header toggleSidebar={toggleSidebar} />
                
                {/* The Outlet area */}
                <div className="flex-1 overflow-y-auto relative bg-slate-50 dark:bg-slate-950 scrollbar-none px-4 lg:px-8 py-6 lg:py-8 transition-colors duration-300">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
