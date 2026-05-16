import React from 'react';
import { Search, Users, MoreVertical, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { type Inspector } from "../../lib/api/inspectors";

interface InspectorListSectionProps {
    inspectors: Inspector[];
    inspectorsLoading: boolean;
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    itemsPerPage: number;
    openRoleMenu: string | null;
    setOpenRoleMenu: React.Dispatch<React.SetStateAction<string | null>>;
    handleUpdateRole: (uid: string, role: 'admin' | 'moderator' | 'user') => Promise<void>;
    handleDelete: (id: string) => Promise<void>;
    filteredInspectors: Inspector[];
    paginatedInspectors: Inspector[];
    totalPages: number;
}

export const InspectorListSection: React.FC<InspectorListSectionProps> = ({
    inspectorsLoading,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    openRoleMenu,
    setOpenRoleMenu,
    handleUpdateRole,
    handleDelete,
    filteredInspectors,
    paginatedInspectors,
    totalPages
}) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                    <Users className="text-primary" size={24} />
                    <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Müfettiş Yönetimi</h3>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text"
                        placeholder="İsim veya e-posta ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-12 pl-11 pr-4 bg-muted border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                    />
                </div>
            </div>

            <div className="space-y-3">
                {inspectorsLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 bg-muted/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <p className="text-xs font-bold text-slate-400 animate-pulse">Kullanıcı listesi hazırlanıyor...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {paginatedInspectors.map((ins) => (
                            <div key={ins.id} className="group p-4 bg-muted/30 hover:bg-muted dark:bg-slate-800/40 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-3xl flex items-center justify-between transition-all hover:shadow-lg hover:shadow-primary/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
                                        {ins.name?.[0] || '?'}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{ins.name || 'İsimsiz Kullanıcı'}</h4>
                                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{ins.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-black uppercase tracking-wider">{ins.title}</span>
                                            {(ins as any).is_registered && <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-black uppercase tracking-wider">Aktif</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <button 
                                            onClick={() => setOpenRoleMenu(openRoleMenu === ins.id ? null : ins.id)}
                                            className="p-3 text-slate-400 dark:text-slate-600 hover:text-primary dark:hover:text-primary/90 hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-all"
                                        >
                                            <MoreVertical size={18} />
                                        </button>
                                        {openRoleMenu === ins.id && (
                                            <div className="absolute right-0 top-12 w-48 bg-card border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in duration-200">
                                                <button onClick={() => handleUpdateRole(ins.id, 'admin')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-muted dark:hover:bg-slate-700 transition-colors text-muted-foreground dark:text-slate-300">Yönetici Yap</button>
                                                <button onClick={() => handleUpdateRole(ins.id, 'moderator')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-muted dark:hover:bg-slate-700 transition-colors text-muted-foreground dark:text-slate-300">Moderatör Yap</button>
                                                <button onClick={() => handleUpdateRole(ins.id, 'user')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-muted dark:hover:bg-slate-700 transition-colors text-muted-foreground dark:text-slate-300">Yetkisini Kaldır</button>
                                                <div className="h-[1px] bg-slate-100 dark:bg-slate-700 my-1" />
                                                <button onClick={() => handleDelete(ins.id)} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-rose-500">Sistemden Sil</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredInspectors.length === 0 && (
                            <div className="text-center py-10 bg-muted/20 dark:bg-slate-800/20 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
                                <Users size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-600">
                                    {searchTerm ? "Aranan kriterde kullanıcı bulunamadı." : "Henüz sisteme kayıtlı bir kullanıcı bulunmuyor."}
                                </p>
                            </div>
                        )}

                        {/* Sayfalama Kontrolleri */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-6 border-t border-slate-50 dark:border-slate-800">
                                <p className="text-[11px] font-bold text-slate-400">
                                    Toplam {filteredInspectors.length} kayıttan {(currentPage-1)*itemsPerPage+1}-{Math.min(currentPage*itemsPerPage, filteredInspectors.length)} arası gösteriliyor
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        className="w-10 h-10 p-0 rounded-xl border-slate-100"
                                    >
                                        <ChevronLeft size={18} />
                                     </Button>
                                     
                                     <div className="flex items-center gap-1 px-2">
                                         {[...Array(totalPages)].map((_, i) => (
                                             <button
                                                 key={i}
                                                 onClick={() => setCurrentPage(i + 1)}
                                                 className={cn(
                                                     "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                                     currentPage === i + 1 
                                                         ? "bg-primary text-white shadow-lg shadow-primary/20" 
                                                         : "text-slate-400 dark:text-slate-500 hover:bg-muted dark:hover:bg-slate-800"
                                                 )}
                                             >
                                                 {i + 1}
                                             </button>
                                         ))}
                                     </div>

                                     <Button 
                                         variant="outline" 
                                         disabled={currentPage === totalPages}
                                         onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                         className="w-10 h-10 p-0 rounded-xl border-slate-100"
                                     >
                                         <ChevronRight size={18} />
                                     </Button>
                                 </div>
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};
