import { useState, useEffect } from "react";
import { Loader2, X, Trash2, FileText, Upload, Plus, AlertCircle, Info } from "lucide-react";
import { Button } from "../ui/Button";
import { 
    type ReportExample, 
    fetchReportExamples, 
    createReportExampleFromText, 
    uploadReportExample, 
    deleteReportExample 
} from "../../lib/api/ai";
import { toast } from "react-hot-toast";

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

const REPORT_TYPES = [
    { value: "genel", label: "Genel Denetim Raporu" },
    { value: "inceleme", label: "İnceleme Raporu" },
    { value: "sorusturma", label: "Soruşturma Raporu" },
    { value: "federasyon", label: "Federasyon Genel Teftiş Raporu" },
    { value: "il", label: "İl Teftiş Raporu" }
];

export default function ReportExamplePoolModal({ isOpen, onClose }: Props) {
    const [examples, setExamples] = useState<ReportExample[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    // Form States
    const [title, setTitle] = useState("");
    const [reportType, setReportType] = useState("genel");
    const [contentMode, setContentMode] = useState<"file" | "text">("file");
    const [manualText, setManualText] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [activeRulesId, setActiveRulesId] = useState<string | null>(null);

    const loadExamples = async () => {
        setLoading(true);
        try {
            const data = await fetchReportExamples();
            setExamples(data);
        } catch (error) {
            toast.error("Örnek rapor havuzu yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadExamples();
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setTitle("");
        setReportType("genel");
        setContentMode("file");
        setManualText("");
        setSelectedFile(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setSelectedFile(file);
            if (!title) {
                // Remove extension and set as default title
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                setTitle(nameWithoutExt);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Lütfen şablon için bir başlık girin.");
            return;
        }

        setSubmitting(true);
        try {
            let result: ReportExample;
            if (contentMode === "file") {
                if (!selectedFile) {
                    toast.error("Lütfen bir dosya (.docx, .pdf, .txt) seçin.");
                    setSubmitting(false);
                    return;
                }
                result = await uploadReportExample(title, reportType, selectedFile);
            } else {
                if (!manualText.trim()) {
                    toast.error("Lütfen örnek rapor metnini yapıştırın.");
                    setSubmitting(false);
                    return;
                }
                result = await createReportExampleFromText(title, reportType, manualText);
            }
            
            toast.success(`"${result.title}" başarıyla sisteme öğretildi!`);
            resetForm();
            void loadExamples();
        } catch (error: any) {
            toast.error(error.message || "Örnek rapor öğretilirken bir hata oluştu.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const confirmDelete = window.confirm(`"${name}" şablonunu silmek istediğinize emin misiniz?`);
        if (!confirmDelete) return;

        try {
            await deleteReportExample(id);
            toast.success("Şablon havuzdan silindi.");
            void loadExamples();
            if (activeRulesId === id) setActiveRulesId(null);
        } catch (error) {
            toast.error("Şablon silinirken bir hata oluştu.");
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
                className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 shadow-2xl rounded-3xl w-full max-w-[950px] h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
                    <div>
                        <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 text-lg">
                            📁 Yapay Zeka Rapor Öğrenim Havuzu
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                            Geçmişte yazdığınız başarılı raporları buraya yükleyerek yapay zekaya kendi üslup ve şablon yapınızı öğretebilirsiniz.
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-8 h-8 p-0 hover:bg-slate-200/50 dark:hover:bg-slate-800">
                        <X size={16} />
                    </Button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Left Panel: Upload/Form (w-[400px]) */}
                    <div className="w-[400px] border-r border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-4 flex-shrink-0 bg-white dark:bg-slate-900">
                        <h4 className="text-xs font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                            <Plus size={14} /> Yeni Rapor Öğret
                        </h4>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    Şablon İsmi
                                </label>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Örn: 2025 Federasyon Teftiş Örneği"
                                    className="mt-1.5 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-slate-100"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    Rapor Kategorisi
                                </label>
                                <select
                                    value={reportType}
                                    onChange={(e) => setReportType(e.target.value)}
                                    className="mt-1.5 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                    {REPORT_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    Öğretme Yöntemi
                                </label>
                                <div className="mt-1.5 grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setContentMode("file")}
                                        className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                            contentMode === "file" 
                                                ? "bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 shadow-sm" 
                                                : "text-slate-400"
                                        }`}
                                    >
                                        Dosya Yükle
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setContentMode("text")}
                                        className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                            contentMode === "text" 
                                                ? "bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 shadow-sm" 
                                                : "text-slate-400"
                                        }`}
                                    >
                                        Metin Yapıştır
                                    </button>
                                </div>
                            </div>

                            {contentMode === "file" ? (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        Rapor Dosyası (.docx, .pdf, .txt)
                                    </label>
                                    <div className="relative border border-dashed border-slate-250 dark:border-slate-850 rounded-2xl p-6 text-center hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all cursor-pointer">
                                        <input
                                            type="file"
                                            accept=".docx,.pdf,.txt"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-normal">
                                            {selectedFile ? selectedFile.name : "Dosya seçmek için tıklayın veya sürükleyin"}
                                        </p>
                                        <p className="text-[9px] text-slate-400 mt-1">Word, PDF veya Text (Maks. 15MB)</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        Örnek Rapor İçeriği
                                    </label>
                                    <textarea
                                        value={manualText}
                                        onChange={(e) => setManualText(e.target.value)}
                                        rows={8}
                                        placeholder="Geçmişte yazdığınız başarılı bir raporun içeriğini buraya yapıştırın..."
                                        className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 resize-none"
                                        required
                                    />
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black text-xs h-10 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 mt-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Yapay Zeka Analiz Ediyor...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={14} />
                                        Sisteme Öğret ve Kaydet
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-850 p-4 rounded-2xl flex gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                            <Info size={16} className="text-violet-600 dark:text-violet-400 flex-shrink-0" />
                            <span>
                                <strong>Double Prompting:</strong> Yüklediğiniz örnek raporun ham metni yerine, AI ilk aşamada raporun yapısını, üslup tonunu ve başlık şablonunu analiz ederek kurallar setini çıkarır ve hafızaya kaydeder. Rapor üretirken bu kuralları kullanırız.
                            </span>
                        </div>
                    </div>

                    {/* Right Panel: Template List & AI Rules Viewer */}
                    <div className="flex-1 p-5 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20 flex flex-col min-w-0 space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Öğretilmiş Şablonlar ({examples.length})
                        </h4>

                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="animate-spin text-violet-600" size={32} />
                            </div>
                        ) : examples.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 text-slate-400">
                                <AlertCircle size={28} className="mb-2 text-slate-350" />
                                <p className="text-xs font-semibold">Öğrenim havuzunda henüz kayıtlı şablonunuz yok.</p>
                                <p className="text-[10px] text-slate-400 mt-1 max-w-[320px]">Sol panelden ilk örnek raporunuzu yükleyerek yapay zekaya rapor üslubunuzu öğretin.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 min-h-0 flex-1">
                                {examples.map((item) => (
                                    <div 
                                        key={item.id}
                                        className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400 flex-shrink-0">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                                                        {item.title}
                                                    </h5>
                                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                                                            {REPORT_TYPES.find(t => t.value === item.report_type)?.label || item.report_type}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-bold self-center">
                                                            {new Date(item.created_at).toLocaleDateString("tr-TR")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item.id, item.title)}
                                                className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                                title="Şablonu Sil"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        {/* Rules Accordion */}
                                        <div className="mt-4 border-t border-slate-100 dark:border-slate-850 pt-3">
                                            {activeRulesId === item.id ? (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[9px] font-black uppercase text-violet-600 dark:text-violet-400">Çıkarılan Yapay Zeka Kuralları:</span>
                                                        <button 
                                                            onClick={() => setActiveRulesId(null)} 
                                                            className="text-[9px] text-slate-400 font-bold hover:underline"
                                                        >
                                                            Kapat
                                                        </button>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/50 dark:border-slate-850 font-mono text-[10px] text-slate-600 dark:text-slate-350 whitespace-pre-wrap max-h-[180px] overflow-y-auto leading-relaxed">
                                                        {item.extracted_rules || "Kural analizi çıkarılamadı."}
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setActiveRulesId(item.id)}
                                                    className="w-full text-left py-1 text-[10px] text-violet-600 dark:text-violet-400 hover:underline font-bold"
                                                >
                                                    ✨ Yapay Zeka Tarafından Çıkarılan Kuralları İncele
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
