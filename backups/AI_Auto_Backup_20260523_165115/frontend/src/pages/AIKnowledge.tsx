import { useState, useEffect, useCallback } from "react";
import {
    Bot, Plus, Edit2, Trash2, Search, Tag, ChevronRight, Shield,
    BookOpen, X, Check, Loader2, Database, Sparkles
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { API_URL } from "../lib/config";
import { toast } from "react-hot-toast";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { useConfirm } from "../lib/context/ConfirmContext";

interface KnowledgeItem {
    id: string;
    category: string;
    topic: string;
    description: string;
    standard_remark: string;
    tags: string[];
    created_at: string;
    updated_at?: string;
}

const PRESET_CATEGORIES = [
    "Yurt İşlemleri", "Spor Tesisi", "Federasyon", "Denetim Genel",
    "İdari İşlemler", "Mali İşlemler", "Teknik Kontrol", "Diğer"
];

const emptyForm = {
    category: "",
    topic: "",
    description: "",
    standard_remark: "",
    tags: [] as string[],
};

export default function AIKnowledge() {
    const confirm = useConfirm();
    const [items, setItems] = useState<KnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
    const [saving, setSaving] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [form, setForm] = useState({ ...emptyForm });

    const resetForm = () => {
        setForm({ ...emptyForm });
        setEditingItem(null);
        setTagInput("");
    };

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const url = categoryFilter
                ? `${API_URL}/ai-knowledge/?category=${encodeURIComponent(categoryFilter)}`
                : `${API_URL}/ai-knowledge/`;
            const headers = await getAuthHeaders();
            const res = await fetchWithTimeout(url, { headers });
            const data = await res.json();
            setItems(data);
        } catch {
            toast.error("Bilgi bankası yüklenemedi.");
        } finally {
            setLoading(false);
        }
    }, [categoryFilter]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const openAdd = () => { resetForm(); setShowModal(true); };

    const openEdit = (item: KnowledgeItem) => {
        setEditingItem(item);
        setForm({
            category: item.category,
            topic: item.topic,
            description: item.description,
            standard_remark: item.standard_remark,
            tags: item.tags || [],
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.category || !form.topic || !form.standard_remark) {
            toast.error("Kategori, konu ve tenkit metni zorunludur.");
            return;
        }
        setSaving(true);
        try {
            if (editingItem) {
                const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                await fetchWithTimeout(`${API_URL}/ai-knowledge/${editingItem.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(form),
                });
                toast.success("Güncellendi.");
            } else {
                const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                await fetchWithTimeout(`${API_URL}/ai-knowledge/`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(form),
                });
                toast.success("Tenkit maddesi eklendi.");
            }
            setShowModal(false);
            resetForm();
            loadItems();
        } catch {
            toast.error("Kaydedilemedi.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: KnowledgeItem) => {
        const confirmed = await confirm({
            title: "Maddeyi Sil",
            message: `"${item.topic}" tenkit maddesini silmek istediğinize emin misiniz?`,
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        try {
            const headers = await getAuthHeaders();
            await fetchWithTimeout(`${API_URL}/ai-knowledge/${item.id}`, { method: "DELETE", headers });
            toast.success("Silindi.");
            loadItems();
        } catch {
            toast.error("Silinemedi.");
        }
    };

    const addTag = () => {
        const tag = tagInput.trim();
        if (tag && !form.tags.includes(tag)) {
            setForm(f => ({ ...f, tags: [...f.tags, tag] }));
        }
        setTagInput("");
    };

    const removeTag = (tag: string) => {
        setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
    };

    const categories = [...new Set(items.map(i => i.category))].sort();

    const filtered = items.filter(item => {
        const matchSearch = !search ||
            item.topic.toLowerCase().includes(search.toLowerCase()) ||
            item.description.toLowerCase().includes(search.toLowerCase()) ||
            item.standard_remark.toLowerCase().includes(search.toLowerCase()) ||
            item.category.toLowerCase().includes(search.toLowerCase());
        const matchCat = !categoryFilter || item.category === categoryFilter;
        return matchSearch && matchCat;
    });

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <Bot size={10} className="text-primary/60" />
                        <span className="text-primary opacity-80 uppercase tracking-widest">AI Bilgi Bankası</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tenkit Maddeleri</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        AI asistanının denetim süreçlerinde kullandığı tenkit kriterleri ve standart metinler.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-violet-50 text-violet-600 px-4 py-2.5 rounded-xl text-[10px] font-black border border-violet-100 shadow-sm h-11">
                        <Database size={14} />
                        <span>{items.length} Madde</span>
                    </div>
                    <Button onClick={openAdd} size="sm" className="rounded-xl h-11 px-5 shadow-md shadow-primary/20">
                        <Plus size={16} className="mr-2" /> YENİ MADDE
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            {!loading && items.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {categories.slice(0, 4).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                            className={`p-4 rounded-2xl border text-left transition-all ${
                                categoryFilter === cat
                                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                                    : "bg-white border-slate-100 hover:border-primary/30 hover:shadow-sm"
                            }`}
                        >
                            <p className={`text-2xl font-black ${categoryFilter === cat ? "text-white" : "text-slate-900"}`}>
                                {items.filter(i => i.category === cat).length}
                            </p>
                            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 truncate ${
                                categoryFilter === cat ? "text-white/80" : "text-slate-400"
                            }`}>{cat}</p>
                        </button>
                    ))}
                </div>
            )}

            {/* Search + Filter */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Madde, konu veya metin ara..."
                        className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setCategoryFilter(null)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            !categoryFilter
                                ? "bg-primary text-white shadow-md"
                                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                        Tümü ({items.length})
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                categoryFilter === cat
                                    ? "bg-primary text-white shadow-md"
                                    : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                        >
                            {cat} ({items.filter(i => i.category === cat).length})
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-primary" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <BookOpen size={28} className="text-slate-400" />
                    </div>
                    <div className="text-center">
                        <p className="text-slate-600 font-bold">
                            {search ? "Arama sonucu bulunamadı." : "Henüz tenkit maddesi eklenmemiş."}
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                            {search ? "Farklı bir arama terimi deneyin." : "AI asistanının kullanacağı ilk kriterinizi ekleyin."}
                        </p>
                    </div>
                    {!search && (
                        <Button onClick={openAdd} variant="outline" size="sm" className="rounded-xl mt-2">
                            <Plus size={14} className="mr-1" /> İlk Maddeyi Ekle
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filtered.map(item => (
                        <div
                            key={item.id}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group p-6"
                        >
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex-shrink-0 flex items-center justify-center">
                                        <Sparkles size={18} className="text-violet-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg mb-1">
                                            {item.category}
                                        </div>
                                        <h3 className="font-black text-slate-900 text-base leading-tight">{item.topic}</h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                        onClick={() => openEdit(item)}
                                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors"
                                        title="Düzenle"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item)}
                                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                                        title="Sil"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {item.description && (
                                <p className="text-sm text-slate-500 font-medium mb-3 leading-relaxed">{item.description}</p>
                            )}

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Resmi Tenkit Metni</p>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed line-clamp-4">{item.standard_remark}</p>
                            </div>

                            {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {item.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 bg-violet-50 text-violet-600 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider"
                                        >
                                            <Tag size={10} /> {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">
                                    {editingItem ? "Maddeyi Düzenle" : "Yeni Tenkit Maddesi"}
                                </h2>
                                <p className="text-sm text-slate-400 font-medium mt-0.5">
                                    AI asistanının denetimlerde kullanacağı kriter
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                                        Kategori *
                                    </label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                                    >
                                        <option value="">Seçiniz...</option>
                                        {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                                        Konu *
                                    </label>
                                    <input
                                        value={form.topic}
                                        onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                                        placeholder="Örn: Asansör Yeşil Etiket"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                                    Açıklama / Kriter
                                </label>
                                <input
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Eksikliğin kısa açıklaması..."
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                                    Resmi Tenkit Metni *
                                </label>
                                <textarea
                                    value={form.standard_remark}
                                    onChange={e => setForm(f => ({ ...f, standard_remark: e.target.value }))}
                                    placeholder="...kurumun asansörlerinin periyodik kontrol neticesinde uygunluk ifade eden yeşil etiket almadığı görülmüş olup..."
                                    rows={6}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none leading-relaxed"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                    Bu metin AI tarafından denetim raporlarında doğrudan kullanılacaktır.
                                </p>
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                                    Etiketler
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
                                        }}
                                        placeholder="Etiket ekle, Enter'a bas..."
                                        className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    />
                                    <button
                                        onClick={addTag}
                                        className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-primary hover:text-white text-sm font-bold transition-colors"
                                    >
                                        Ekle
                                    </button>
                                </div>
                                {form.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {form.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1 rounded-lg"
                                            >
                                                {tag}
                                                <button
                                                    onClick={() => removeTag(tag)}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="rounded-xl h-10 px-5"
                            >
                                İptal
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={saving}
                                className="rounded-xl h-10 px-6 shadow-md shadow-primary/20"
                            >
                                {saving
                                    ? <Loader2 size={14} className="animate-spin mr-2" />
                                    : <Check size={14} className="mr-2" />
                                }
                                {editingItem ? "Güncelle" : "Kaydet"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
