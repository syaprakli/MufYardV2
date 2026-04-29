import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'small' | 'medium' | 'large';
}

export function Modal({ isOpen, onClose, title, children, size = 'medium' }: ModalProps) {
    const sizes = {
        small: 'max-w-md',
        medium: 'max-w-lg',
        large: 'max-w-3xl',
    };
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.body.style.overflow = "hidden";
            window.addEventListener("keydown", handleEsc);
        }
        return () => {
            document.body.style.overflow = "unset";
            window.removeEventListener("keydown", handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const modalContent = (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" 
            onClick={onClose}
        >
            <div 
                className={`bg-card rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] ${sizes[size]} border border-border overflow-hidden`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/50 shrink-0">
                    <h3 className="text-lg md:text-xl font-black text-primary font-outfit tracking-tight">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
