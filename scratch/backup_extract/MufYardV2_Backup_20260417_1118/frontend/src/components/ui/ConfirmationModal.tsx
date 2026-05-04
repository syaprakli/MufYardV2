import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle, Info, Trash2, CheckCircle2 } from "lucide-react";

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'info' | 'warning' | 'success';
}

export function ConfirmationModal({
    isOpen,
    title,
    message,
    confirmText = "Onayla",
    cancelText = "Vazgeç",
    onConfirm,
    onCancel,
    variant = 'danger'
}: ConfirmationModalProps) {
    
    const colors = {
        danger: {
            bg: "bg-rose-50",
            icon: "text-rose-500",
            button: "bg-rose-500 hover:bg-rose-600 shadow-rose-200",
            outline: "border-rose-100"
        },
        warning: {
            bg: "bg-amber-50",
            icon: "text-amber-500",
            button: "bg-amber-500 hover:bg-amber-600 shadow-amber-200",
            outline: "border-amber-100"
        },
        info: {
            bg: "bg-blue-50",
            icon: "text-blue-500",
            button: "bg-blue-500 hover:bg-blue-600 shadow-blue-200",
            outline: "border-blue-100"
        },
        success: {
            bg: "bg-emerald-50",
            icon: "text-emerald-500",
            button: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200",
            outline: "border-emerald-100"
        }
    };

    const config = colors[variant];

    const getIcon = () => {
        switch (variant) {
            case 'danger': return <Trash2 size={24} />;
            case 'warning': return <AlertTriangle size={24} />;
            case 'success': return <CheckCircle2 size={24} />;
            default: return <Info size={24} />;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            size="small"
        >
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 ${config.bg} ${config.icon} rounded-2xl flex items-center justify-center shrink-0`}>
                        {getIcon()}
                    </div>
                    <div>
                        <h3 className="text-lg font-black font-outfit text-slate-800 leading-tight">{title}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest">Onay Gerekiyor</p>
                    </div>
                </div>

                <div className={`p-5 rounded-2xl border ${config.outline} ${config.bg}/30`}>
                    <p className="text-sm font-bold text-slate-600 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button 
                        variant="outline" 
                        onClick={onCancel}
                        className="flex-1 h-12 rounded-xl text-slate-500 font-bold border-slate-200 hover:bg-slate-50"
                    >
                        {cancelText}
                    </Button>
                    <Button 
                        onClick={onConfirm}
                        className={`flex-1 h-12 rounded-xl text-white font-bold shadow-lg ${config.button}`}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
