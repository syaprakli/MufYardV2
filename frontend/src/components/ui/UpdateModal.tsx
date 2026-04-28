import { Sparkles, Download, Rocket } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface UpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    latestVersion: string;
    currentVersion: string;
}

export function UpdateModal({ isOpen, onClose, latestVersion, currentVersion }: UpdateModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Sistem Güncellemesi Mevcut"
            size="medium"
        >
            <div className="flex flex-col items-center text-center p-4">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 animate-bounce">
                    <Rocket size={40} className="text-primary" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                    Yeni Sürüm Hazır!
                </h3>
                
                <div className="flex items-center gap-3 mb-6">
                    <div className="px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200">
                        Mevcut: v{currentVersion}
                    </div>
                    <div className="w-4 h-[1px] bg-slate-200" />
                    <div className="px-3 py-1 rounded-full bg-emerald-50 text-[10px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-100">
                        Yeni: v{latestVersion}
                    </div>
                </div>

                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8 max-w-sm">
                    MufYARD'ın daha hızlı ve kararlı çalışan yeni sürümü yayınlandı. 
                    En iyi deneyim için lütfen güncel sürümü indirin.
                </p>

                <div className="w-full space-y-3">
                    <Button 
                        onClick={() => {
                            // Burada indirme linki eklenebilir veya kullanıcı yönlendirilebilir
                            window.open("https://github.com/mufyard/releases/latest", "_blank");
                        }} 
                        className="w-full h-14 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/20 text-sm uppercase tracking-widest"
                    >
                        <Download size={18} className="mr-2" /> Şimdi İndir
                    </Button>
                    
                    <button 
                        onClick={onClose}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest py-2"
                    >
                        Daha Sonra Hatırlat
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-50 w-full">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-60">
                        <Sparkles size={10} />
                        <span>MufYard Continuous Improvement</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
