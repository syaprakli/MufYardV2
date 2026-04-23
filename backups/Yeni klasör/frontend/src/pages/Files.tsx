import { 
    Folder, File as FileIcon, Plus, Search, ChevronRight, ChevronDown, 
    Download, Trash2, Shield, FolderOpen,
    FileText, Image as ImageIcon, Video, Music, 
    Upload, X, Grid, List as ListIcon, RefreshCw
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchFileTree, uploadFile, createFolder, deleteItem, openFolder, type FileItem } from "../lib/api/files";
import { cn } from "../lib/utils";


export default function Files() {
    const confirm = useConfirm();



    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
    const [currentPath, setCurrentPath] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchFileTree();
            setItems(data);
        } catch (error) {
            console.error(error);
            toast.error("Yükleme başarısız");
        } finally {
            setLoading(false);
        }
    };

    const toggleFolder = (id: string) => {
        const next = new Set(expandedFolders);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedFolders(next);
    };

    const currentFiles = useMemo(() => {
        return items.filter(item => {
            const matchesPath = (currentPath === '' && !item.parentId) || item.parentId === currentPath;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesPath && (searchQuery ? matchesSearch : true);
        }).sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
    }, [items, currentPath, searchQuery]);

    const breadcrumbs = useMemo(() => {
        if (!currentPath) return [];
        return currentPath.split('/');
    }, [currentPath]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await uploadFile(file, currentPath);
            await loadData();
            toast.success("Dosya yüklendi");
        } catch (error) {
            toast.error("Yükleme başarısız");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: "Öğeyi Sil",
            message: "Bu öğeyi silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;

        try {
            await deleteItem(id);
            await loadData();
            if (previewFile?.id === id) setPreviewFile(null);
            toast.success("Silindi");
        } catch (error) {
            toast.error("Silme başarısız");
        }
    };

    const handleCreateFolder = async () => {
        const name = prompt("Klasör adı:");
        if (!name) return;
        try {
            await createFolder(name, currentPath);
            await loadData();
            toast.success("Klasör oluşturuldu");
        } catch (error) {
            toast.error("Klasör oluşturulamadı");
        }
    };

    const handleOpenFolder = async (id: string) => {
        try {
            await openFolder(id);
        } catch (error) {
            toast.error("Klasör açılamadı");
        }
    };

    const handleDownload = (item: FileItem) => {
        if (item.type === "folder") {
            toast.error("Klasör indirilemez. Lütfen dosya seçin.");
            return;
        }
        if (!item.url) {
            toast.error("Bu dosya için indirme bağlantısı bulunamadı.");
            return;
        }

        const link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.download = item.name || "dosya";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getFileIcon = (item: FileItem) => {
        if (item.type === 'folder') return <Folder size={20} className="text-primary fill-primary/10" />;
        if (item.type === 'image') return <ImageIcon size={20} className="text-rose-500" />;
        if (item.type === 'pdf') return <FileText size={20} className="text-red-500" />;
        if (item.type === 'video') return <Video size={20} className="text-purple-500" />;
        if (item.type === 'audio') return <Music size={20} className="text-amber-500" />;
        return <FileIcon size={20} className="text-slate-400" />;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-outfit">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 p-6 rounded-3xl border border-white/60 backdrop-blur-xl shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platformu</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Dosya Yönetimi</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        Dosya Yönetimi
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Denetim klasörlerinizi ve belgelerinizi organize edin.</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="outline" 
                        onClick={loadData}
                        className="h-12 w-12 rounded-2xl border-white bg-white/50 backdrop-blur-sm p-0 shadow-sm hover:rotate-180 transition-transform duration-500"
                    >
                        <RefreshCw size={18} className="text-slate-600" />
                    </Button>
                    <Button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="h-12 px-8 shadow-xl shadow-primary/20 rounded-2xl bg-primary text-white font-black uppercase text-[11px] tracking-widest hover:-translate-y-1 transition-all active:scale-95"
                    >
                        {isUploading ? <RefreshCw className="mr-2 animate-spin" size={18} /> : <Upload className="mr-2" size={18} />}
                        Dosya Yükle
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-3">
                    <Card className="p-6 rounded-3xl border-white/60 bg-white/40 backdrop-blur-xl shadow-sm h-[700px] overflow-y-auto custom-scrollbar border-none">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-500">Klasör Ağacı</h3>
                            <Button variant="ghost" size="sm" onClick={handleCreateFolder} className="h-8 w-8 rounded-xl"><Plus size={16} /></Button>
                        </div>
                        <div className="space-y-1">
                            <Tree items={items} expandedFolders={expandedFolders} onToggle={toggleFolder} onSelect={setCurrentPath} selectedId={currentPath} />
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-9 space-y-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1 w-full bg-white/60 border border-white/80 rounded-2xl px-5 py-3 flex items-center shadow-inner-sm focus-within:ring-2 ring-primary/10 transition-all backdrop-blur-sm">
                            <Search size={18} className="text-slate-400 mr-3" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Dosya adı, tür veya içerik ile ara..."
                                className="bg-transparent border-none outline-none text-sm w-full font-medium text-slate-700 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-2 p-1.5 bg-white/40 rounded-2xl border border-white/60 backdrop-blur-sm">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setViewMode('list')}
                                className={cn("rounded-xl h-9 w-9 p-0", viewMode === 'list' ? "shadow-md bg-white text-primary" : "text-slate-500")}
                            >
                                <ListIcon size={18} />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setViewMode('grid')}
                                className={cn("rounded-xl h-9 w-9 p-0", viewMode === 'grid' ? "shadow-md bg-white text-primary" : "text-slate-500")}
                            >
                                <Grid size={18} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-2 overflow-x-auto no-scrollbar">
                        <button 
                            onClick={() => setCurrentPath('')}
                            className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", !currentPath ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                        >
                            ROOT
                        </button>
                        {breadcrumbs.map((part, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <ChevronRight size={12} className="text-slate-300" />
                                <button 
                                    onClick={() => setCurrentPath(breadcrumbs.slice(0, idx + 1).join('/'))}
                                    className={cn("text-[11px] font-black uppercase tracking-widest transition-colors truncate max-w-[150px]", idx === breadcrumbs.length - 1 ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                                >
                                    {part}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* File List/Grid */}
                    <Card className="p-0 border-white/60 bg-white/40 backdrop-blur-xl shadow-md overflow-hidden rounded-3xl min-h-[550px] border-none">
                        {loading ? (
                            <div className="h-[550px] flex flex-col items-center justify-center gap-4">
                                <motion.div 
                                    animate={{ rotate: 360 }} 
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="p-4 rounded-3xl bg-primary/5 text-primary"
                                >
                                    <RefreshCw size={32} />
                                </motion.div>
                                <p className="text-slate-400 text-sm font-medium animate-pulse">Dosyalar okunuyor...</p>
                            </div>
                        ) : currentFiles.length > 0 ? (
                            <div className={cn("p-4", viewMode === 'list' ? "divide-y divide-white/40" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4")}>
                                <AnimatePresence mode="popLayout">
                                    {currentFiles.map((item) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            key={item.id}
                                            onClick={() => item.type === 'folder' ? setCurrentPath(item.id) : setPreviewFile(item)}
                                            className={cn(
                                                "group cursor-pointer transition-all active:scale-95 duration-300",
                                                viewMode === 'list' 
                                                    ? "flex items-center justify-between p-4 rounded-2xl hover:bg-white/60 border border-transparent hover:border-white hover:shadow-sm"
                                                    : "flex flex-col items-center justify-center p-6 rounded-3xl bg-white/30 border border-white/60 hover:bg-white/80 hover:shadow-lg hover:border-primary/20 aspect-square text-center relative"
                                            )}
                                        >
                                            <div className={cn("flex items-center", viewMode === 'list' ? "gap-4" : "flex-col gap-3")}>
                                                <div className={cn(
                                                    "p-3 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-500",
                                                    item.type === 'folder' ? "bg-primary/5" : ""
                                                )}>
                                                    {getFileIcon(item)}
                                                </div>
                                                <div className={viewMode === 'list' ? "" : "px-2"}>
                                                    <p className={cn("font-bold text-slate-800 transition-colors group-hover:text-primary", viewMode === 'list' ? "text-sm" : "text-xs line-clamp-2 uppercase tracking-wide")}>{item.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{item.size || 'Klasör'} {item.date && `• ${item.date}`}</p>
                                                </div>
                                            </div>
                                            
                                            <div className={cn("flex items-center gap-1", viewMode === 'list' ? "opacity-0 group-hover:opacity-100 transition-opacity" : "absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity")}>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenFolder(item.id); }}
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-primary"
                                                    title="Klasörü Aç"
                                                >
                                                    <FolderOpen size={14} />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-primary"
                                                    title="İndir"
                                                >
                                                    <Download size={14} />
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-500"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="h-[550px] flex flex-col items-center justify-center text-center p-12">
                                <div className="p-6 rounded-full bg-slate-50 mb-6 group-hover:scale-110 transition-transform">
                                    <Folder size={64} className="text-slate-200" strokeWidth={1} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">Burası Çok Sessiz...</h3>
                                <p className="text-slate-400 text-sm mt-2 max-w-xs">Bu klasörde henüz bir dosya bulunmuyor. Yeni bir dosya yükleyerek başlayın.</p>
                                <Button onClick={() => fileInputRef.current?.click()} className="mt-8 rounded-2xl">Dosya Yükle</Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewFile && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-slate-900/80 backdrop-blur-md"
                        onClick={() => setPreviewFile(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm">{getFileIcon(previewFile)}</div>
                                    <div>
                                        <h3 className="font-black text-slate-800">{previewFile.name}</h3>
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{previewFile.size} • {previewFile.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button 
                                        size="icon" 
                                        variant="outline" 
                                        onClick={() => handleOpenFolder(previewFile.id)}
                                        className="rounded-2xl h-12 w-12 bg-white"
                                        title="Klasörü Aç"
                                    >
                                        <FolderOpen size={18} />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={() => handleDownload(previewFile)}
                                        className="rounded-2xl h-12 w-12 bg-white"
                                        title="İndir"
                                    >
                                        <Download size={18} />
                                    </Button>
                                    <Button size="icon" variant="outline" onClick={() => setPreviewFile(null)} className="rounded-2xl h-12 w-12 bg-white"><X size={18} /></Button>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden relative group">
                                {previewFile.type === 'image' ? (
                                    <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                                ) : previewFile.type === 'pdf' ? (
                                    <iframe src={previewFile.url} className="w-full h-full border-none shadow-2xl" />
                                ) : (
                                    <div className="text-center">
                                        <FileIcon size={120} className="text-slate-300 mx-auto mb-6" strokeWidth={1} />
                                        <p className="text-slate-500 font-bold">Önizleme bu dosya türü için desteklenmiyor.</p>
                                        <Button
                                            onClick={() => handleDownload(previewFile)}
                                            className="mt-4 rounded-xl shadow-lg"
                                        >
                                            Şimdi İndir
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function Tree({ items, expandedFolders, onToggle, onSelect, selectedId, parentId = null }: any) {
    const children = items.filter((item: any) => {
        // If parentId is null, we look for items without parentId or root items
        if (parentId === null) return !item.parentId;
        return item.parentId === parentId && item.type === 'folder';
    });
    
    if (children.length === 0) return null;

    return (
        <div className={cn("space-y-1", parentId !== null ? "ml-4 border-l border-slate-100/50 pl-2 mt-1" : "")}>
            {children.map((child: any) => {
                if (child.type !== 'folder') return null;
                return (
                    <div key={child.id}>
                        <div
                            className={cn(
                                "flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all duration-300 group hover:translate-x-1",
                                selectedId === child.id ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(child.id);
                                onToggle(child.id);
                            }}
                        >
                            <span className="shrink-0 transition-transform duration-300">
                                {expandedFolders.has(child.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5" />}
                            </span>
                            <Folder size={18} className={cn("shrink-0 transition-all", expandedFolders.has(child.id) ? "text-primary fill-primary/10" : "text-slate-400 group-hover:text-primary")} />
                            <span className={cn("text-[13px] truncate font-semibold", selectedId === child.id ? "font-bold" : "")}>{child.name}</span>
                        </div>
                        {expandedFolders.has(child.id) && (
                            <Tree items={items} expandedFolders={expandedFolders} onToggle={onToggle} onSelect={onSelect} selectedId={selectedId} parentId={child.id} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
