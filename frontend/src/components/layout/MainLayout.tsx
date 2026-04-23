import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function MainLayout() {
    return (
        <div className="h-screen w-full flex bg-slate-50 dark:bg-slate-950 overflow-hidden font-outfit transition-colors duration-300">
            <Sidebar />
            
            {/* The main content area now shifted by Sidebar width, and padded by Header height */}
            <main className="flex-1 ml-64 flex flex-col min-w-0 relative h-full pt-16">
                <Header />
                
                {/* The Outlet area where the Forum/PublicSpace will live */}
                <div className="flex-1 overflow-y-auto relative bg-slate-50 dark:bg-slate-950 scrollbar-none px-8 py-8 transition-colors duration-300">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
