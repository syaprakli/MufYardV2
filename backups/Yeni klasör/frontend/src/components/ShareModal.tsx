import { X, Search, UserPlus, CheckCircle2, Users, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAllProfiles } from "../lib/api/profiles";

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    sharedWith: string[];
    onShare: (newSharedWith: string[]) => void;
    title?: string;
}

export default function ShareModal({ isOpen, onClose, sharedWith, onShare, title = "Paylaşımı Yönet" }: ShareModalProps) {
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string[]>(sharedWith);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const loadUsers = async () => {
                setLoading(true);
                try {
                    const profiles = await fetchAllProfiles();
                    setUsers(profiles.map((p: any) => ({
                        id: p.uid || p.id,
                        name: p.full_name || p.display_name || p.email,
                        email: p.email
                    })));
                } catch (e) {
                    console.error("User fetch failed:", e);
                } finally {
                    setLoading(false);
                }
            };
            loadUsers();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const filtered = users.filter(i => 
        i.name?.toLowerCase().includes(search.toLowerCase()) || 
        i.id?.toLowerCase().includes(search.toLowerCase()) ||
        i.email?.toLowerCase().includes(search.toLowerCase())
    );

    const toggleUser = (id: string) => {
        setSelected(prev => 
            prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
        );
    };

    const handleSave = () => {
        onShare(selected);
        onClose();
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={headerStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={iconBoxStyle}><Users size={18} /></div>
                        <div>
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>{title}</h3>
                            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>Raporu incelemesi için bir veya daha fazla kişi seçin.</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
                </div>

                {/* Search */}
                <div style={{ position: "relative", marginBottom: "1.25rem" }}>
                    <Search style={searchIconStyle} size={16} />
                    <input 
                        placeholder="İsim veya e-posta ile ara..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={inputStyle}
                    />
                </div>

                {/* User List */}
                <div style={listContainerStyle}>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 opacity-40">
                            <Loader2 size={32} className="animate-spin mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest font-outfit">Sistem Rehberi Yükleniyor...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center p-10 text-slate-400 text-xs font-bold italic">
                            Kullanıcı bulunamadı.
                        </div>
                    ) : filtered.map(user => {
                        const isSelected = selected.includes(user.id);
                        return (
                            <div 
                                key={user.id} 
                                onClick={() => toggleUser(user.id)}
                                style={{
                                    ...userRowStyle,
                                    backgroundColor: isSelected ? "#f8fafc" : "transparent",
                                    border: isSelected ? "1px solid #0f172a15" : "1px solid transparent"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <div style={{
                                        width: "36px", height: "36px", borderRadius: "50%",
                                        background: isSelected ? "#0f172a" : "#f1f5f9",
                                        color: isSelected ? "white" : "#64748b",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "0.85rem", fontWeight: 700
                                    }}>
                                        {user.name.split(' ').map((n: string) => n[0]).join('')}
                                    </div>
                                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                                        <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</p>
                                        <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0, opacity: 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email || user.id}</p>
                                    </div>
                                </div>
                                {isSelected ? (
                                    <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                                ) : (
                                    <UserPlus size={18} style={{ color: "#cbd5e1" }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div style={footerStyle}>
                    <p style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        <b>{selected.length}</b> kişi seçildi
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={onClose} style={cancelBtnStyle}>Vazgeç</button>
                        <button onClick={handleSave} style={saveBtnStyle}>Değişiklikleri Kaydet</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Styles
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" };
const modalBoxStyle: React.CSSProperties = { background: "white", borderRadius: "1.25rem", boxShadow: "0 25px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: "450px", padding: "1.5rem", border: "1px solid #f1f5f9" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem" };
const iconBoxStyle: React.CSSProperties = { width: "36px", height: "36px", borderRadius: "0.75rem", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#0f172a" };
const closeBtnStyle: React.CSSProperties = { border: "none", background: "none", color: "#94a3b8", cursor: "pointer", padding: "0.25rem" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.75rem 1rem 0.75rem 2.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem", transition: "border-color 0.2s" };
const searchIconStyle: React.CSSProperties = { position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" };
const listContainerStyle: React.CSSProperties = { maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" };
const userRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", borderRadius: "0.75rem", cursor: "pointer", transition: "all 0.2s" };
const footerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" };
const cancelBtnStyle: React.CSSProperties = { padding: "0.6rem 1.25rem", borderRadius: "0.6rem", border: "1px solid #e2e8f0", background: "white", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" };
const saveBtnStyle: React.CSSProperties = { padding: "0.6rem 1.25rem", borderRadius: "0.6rem", border: "none", background: "#0f172a", color: "white", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 10px rgba(15,23,42,0.2)" };
