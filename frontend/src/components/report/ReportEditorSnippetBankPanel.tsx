import { useState } from "react";
import { Search, Copy, Plus, Trash2, FilePlus, Check, X, FileText, Tag } from "lucide-react";
import { toast } from "react-hot-toast";

export interface Snippet {
    id: string;
    title: string;
    content: string;
    category?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (content: string) => void;
}

const defaultSnippets: Snippet[] = [
    { id: "1", title: "Giriş Paragrafı", content: "Bu rapor, ... tarihli ve ... sayılı makam onayı üzerine hazırlanmıştır.", category: "Giriş" },
    { id: "2", title: "Sonuç ve Öneriler", content: "Yapılan inceleme ve değerlendirmeler neticesinde ... kanaatine varılmıştır.", category: "Sonuç" },
    { id: "3", title: "Mevzuat Atıfı", content: "İlgili mevzuat: 5018 sayılı Kamu Mali Yönetimi ve Kontrol Kanunu ...", category: "Mevzuat" }
];

const categories = ["Tümü", "Giriş", "Gelişme", "Sonuç", "Mevzuat", "Genel"];
const addableCategories = ["Genel", "Giriş", "Gelişme", "Sonuç", "Mevzuat"];

export default function ReportEditorSnippetBankPanel({ isOpen, onClose, onInsert }: Props) {
    const [snippets, setSnippets] = useState<Snippet[]>(() => {
        const raw = localStorage.getItem("mufyard_snippet_bank");
        if (raw) try { return JSON.parse(raw); } catch { return defaultSnippets; }
        return defaultSnippets;
    });
    
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newCategory, setNewCategory] = useState("Genel");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Tümü");
    
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [insertedId, setInsertedId] = useState<string | null>(null);

    const handleAdd = () => {
        if (!newTitle.trim() || !newContent.trim()) {
            toast.error("Lütfen başlık ve metin alanlarını doldurun.");
            return;
        }
        const next = [{ 
            id: Date.now().toString(), 
            title: newTitle, 
            content: newContent,
            category: newCategory 
        }, ...snippets];
        setSnippets(next);
        localStorage.setItem("mufyard_snippet_bank", JSON.stringify(next));
        setNewTitle("");
        setNewContent("");
        setNewCategory("Genel");
        toast.success("Yeni taslak metin başarıyla eklendi.");
    };

    const handleDelete = (id: string) => {
        const next = snippets.filter(s => s.id !== id);
        setSnippets(next);
        localStorage.setItem("mufyard_snippet_bank", JSON.stringify(next));
        toast.success("Taslak metin silindi.");
    };

    const handleCopyAction = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        toast.success("Taslak panoya kopyalandı.");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleInsertAction = (id: string, content: string) => {
        onInsert(content);
        setInsertedId(id);
        toast.success("Taslak editöre aktarıldı.");
        setTimeout(() => setInsertedId(null), 2000);
    };

    const filteredSnippets = snippets.filter(s => {
        const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              s.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "Tümü" || (s.category || "Genel") === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getCategoryColor = (cat?: string) => {
        switch (cat) {
            case "Giriş": return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30";
            case "Gelişme": return "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30";
            case "Sonuç": return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30";
            case "Mevzuat": return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30";
            default: return "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800/50";
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            onClick={onClose}
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 shadow-2xl rounded-3xl p-6 w-full max-w-lg relative flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <X size={18} />
                </button>
                
                {/* Header */}
                <div className="mb-4 flex items-center gap-2 flex-shrink-0">
                    <FileText size={20} className="text-violet-600" />
                    <h2 className="font-black text-lg text-slate-800 dark:text-slate-100 tracking-tight">Taslak Metinler</h2>
                </div>

                {/* Form to Add New Snippet */}
                <div className="space-y-3 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-4 mb-4 flex-shrink-0">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Yeni Taslak Metin Ekle</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2">
                        <input 
                            value={newTitle} 
                            onChange={e => setNewTitle(e.target.value)} 
                            placeholder="Başlık (örn: Giriş Paragrafı)" 
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-violet-500 transition-all font-semibold text-slate-800 dark:text-slate-100" 
                        />
                        <select 
                            value={newCategory} 
                            onChange={e => setNewCategory(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-violet-500 transition-all font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                            {addableCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <textarea 
                        value={newContent} 
                        onChange={e => setNewContent(e.target.value)} 
                        placeholder="Taslak metin içeriğini buraya yazın..." 
                        rows={3}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-violet-500 transition-all font-medium text-slate-700 dark:text-slate-200 resize-none" 
                    />
                    <button 
                        onClick={handleAdd} 
                        className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl py-2 flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-violet-100 dark:shadow-none"
                    >
                        <Plus size={14} /> Taslak Ekle
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="space-y-3 mb-3 flex-shrink-0">
                    {/* Search Bar */}
                    <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                            <Search size={14} />
                        </span>
                        <input 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Taslak metinlerde ara..." 
                            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-violet-500 transition-all font-semibold text-slate-800 dark:text-slate-100"
                        />
                    </div>
                    
                    {/* Category Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all whitespace-nowrap flex items-center gap-1 ${
                                    selectedCategory === cat 
                                        ? "bg-violet-600 text-white border-violet-600 shadow-sm" 
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 dark:border-slate-800"
                                }`}
                            >
                                <Tag size={8} /> {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Snippet List */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[300px]">
                    {filteredSnippets.length === 0 && (
                        <div className="text-slate-400 text-xs font-semibold text-center py-8 bg-slate-50/30 dark:bg-slate-800/10 rounded-2xl border border-dashed border-slate-200/50 dark:border-slate-800/50">
                            Arama kriterlerine veya seçili kategoriye uygun taslak bulunamadı.
                        </div>
                    )}
                    {filteredSnippets.map(s => (
                        <div key={s.id} className="group bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 flex items-start gap-3 hover:border-violet-200 dark:hover:border-violet-900/50 hover:shadow-md transition-all duration-200">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-xs tracking-tight">{s.title}</span>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${getCategoryColor(s.category)}`}>
                                        {s.category || "Genel"}
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed break-words line-clamp-3 select-all">{s.content}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 self-center">
                                {/* Insert to Editor */}
                                <button 
                                    onClick={() => handleInsertAction(s.id, s.content)} 
                                    className={`p-1.5 rounded-lg border transition-all ${
                                        insertedId === s.id 
                                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" 
                                            : "bg-slate-50 text-slate-500 hover:text-violet-600 hover:border-violet-100 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-violet-400 dark:hover:border-violet-900/50"
                                    }`}
                                    title="Editöre Ekle"
                                >
                                    {insertedId === s.id ? <Check size={14} /> : <FilePlus size={14} />}
                                </button>
                                {/* Copy to Clipboard */}
                                <button 
                                    onClick={() => handleCopyAction(s.id, s.content)} 
                                    className={`p-1.5 rounded-lg border transition-all ${
                                        copiedId === s.id 
                                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" 
                                            : "bg-slate-50 text-slate-500 hover:text-slate-800 hover:border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-700"
                                    }`}
                                    title="Kopyala"
                                >
                                    {copiedId === s.id ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                {/* Delete Snippet */}
                                <button 
                                    onClick={() => handleDelete(s.id)} 
                                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-100 dark:bg-slate-800/50 dark:hover:bg-rose-950/20 dark:text-slate-500 dark:hover:text-rose-400 dark:hover:border-rose-900/30 transition-all"
                                    title="Sil"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
