import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getUserColor(id: string): string {
    const colors = [
        'bg-rose-600',
        'bg-blue-600',
        'bg-emerald-600',
        'bg-amber-600',
        'bg-indigo-600',
        'bg-violet-600',
        'bg-cyan-600',
        'bg-orange-600',
        'bg-fuchsia-600',
        'bg-teal-600',
        'bg-slate-700',
        'bg-pink-600'
    ];
    
    if (!id) return colors[0];
    
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}
