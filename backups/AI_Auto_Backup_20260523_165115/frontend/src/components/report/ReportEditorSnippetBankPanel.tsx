import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";

export interface Snippet {
    id: string;
    title: string;
    content: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (content: string) => void;
}

const defaultSnippets: Snippet[] = [
    { id: "1", title: "Giriş Paragrafı", content: "Bu rapor, ... tarihli ve ... sayılı makam onayı üzerine hazırlanmıştır." },
    { id: "2", title: "Sonuç ve Öneriler", content: "Yapılan inceleme ve değerlendirmeler neticesinde ... kanaatine varılmıştır." },
    { id: "3", title: "Mevzuat Atıfı", content: "İlgili mevzuat: 5018 sayılı Kamu Mali Yönetimi ve Kontrol Kanunu ..." }
];

export default function ReportEditorSnippetBankPanel({ isOpen, onClose, onInsert }: Props) {
    const [snippets, setSnippets] = useState<Snippet[]>(() => {
        const raw = localStorage.getItem("mufyard_snippet_bank");
        if (raw) try { return JSON.parse(raw); } catch { return defaultSnippets; }
        return defaultSnippets;
    });
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");

    const handleAdd = () => {
        if (!newTitle.trim() || !newContent.trim()) return;
        const next = [{ id: Date.now().toString(), title: newTitle, content: newContent }, ...snippets];
        setSnippets(next);
        localStorage.setItem("mufyard_snippet_bank", JSON.stringify(next));
        setNewTitle("");
        setNewContent("");
    };
    const handleDelete = (id: string) => {
        const next = snippets.filter(s => s.id !== id);
        setSnippets(next);
        localStorage.setItem("mufyard_snippet_bank", JSON.stringify(next));
    };
    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
    };
    return isOpen ? (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
                <div className="mb-4 flex items-center gap-2">
                    <span className="font-bold text-lg text-blue-700 dark:text-blue-200">Sık Kullanılan Metinler</span>
                </div>
                <div className="mb-4 flex gap-2">
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Başlık" className="flex-1 px-2 py-1 rounded border text-sm" />
                    <input value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Metin" className="flex-1 px-2 py-1 rounded border text-sm" />
                    <button onClick={handleAdd} className="bg-blue-600 text-white rounded px-2 py-1 flex items-center"><Plus size={16} /></button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {snippets.length === 0 && <div className="text-gray-500 text-sm py-8">Henüz metin eklenmedi.</div>}
                    {snippets.map(s => (
                        <div key={s.id} className="py-2 px-1 flex items-center gap-2">
                            <div className="flex-1">
                                <div className="font-bold text-blue-700 dark:text-blue-300 text-sm">{s.title}</div>
                                <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{s.content}</div>
                            </div>
                            <button onClick={() => onInsert(s.content)} className="text-green-600 hover:text-green-800" title="Editöre ekle"><Copy size={18} /></button>
                            <button onClick={() => handleCopy(s.content)} className="text-blue-400 hover:text-blue-700" title="Kopyala"><Copy size={16} /></button>
                            <button onClick={() => handleDelete(s.id)} className="text-rose-400 hover:text-rose-700" title="Sil"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    ) : null;
}
