// ── post content markdown renderer ────────────────────────────────────────────
function renderPostContent(raw: string, resolveUrl: (url: string) => string) {
    if (!raw) return "";
    
    // Escape HTML first
    let safe = raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Bold / italic
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Markdown Images: ![alt](url)
    safe = safe.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, url) => {
        const fullUrl = resolveUrl(url);
        return `<div class="my-4 rounded-3xl overflow-hidden border border-border shadow-sm group/inline-img relative">
            <img src="${fullUrl}" alt="${alt}" class="w-full h-auto max-h-[500px] object-contain bg-muted/30 transition-transform hover:scale-[1.01] cursor-zoom-in" onclick="window.open('${fullUrl}', '_blank')"/>
            ${alt ? `<div class="absolute bottom-0 left-0 right-0 p-3 bg-black/40 backdrop-blur-sm text-white text-[10px] font-black tracking-widest opacity-0 group-hover/inline-img:opacity-100 transition-opacity">${alt.toUpperCase()}</div>` : ''}
        </div>`;
    });

    // Markdown Links: [text](url)
    safe = safe.replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
        const fullUrl = resolveUrl(url);
        return `<a href="${fullUrl}" target="_blank" class="text-primary font-black hover:underline decoration-2 underline-offset-4">${text}</a>`;
    });

    // Horizontal rule
    safe = safe.replace(/---/g, '<hr class="my-6 border-border/60"/>');
    
    // Process lines → paragraphs / lists
    const lines = safe.split('\n');
    let html = '';
    let ulOpen = false;
    let olOpen = false;
    
    for (const line of lines) {
        if (/^- /.test(line)) {
            if (olOpen) { html += '</ol>'; olOpen = false; }
            if (!ulOpen) { html += '<ul class="list-disc pl-6 my-4 space-y-2">'; ulOpen = true; }
            html += `<li class="font-medium text-slate-600">${line.slice(2)}</li>`;
        } else if (/^\d+\. /.test(line)) {
            if (ulOpen) { html += '</ul>'; ulOpen = false; }
            if (!olOpen) { html += '<ol class="list-decimal pl-6 my-4 space-y-2">'; olOpen = true; }
            html += `<li class="font-medium text-slate-600">${line.replace(/^\d+\. /, '')}</li>`;
        } else {
            if (ulOpen) { html += '</ul>'; ulOpen = false; }
            if (olOpen) { html += '</ol>'; olOpen = false; }
            
            if (line.trim() === '') {
                html += '<div class="h-2"></div>';
            } else {
                // Auto-link URLs that are not already in a tag
                let processedLine = line;
                if (!processedLine.includes('<a') && !processedLine.includes('<img')) {
                    processedLine = processedLine.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-primary hover:underline">$1</a>');
                }
                html += `<p class="mb-3 font-medium text-slate-600 leading-relaxed">${processedLine}</p>`;
            }
        }
    }
    
    if (ulOpen) html += '</ul>';
    if (olOpen) html += '</ol>';
    
    return html;
}

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { 
    User, MessageSquare, Search, Send,
    Loader2, Trash2,
    ChevronDown, ChevronUp,
    Plus, Eye, Edit3,
    ArrowLeft, Image as ImageIcon, Paperclip, 
    Shield, Bell, HelpCircle, Check, X, Lock as LockIcon,
    ChevronRight, ChevronLeft, FolderTree, Reply,
    Bold, Italic, List, ListOrdered, AlignJustify, Minus as HR,
    FileText, Download
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/hooks/useAuth";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { DraggableChatWidget } from "../components/layout/DraggableChatWidget";
import { usePresence } from "../lib/context/PresenceContext";
import { API_URL } from "../lib/config";
import { fetchWithTimeout } from "../lib/api/utils";
import toast from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { motion, AnimatePresence } from "framer-motion";

export interface Post {
    id: string;
    title: string;
    content: string;
    author_id: string;
    author_name: string;
    created_at: string;
    likes_count?: number;
    category?: string;
    shared_with?: string[];
    is_approved?: boolean;
    attachments?: Attachment[];
}

interface Comment {
    id: string;
    content: string;
    author_name: string;
    author_id?: string;
    author_role?: string;
    created_at: string;
    attachments?: Attachment[];
}

interface Attachment {
    url: string;
    type: 'image' | 'video' | 'audio' | 'file';
    name: string;
}

const FAQ_DATA = [
    {
        id: "static-1",
        title: "Yeni bir denetim raporu nasıl oluşturulur?",
        content: "Denetim sayfasındaki 'GÖREV EKLE' butonunu kullanarak yeni bir kayıt açabilir, ardından 'Rapor Düzenleyici' üzerinden GSB standartlarına uygun şablonlarla yazım sürecini başlatabilirsiniz.",
        author_name: "Sistem",
        created_at: new Date().toISOString()
    },
    {
        id: "static-2",
        title: "Seçmeli Paylaşım (Selective Sharing) nedir?",
        content: "Raporlarınızı veya konularınızı sadece belirli müfettişlerle paylaşmanıza olanak tanıyan güvenlik katmanıdır. Konu açarken müfettiş listesinden seçim yaparak sadece onların erişimine açabilirsiniz.",
        author_name: "Sistem",
        created_at: new Date().toISOString()
    },
    {
        id: "static-3",
        title: "Dijital Müfettiş (AI) hangi konularda yardımcı olur?",
        content: "AI Asistanı; mevzuat taraması, rapor taslağı oluşturma, yazım yanlışlarını düzeltme ve denetim bulgularını analiz etme konularında 7/24 destek sağlar.",
        author_name: "Sistem",
        created_at: new Date().toISOString()
    }
];

export default function PublicSpace() {
    const { user } = useAuth();

    const confirm = useConfirm();
    const { onlineUsers, messages: globalMessages, sendMessage: sendGlobalMessage } = usePresence();
    const [chatInput, setChatInput] = useState("");
    const [desktopChatOpen, setDesktopChatOpen] = useState(true);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const location = useLocation();
    const [posts, setPosts] = useState<Post[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'Forum' | 'SSS' | 'Duyurular'>(localStorage.getItem('forum_view') as any || 'Forum');
    const [userProfile, setUserProfile] = useState<any>(null);
    const [userRole, setUserRole] = useState('user');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("Hepsi");


    const [searchQuery, setSearchQuery] = useState("");
    const [newPost, setNewPost] = useState({ title: "", content: "", category: "Genel", attachments: [] as Attachment[] });
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    const [showPostCreator, setShowPostCreator] = useState(false);
    const [openFAQIndex, setOpenFAQIndex] = useState<number | null>(null);
    const [zoomedAttachment, setZoomedAttachment] = useState<Attachment | null>(null);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [fileUploading, setFileUploading] = useState(false);
    const [sharedWith, setSharedWith] = useState<string[]>([]);
    const [allInspectors, setAllInspectors] = useState<any[]>([]);
    const [commentAttachments, setCommentAttachments] = useState<Attachment[]>([]);
    const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editCommentText, setEditCommentText] = useState("");
    const [chatAttachments, setChatAttachments] = useState<Attachment[]>([]);

    // URL Resolution Helper
    const resolveAttachmentUrl = (url: string) => {
        if (!url) return '';
        const raw = String(url).trim();
        if (raw.startsWith('http') || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
        const baseUrl = API_URL.replace(/\/api\/?$/, '');
        return `${baseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
    };

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user?.uid) return;
            try {
                const [prof, cats, insps] = await Promise.all([
                    fetchWithTimeout(`${API_URL}/profiles/${user.uid}`).then(r => r.json()),
                    fetchWithTimeout(`${API_URL}/collaboration/categories`).then(r => r.json()),
                    fetchWithTimeout(`${API_URL}/profiles/`).then(r => r.json())
                ]);
                setUserProfile(prof);
                setUserRole(prof.role || 'user');
                setCategories(cats);
                setAllInspectors(insps.filter((i: any) => i.uid !== user?.uid));
            } finally {


            }
        };
        loadInitialData();
    }, [user]);

    useEffect(() => {
        const loadPosts = async () => {


            try {
                const url = new URL(`${API_URL}/collaboration/posts`);
                if (selectedCategory !== 'Hepsi') url.searchParams.append('category', selectedCategory);
                if (user?.uid) url.searchParams.append('user_id', user.uid);
                if (userRole === 'admin' || userRole === 'moderator') url.searchParams.append('is_admin', 'true');
                
                const postsRes = await fetchWithTimeout(url.toString());
                const postsData = await postsRes.json();
                
                setPosts(Array.isArray(postsData) ? postsData : []);
            } catch (err: any) {
                console.error("Data load error", err);
            } finally {


            }
        };

        if (user) loadPosts();
    }, [selectedCategory, user]);


    useEffect(() => {
        if (location.state && posts.length > 0) {
            const { category, postId } = location.state as any;
            if (category) {
                setViewMode(category as any);
                if (category !== 'Forum' && category !== 'SSS' && category !== 'Duyurular') {
                    setSelectedCategory(category);
                }
            }
            if (postId) {
                const post = posts.find(p => p.id === postId);
                if (post) handleSelectPost(post);
            }
            window.history.replaceState({}, document.title);
        }
    }, [location.state, posts]);


    const handleReplyMention = (userName: string) => {
        setNewComment(prev => `@${userName} ${prev}`);
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!selectedPost) return;
        const confirmed = await confirm({
            title: "Yorumu Sil",
            message: "Bu yorumu silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        try {
            await fetchWithTimeout(`${API_URL}/collaboration/posts/${selectedPost.id}/comments/${commentId}`, { method: 'DELETE' });
            setComments(prev => prev.filter(c => c.id !== commentId));
            toast.success("Yorum silindi.");
        } catch {
            toast.error("Yorum silinemedi.");
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !selectedPost || !user?.uid) return;
        setIsCommenting(true);
        try {
            const res = await fetchWithTimeout(`${API_URL}/collaboration/posts/${selectedPost.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: newComment,
                    author_id: user.uid,
                    author_name: userProfile?.full_name ? `${userProfile.full_name} (${userProfile.email})` : (user.displayName || user.email || "Müfettiş"),
                    author_role: userRole.toUpperCase(),
                    attachments: commentAttachments
                })
            });
            const created = await res.json();
            setComments(prev => [...prev, created]);
            setNewComment("");
            setCommentAttachments([]);
            toast.success("Cevabınız eklendi!");
        } catch {
            toast.error("Cevap gönderilemedi.");
        } finally {
            setIsCommenting(false);
        }
    };

    const handleUpdateComment = async (commentId: string) => {
        if (!editCommentText.trim() || !selectedPost) return;
        try {
            const res = await fetchWithTimeout(`${API_URL}/collaboration/posts/${selectedPost.id}/comments/${commentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editCommentText })
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: updated.content } : c));
            setEditingCommentId(null);
            setEditCommentText("");
            toast.success("Cevap güncellendi.");
        } catch {
            toast.error("Güncelleme başarısız.");
        }
    };

    const handleCreatePost = async () => {
        if (!newPost.title.trim() || !newPost.content.trim()) {
            toast.error("Başlık ve içerik alanları zorunludur.");
            return;
        }
        if (!user) return;
        setIsPosting(true);
        try {
            const isModerator = userRole === 'admin' || userRole === 'moderator';
            let url = editingPost 
                ? `${API_URL}/collaboration/posts/${editingPost.id}` 
                : `${API_URL}/collaboration/posts`;
            
            url += `?role=${encodeURIComponent(userRole)}`;

            const method = editingPost ? 'PATCH' : 'POST';
            const payload = editingPost ? {
                title: newPost.title,
                content: newPost.content,
                category: newPost.category
            } : {
                title: newPost.title,
                content: newPost.content,
                category: newPost.category || "Genel",
                author_id: user.uid,
                author_name: userProfile?.full_name ? `${userProfile.full_name} (${userProfile.email})` : (user.displayName || user.email || "Müfettiş"),
                author_role: userRole.toUpperCase(),
                is_public: sharedWith.length === 0,
                shared_with: sharedWith,
                attachments: newPost.attachments
            };
            const res = await fetchWithTimeout(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error();
            const result = await res.json();
            if (editingPost) {
                setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, ...result } : p));
                if (selectedPost?.id === editingPost.id) {
                    setSelectedPost({ ...selectedPost, ...result });
                }
                setEditingPost(null);
            } else {
                setPosts(prev => [result, ...prev]);
            }
            if (!editingPost && !isModerator && (sharedWith.length === 0)) {
                toast.success("Paylaşımınız onay bekliyor. Admin onayından sonra yayınlanacaktır.");
            } else {
                toast.success(editingPost ? "Güncellendi!" : "Paylaşıldı!");
            }
            setNewPost({ title: "", content: "", category: "Genel", attachments: [] });
            setSharedWith([]);
            setShowPostCreator(false);
        } catch {
            toast.error("Hata oluştu.");
        } finally {
            setIsPosting(false);
        }
    };

    const handleApprovePost = async (postId: string) => {
        try {
            const adminName = user?.displayName || user?.email || "Admin";
            const res = await fetchWithTimeout(`${API_URL}/collaboration/posts/${postId}/approve?admin_name=${encodeURIComponent(adminName)}`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error();
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_approved: true } : p));
            if (selectedPost?.id === postId) setSelectedPost(prev => prev ? { ...prev, is_approved: true } : null);
            toast.success("Onaylandı.");
        } catch {
            toast.error("İşlem başarısız.");
        }
    };

    const handleRejectPost = async (postId: string) => {
        const confirmed = await confirm({
            title: "Paylaşımı Reddet",
            message: "Bu paylaşımı reddetmek ve silmek istediğinize emin misiniz?",
            confirmText: "Reddet ve Sil",
            variant: "danger"
        });
        if (!confirmed) return;

        try {
            const res = await fetchWithTimeout(`${API_URL}/collaboration/posts/${postId}/reject`, {
                method: 'POST'
            });
            if (!res.ok) throw new Error();
            setPosts(prev => prev.filter(p => p.id !== postId));
            if (selectedPost?.id === postId) setSelectedPost(null);
            toast.success("Reddedildi ve silindi.");
        } catch {
            toast.error("İşlem başarısız.");
        }
    };

    const handleDeletePost = async (postId: string) => {
        const confirmed = await confirm({
            title: "Paylaşımı Sil",
            message: "Bu paylaşımı ve tüm yorumlarını silmek istediğinize emin misiniz?",
            confirmText: "Kalıcı Olarak Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        try {
            await fetchWithTimeout(`${API_URL}/collaboration/posts/${postId}?uid=${user?.uid}&role=${userRole}`, { method: 'DELETE' });
            setPosts(prev => prev.filter(p => p.id !== postId));
            toast.success("Silindi");
        } catch {
            toast.error("Hata oluştu");
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        setIsAddingCategory(true);
        try {
            await fetchWithTimeout(`${API_URL}/collaboration/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCategoryName })
            });
            setCategories(prev => [...prev, newCategoryName]);
            setNewCategoryName("");
            setShowCategoryDropdown(false);
            toast.success("Kategori eklendi.");
        } catch {
            toast.error("Hata oluştu.");
        } finally {
            setIsAddingCategory(false);
        }
    };

    const handleSelectPost = async (post: Post) => {
        setSelectedPost(post);
        setComments([]);
        try {
            const res = await fetchWithTimeout(`${API_URL}/collaboration/posts/${post.id}/comments`);
            const data = await res.json();
            setComments(data);
        } catch (err) {}
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isComment = false) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetchWithTimeout(`${API_URL}/files/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            
            // Backend'den gelen URL'yi direkt kullanabiliriz, resolveAttachmentUrl render sırasında halledecek
            if (isComment) setCommentAttachments(p => [...p, data]);
            else setNewPost(p => ({ ...p, attachments: [...p.attachments, data] }));
            toast.success("Dosya yüklendi!");
        } catch {
            toast.error("Dosya yüklenirken hata oluştu.");
        } finally {
            setFileUploading(false);
        }
    };

    const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetchWithTimeout(`${API_URL}/files/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            setChatAttachments(p => [...p, data]);
            toast.success("Dosya hazır");
        } catch {
            toast.error("Dosya yüklenemedi");
        } finally {
            setFileUploading(false);
        }
    };

    const handleSendChat = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if ((!chatInput.trim() && chatAttachments.length === 0) || !user) return;
        sendGlobalMessage(chatInput, chatAttachments);
        setChatInput("");
        setChatAttachments([]);
    };

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [globalMessages]);

    // Removed full-screen loading screen to allow instant shell rendering


    return (
        <div className="flex h-full w-full bg-card relative font-outfit overflow-hidden flex-col md:flex-row">
            {/* Mobile only: floating bubble chat */}
            <div className="md:hidden">
                <DraggableChatWidget />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/30 min-w-0">
                <div className="px-4 md:px-8 pt-6 md:pt-10 pb-4 bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-30 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 capitalize tracking-[0.3em]">
                                <Shield size={10} className="text-primary/60" />
                                <button onClick={() => { setSelectedPost(null); setViewMode('Forum'); }} className="hover:text-primary transition-all">Platform</button>
                                <ChevronRight size={10} />
                                <span className="text-primary opacity-80">{viewMode === 'SSS' ? 'Bilgi Bankası' : 'Kamusal Alan'}</span>
                            </div>
                            <h1 className="text-2xl font-black text-foreground tracking-tight">
                                {selectedPost ? "Konu Detayı" : viewMode === 'SSS' ? "Yardım Rehberi" : "Müzakere Forumu"}
                            </h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
                            {(!selectedPost && (viewMode === 'Forum' || userRole === 'admin' || userRole === 'moderator')) && (
                                <Button 
                                    onClick={() => {
                                        setEditingPost(null);
                                        let initialCategory = "Genel";
                                        if (viewMode === 'SSS') initialCategory = "SSS";
                                        if (viewMode === 'Duyurular') initialCategory = "Duyurular";
                                        setNewPost({ title: "", content: "", category: initialCategory, attachments: [] });
                                        setShowPostCreator(true);
                                    }}
                                    className="flex-1 md:flex-none bg-primary text-white rounded-2xl px-4 md:px-6 h-11 font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-[10px] capitalize tracking-widest hover:scale-105 transition-all"
                                >
                                    <Plus size={18} />
                                    <span className="sm:hidden">Ekle</span>
                                    <span className="hidden sm:inline">{viewMode === 'SSS' ? 'Soru Ekle' : viewMode === 'Duyurular' ? 'Yeni Duyuru' : 'Yeni Konu'}</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar pb-1">
                        <button 
                            onClick={() => { setViewMode('Forum'); setSelectedPost(null); setSelectedCategory("Hepsi"); }}
                            className={cn("pb-3 text-xs font-black tracking-widest transition-all relative", viewMode === 'Forum' ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                        >
                            Forum <span className="ml-1 px-1.5 py-0.5 bg-muted/80 text-[10px] rounded-md text-muted-foreground">{posts.filter(p => p.category !== 'Duyurular' && p.category !== 'SSS').length}</span>
                            {viewMode === 'Forum' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                        <button 
                            onClick={() => { setViewMode('SSS'); setSelectedPost(null); setSelectedCategory("Hepsi"); }}
                            className={cn("pb-3 text-xs font-black tracking-widest transition-all relative", viewMode === 'SSS' ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                        >
                            Bilgi Bankası
                            {viewMode === 'SSS' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                        <button 
                            onClick={() => { setViewMode('Duyurular'); setSelectedPost(null); setSelectedCategory("Hepsi"); }}
                            className={cn("pb-3 text-xs font-black tracking-widest transition-all relative whitespace-nowrap", viewMode === 'Duyurular' ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                        >
                            Duyurular
                            {viewMode === 'Duyurular' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 no-scrollbar relative">
                    <AnimatePresence mode="wait">
                        {selectedPost ? (
                            <motion.div key="post-thread" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <ThreadView 
                                    post={selectedPost} 
                                    comments={comments}
                                    onBack={() => { setViewMode('Forum'); setSelectedPost(null); }}
                                    onComment={handleAddComment}
                                    commentText={newComment}
                                    setCommentText={setNewComment}
                                    isCommenting={isCommenting}
                                    user={user}
                                    onReply={handleReplyMention}
                                    onDeleteComment={handleDeleteComment}
                                    onUpdateComment={handleUpdateComment}
                                    editingCommentId={editingCommentId}
                                    setEditingCommentId={setEditingCommentId}
                                    editCommentText={editCommentText}
                                    setEditCommentText={setEditCommentText}
                                    onEditPost={(p: Post) => {
                                        setEditingPost(p);
                                        setNewPost({ title: p.title, content: p.content, category: p.category || "Genel", attachments: p.attachments || [] });
                                        setShowPostCreator(true);
                                    }}
                                    onDeletePost={async (id: string) => {
                                        await handleDeletePost(id);
                                        setSelectedPost(null);
                                    }}
                                    onAttach={() => document.getElementById('comment-file-input')?.click()}
                                    onFileUpload={handleFileUpload}
                                    attachments={commentAttachments}
                                    setAttachments={setCommentAttachments}
                                    onZoom={setZoomedAttachment}
                                    isStatic={false}
                                />
                            </motion.div>
                        ) : (
                            <motion.div key="content-router" className="w-full h-full">
                                {viewMode === 'SSS' ? (
                                    <motion.div key="sss" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-4">
                                        {[...FAQ_DATA, ...posts.filter(p => p.category?.toLowerCase() === 'sss')].map((faq, idx) => (
                                            <FAQCard 
                                                key={faq.id} 
                                                faq={faq} 
                                                isOpen={openFAQIndex === idx} 
                                                onToggle={() => setOpenFAQIndex(openFAQIndex === idx ? null : idx)}
                                                isAdmin={userRole === 'admin' || userRole === 'moderator'}
                                                onApprove={() => handleApprovePost(faq.id)}
                                                onReject={() => handleRejectPost(faq.id)}
                                            />
                                        ))}
                                    </motion.div>
                                ) : viewMode === 'Duyurular' ? (
                                    <motion.div key="duyurular" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-4">
                                            {posts.filter(p => p.category?.toLowerCase() === 'duyurular').map(post => (
                                                <TopicRow 
                                                    key={post.id} 
                                                    post={post} 
                                                    onClick={() => handleSelectPost(post)} 
                                                    onDelete={() => handleDeletePost(post.id)}
                                                    onEdit={() => {
                                                        setEditingPost(post);
                                                        setNewPost({ title: post.title, content: post.content, category: post.category || "Duyurular", attachments: post.attachments || [] });
                                                        setShowPostCreator(true);
                                                    }}
                                                    onApprove={() => handleApprovePost(post.id)}
                                                    onReject={() => handleRejectPost(post.id)}
                                                    isAdmin={userRole === 'admin' || userRole === 'moderator'}
                                                    canDelete={userRole === 'admin' || userRole === 'moderator' || post.author_id === user?.uid}
                                                    canEdit={userRole === 'admin' || userRole === 'moderator' || post.author_id === user?.uid}
                                                />
                                            ))}
                                    </motion.div>
                                ) : (
                                    <motion.div key="forum" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                                            <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar pb-1">
                                                <div className="relative shrink-0" ref={categoryDropdownRef}>
                                                    <button 
                                                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                                        className="h-12 px-4 md:px-6 bg-card border border-border rounded-2xl flex items-center gap-3 text-xs font-black text-muted-foreground shadow-sm hover:border-primary/20 transition-all"
                                                    >
                                                        <FolderTree size={16} className="text-primary" />
                                                        <span className="hidden sm:inline">{selectedCategory.toUpperCase()}</span>
                                                        <ChevronDown size={14} className={cn("transition-transform duration-200", showCategoryDropdown && "rotate-180")} />
                                                    </button>
                                                    
                                                    {showCategoryDropdown && (
                                                        <div className="absolute top-14 left-0 w-64 bg-card border border-border rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                                            <div className="p-2 border-b border-slate-50 mb-1">
                                                                <div className="flex bg-muted p-1.5 rounded-2xl border border-border shadow-inner group">
                                                                    <input 
                                                                        placeholder="Kategori ara..."
                                                                        className="w-full p-2 bg-transparent rounded-xl text-[10px] font-bold outline-none"
                                                                        value={newCategoryName}
                                                                        onChange={e => setNewCategoryName(e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="max-h-60 overflow-y-auto no-scrollbar">
                                                                <button 
                                                                    onClick={() => { setSelectedCategory('Hepsi'); setShowCategoryDropdown(false); }}
                                                                    className={cn("w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-colors", selectedCategory === 'Hepsi' ? "bg-primary/5 text-primary" : "hover:bg-muted text-slate-600")}
                                                                >
                                                                    Tüm Konular
                                                                </button>
                                                                {Array.isArray(categories) && categories.filter(c => {
                                                                    const lcat = c?.toLowerCase();
                                                                    return lcat !== 'sss' && lcat !== 'duyurular' && c !== 'Hepsi';
                                                                }).map(cat => (
                                                                    <button 
                                                                        key={cat}
                                                                        onClick={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
                                                                        className={cn("w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-colors", selectedCategory === cat ? "bg-primary/5 text-primary" : "hover:bg-muted text-slate-600")}
                                                                    >
                                                                        {cat.toUpperCase()}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="p-2 border-t border-slate-50 mt-1">
                                                                {isAddingCategory ? (
                                                                    <div className="flex gap-2">
                                                                        <input 
                                                                            className="flex-1 bg-muted p-2 rounded-xl text-[10px] font-bold outline-none border border-border"
                                                                            placeholder="Kategori Adı..."
                                                                            value={newCategoryName}
                                                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                                                        />
                                                                        <button onClick={handleAddCategory} className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Plus size={14} /></button>
                                                                        <button onClick={() => setIsAddingCategory(false)} className="p-2 bg-muted/80 text-slate-400 rounded-xl"><X size={14} /></button>
                                                                    </div>
                                                                ) : (
                                                                    <button 
                                                                        onClick={() => setIsAddingCategory(true)}
                                                                        className="w-full mt-2 py-3 border-2 border-dashed border-border rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-primary hover:text-primary transition-all group"
                                                                    >
                                                                        <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                                                                        <span className="text-[10px] font-black capitalize tracking-widest">Yeni Kategori Ekle</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex p-1 bg-card border border-border rounded-2xl shadow-sm shrink-0">
                                                    <button 
                                                        onClick={() => setSortBy('newest')}
                                                        className={cn("px-4 py-2 text-[10px] font-black rounded-xl transition-all", sortBy === 'newest' ? "bg-muted text-primary shadow-inner" : "text-slate-400 hover:text-slate-600")}
                                                    >
                                                        En Yeni
                                                    </button>
                                                    <button 
                                                        onClick={() => setSortBy('popular')}
                                                        className={cn("px-4 py-2 text-[10px] font-black rounded-xl transition-all", sortBy === 'popular' ? "bg-muted text-primary shadow-inner" : "text-slate-400 hover:text-slate-600")}
                                                    >
                                                        Popüler
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="relative w-full sm:w-64 md:w-72">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input 
                                                    placeholder="Ara..." 
                                                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                                    className="w-full pl-10 pr-4 h-12 bg-card border border-border rounded-2xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {posts
                                                .filter(p => {
                                                    const cat = p.category?.toLowerCase();
                                                    return cat !== 'sss' && (selectedCategory === 'Hepsi' || p.category === selectedCategory);
                                                })
                                                .sort((a, b) => {
                                                    if (sortBy === 'popular') return (b.likes_count || 0) - (a.likes_count || 0);
                                                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                                                })
                                                .map(post => (
                                                    <TopicRow 
                                                        key={post.id} 
                                                        post={post} 
                                                        onClick={() => handleSelectPost(post)} 
                                                        onDelete={() => handleDeletePost(post.id)}
                                                        onEdit={() => {
                                                            setEditingPost(post);
                                                            setNewPost({ title: post.title, content: post.content, category: post.category || "Genel", attachments: post.attachments || [] });
                                                            setShowPostCreator(true);
                                                        }}
                                                        onApprove={() => handleApprovePost(post.id)}
                                                        onReject={() => handleRejectPost(post.id)}
                                                        isAdmin={userRole === 'admin' || userRole === 'moderator'}
                                                        canDelete={userRole === 'admin' || userRole === 'moderator' || post.author_id === user?.uid}
                                                        canEdit={userRole === 'admin' || userRole === 'moderator' || post.author_id === user?.uid}
                                                    />
                                                ))}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {showPostCreator && (
                        <PostCreator 
                            onClose={() => { setShowPostCreator(false); setEditingPost(null); }} 
                            onSubmit={handleCreatePost}
                            post={newPost}
                            setPost={setNewPost}
                            categories={categories}
                            isPosting={isPosting}
                            isEdit={!!editingPost}
                            inspectors={allInspectors}
                            sharedWith={sharedWith}
                            onSharedWithChange={setSharedWith}
                            onUpload={handleFileUpload}
                            uploading={fileUploading}
                            isAdmin={userRole === 'admin' || userRole === 'moderator'}
                            resolveUrl={resolveAttachmentUrl}
                        />
                )}
                {zoomedAttachment && <GalleryOverlay attachment={zoomedAttachment} onClose={() => setZoomedAttachment(null)} />}
            </AnimatePresence>

            {/* Desktop only: pinned right live chat panel with sliding animation */}
            <motion.div 
                initial={false}
                animate={{ width: desktopChatOpen ? 384 : 0 }}
                className="hidden md:flex flex-col shrink-0 border-l border-slate-200 bg-white relative"
            >
                {/* Floating Toggle Button */}
                <button 
                    onClick={() => setDesktopChatOpen(!desktopChatOpen)}
                    className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-20 bg-[#002B4B] text-white flex items-center justify-center rounded-l-2xl shadow-2xl z-50 border-r border-white/10 hover:w-10 transition-all group"
                    title={desktopChatOpen ? 'Sohbeti Gizle' : 'Canlı Müzakereyi Göster'}
                >
                    <div className="flex flex-col items-center gap-2">
                        {desktopChatOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </div>
                </button>

                <div className={cn("w-[384px] h-full flex flex-col transition-opacity duration-300", !desktopChatOpen && "opacity-0 invisible")}>
                    <div className="p-6 border-b border-white/10 bg-[#002B4B] text-white">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black capitalize tracking-widest flex items-center gap-2">
                                <MessageSquare size={16} className="text-blue-400" /> Canlı Müzakere
                            </h3>
                            {/* Compact Online Indicator */}
                            {onlineUsers.length > 0 && (
                                <div className="group relative">
                                    <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition-all cursor-help">
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                        <span className="text-[10px] font-black">{onlineUsers.length}</span>
                                    </div>
                                    
                                    {/* Hover Avatars Tooltip */}
                                    <div className="absolute top-full right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] translate-y-2 group-hover:translate-y-0">
                                        <div className="bg-white p-3 rounded-[20px] shadow-2xl border border-slate-100 min-w-[180px]">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-2 border-b border-slate-50 pb-2">Aktif Müfettişler</p>
                                            <div className="space-y-1 max-h-60 overflow-y-auto no-scrollbar">
                                                {onlineUsers.map((u: any) => (
                                                    <div key={u.uid} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                                        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-[10px] font-black text-white capitalize shadow-sm shrink-0">
                                                            {u.name ? u.name.charAt(0) : '?'}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[11px] font-black text-slate-700 truncate">{u.name}</span>
                                                            <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">Çevrimiçi</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-white">
                        {globalMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-16">
                                <MessageSquare size={36} className="opacity-20" />
                                <p className="text-xs font-bold">Müzakereye ilk mesajı siz yazın.</p>
                            </div>
                        ) : (
                            globalMessages.map((msg, idx) => {
                                const isMine = msg.author_id === user?.uid;
                                return (
                                    <div key={msg.id || idx} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
                                        <div className={cn("max-w-[85%] p-4 rounded-3xl text-[13px] font-medium shadow-sm space-y-2", isMine ? "bg-primary text-white rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none")}>
                                            {msg.text && <div>{msg.text}</div>}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {msg.attachments.map((at, i) => {
                                                        const resolvedUrl = resolveAttachmentUrl(at.url);
                                                        return (
                                                        <div 
                                                            key={i} 
                                                            className={cn(
                                                                "relative rounded-xl overflow-hidden border",
                                                                at.type === 'image' ? "w-32 h-32 cursor-pointer" : "p-3 bg-white/10 backdrop-blur-sm border-white/20 min-w-[120px]"
                                                            )}
                                                            onClick={() => at.type === 'image' && setZoomedAttachment({ ...at, url: resolvedUrl })}
                                                        >
                                                            {at.type === 'image' ? (
                                                                <img src={resolvedUrl} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <a 
                                                                    href={resolvedUrl} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <div className={cn("p-1.5 rounded-lg", isMine ? "bg-white/20" : "bg-slate-200")}>
                                                                        <Paperclip size={14} className={isMine ? "text-white" : "text-slate-500"} />
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className={cn("text-[9px] font-black truncate", isMine ? "text-white" : "text-slate-700")}>{at.name || "Dosya"}</span>
                                                                        <span className={cn("text-[7px] font-bold uppercase tracking-tighter opacity-60", isMine ? "text-white" : "text-slate-500")}>Görüntüle</span>
                                                                    </div>
                                                                </a>
                                                            )}
                                                        </div>
                                                    );})}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 mt-1 px-2">{msg.author_name} • {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendChat} className="p-6 border-t border-slate-100 bg-white flex flex-col gap-3 relative">
                        {chatAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200 overflow-x-auto no-scrollbar">
                                {chatAttachments.map((at, i) => (
                                    <div key={i} className="relative group/chatat w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
                                        {at.type === 'image' ? <img src={resolveAttachmentUrl(at.url)} className="w-full h-full object-cover" /> : <Paperclip size={18} className="text-slate-300" />}
                                        <button 
                                            type="button" 
                                            onClick={() => setChatAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-0.5 shadow-lg z-10"
                                        >
                                            <X size={8} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <input 
                                id="chat-file-input" 
                                type="file" 
                                hidden 
                                onChange={handleChatFileUpload} 
                            />
                            <div className="flex-1 relative flex items-center gap-2">
                                <button 
                                    type="button"
                                    disabled={fileUploading}
                                    onClick={() => document.getElementById('chat-file-input')?.click()}
                                    className="p-3 text-slate-400 hover:text-primary transition-all shrink-0"
                                >
                                    {fileUploading ? <Loader2 className="animate-spin" size={20} /> : <Paperclip size={20} />}
                                </button>
                                <input 
                                    value={chatInput} 
                                    onChange={e => setChatInput(e.target.value)}
                                    placeholder="Mesajınızı yazın..." 
                                    className="flex-1 bg-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none border-2 border-transparent focus:border-primary/20 transition-all"
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={!chatInput.trim() && chatAttachments.length === 0}
                                className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}

function TopicRow({ post, onClick, onDelete, onEdit, onApprove, onReject, canDelete, canEdit, isAdmin }: any) {
    return (
        <div onClick={onClick} className="group p-4 md:p-5 bg-card border border-border/60 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 relative overflow-hidden">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-muted rounded-2xl flex items-center justify-center text-primary/40 group-hover:bg-primary/5 group-hover:text-primary transition-all shrink-0 mx-auto sm:mx-0">
                <MessageSquare size={24} />
            </div>
            <div className="flex-1 space-y-1 text-center sm:text-left min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1 sm:mb-0">
                    <span className="inline-block self-center sm:self-start px-2.5 py-1 bg-muted/80 text-muted-foreground rounded-lg text-[9px] font-black capitalize tracking-widest w-fit">{post.category}</span>
                    {post.is_approved === false && (
                        <span className="inline-block self-center sm:self-start px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest w-fit animate-pulse">Onay Bekliyor</span>
                    )}
                    <h3 className="font-black text-foreground text-sm md:text-[13px] group-hover:text-primary transition-colors leading-tight truncate">{post.title}</h3>
                </div>
                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400">
                    <span className="flex items-center gap-1"><User size={10} /> {post.author_name}</span>
                    <span className="flex items-center gap-1"><Bell size={10} /> {new Date(post.created_at).toLocaleDateString()}</span>
                    {post.shared_with && post.shared_with.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-500"><LockIcon size={10} /> Gizli</span>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 md:gap-4 px-0 sm:px-4 sm:border-l border-slate-100 dark:border-slate-800 pt-3 sm:pt-0 border-t sm:border-t-0">
                <div className="text-center sm:mr-2 flex sm:flex-col items-center gap-2 sm:gap-0">
                    <p className="text-xs font-black text-muted-foreground">{post.likes_count || 0}</p>
                    <p className="text-[9px] font-bold text-slate-400 capitalize tracking-widest">Beğeni</p>
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    {isAdmin && post.is_approved === false && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onApprove(); }} className="p-2.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl transition-all" title="Onayla">
                                <Check size={18} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onReject(); }} className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all" title="Reddet">
                                <X size={18} />
                            </button>
                        </>
                    )}
                    {canEdit && (
                        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-xl transition-all">
                            <Edit3 size={18} />
                        </button>
                    )}
                    {canDelete && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all">
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function FAQCard({ faq, isOpen, onToggle, onApprove, onReject, isAdmin }: any) {
    return (
        <Card className="overflow-hidden border-border rounded-3xl group shadow-sm hover:shadow-md transition-all">
            <button onClick={onToggle} className="w-full flex items-center justify-between p-6 text-left hover:bg-muted transition-colors">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center">
                        <HelpCircle size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-foreground text-sm tracking-tight">{faq.title}</span>
                        {faq.is_approved === false && (
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">Onay Bekliyor</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && faq.is_approved === false && (
                        <div className="flex items-center gap-1 mr-4">
                            <button onClick={(e) => { e.stopPropagation(); onApprove(); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg"><Check size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); onReject(); }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><X size={16} /></button>
                        </div>
                    )}
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div key="faq-content" initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="p-6 pt-0 text-sm text-muted-foreground font-medium leading-relaxed border-t border-slate-50 bg-muted/30">
                            {faq.content}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}

function PostCreator({ onClose, onSubmit, post, setPost, categories, isPosting, isEdit, onUpload, uploading, resolveUrl }: any) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isForum = post.category !== 'Duyurular' && post.category !== 'SSS';

    const insertFormat = (before: string, after: string = '', newline = false) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = post.content.slice(start, end);
        const prefix = newline ? (start > 0 ? '\n' : '') : '';
        const newContent = post.content.slice(0, start) + prefix + before + selected + after + post.content.slice(end);
        setPost({ ...post, content: newContent });
        setTimeout(() => {
            ta.focus();
            const cur = start + prefix.length + before.length;
            ta.setSelectionRange(cur, cur + selected.length);
        }, 0);
    };

    let headerTitle = "Yeni İçerik Oluştur";
    let headerDesc = "Fikrini Müzakereye Aç";
    let titleLabel = "Başlık";
    let titlePlaceholder = "Konu başlığı nedir?";
    let contentLabel = "İçerik";
    let contentPlaceholder = "Meslektaşlarınla paylaşmak istediğin detaylar...";

    if (isEdit) {
        headerTitle = "İçeriği Güncelle";
        headerDesc = "Daha İyi Bir Anlatım";
    }

    if (post.category === "Duyurular") {
        headerTitle = isEdit ? "Duyuruyu Düzenle" : "Yeni Duyuru Yayınla";
        headerDesc = "Kurumsal bir bildiri veya önemli bir gelişme paylaşın";
        titleLabel = "Duyuru Başlığı";
        titlePlaceholder = "Duyurunun ana başlığı nedir?";
        contentLabel = "Duyuru Metni";
        contentPlaceholder = "Duyurunun tüm detaylarını burada paylaşın...";
    } else if (post.category === "SSS") {
        headerTitle = isEdit ? "Soruyu Düzenle" : "Yeni Soru ve Rehber Ekle";
        headerDesc = "Sık sorulan bir soruya veya bir sorun çözümüne dair bilgi girin";
        titleLabel = "Soru / Başlık";
        titlePlaceholder = "Sorulan soru veya rehber konusu nedir?";
        contentLabel = "Çözüm / Detaylar";
        contentPlaceholder = "Çözüm yollarını veya rehber içeriğini açıklayın...";
    }

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center sm:p-6" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <motion.div key="post-creator-modal" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-t-[32px] sm:rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                <div className="p-5 md:p-8 border-b border-border flex items-center justify-between bg-card relative">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black capitalize text-primary tracking-[0.3em]">{headerTitle}</p>
                        <h2 className="text-2xl font-black text-foreground tracking-tighter">{headerDesc}</h2>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-muted/80 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                        <X size={20} />
                    </button>
                </div>
                <input id="post-file-input" type="file" hidden onChange={onUpload} />
                <div className="p-5 md:p-8 overflow-y-auto space-y-5 md:space-y-6">
                            {isForum && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black capitalize text-slate-400 tracking-widest ml-1">Kategori</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.isArray(categories) && categories.map((c: string) => {
                                            if (c === 'Duyurular' || c === 'SSS') return null;
                                            return (
                                                <button 
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setPost({ ...post, category: c })}
                                                    className={cn("px-4 py-2 rounded-xl text-[10px] font-bold capitalize tracking-wider transition-all", post.category === c ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                                                >
                                                    {c}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black capitalize text-slate-400 tracking-widest ml-1">{titleLabel}</label>
                                <input value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} placeholder={titlePlaceholder} className="w-full p-5 bg-muted rounded-3xl border-2 border-transparent focus:border-primary/10 focus:bg-card outline-none font-bold text-sm transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black capitalize text-slate-400 tracking-widest ml-1">{contentLabel}</label>
                                <div className="bg-muted rounded-3xl border-2 border-transparent focus-within:border-primary/10 focus-within:bg-card overflow-hidden transition-all">
                                    {/* Formatting Toolbar */}
                                    <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border/50 flex-wrap">
                                        <button type="button" onMouseDown={(e)=>{e.preventDefault(); insertFormat('**','**');}} title="Kalın" className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-all"><Bold size={14}/></button>
                                        <button type="button" onMouseDown={(e)=>{e.preventDefault(); insertFormat('*','*');}} title="İtalik" className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-all"><Italic size={14}/></button>
                                        <div className="w-px h-4 bg-border mx-1"/>
                                        <button type="button" onMouseDown={(e)=>{e.preventDefault(); insertFormat('- ','',true);}} title="Madde İşareti" className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-all"><List size={14}/></button>
                                        <button type="button" onMouseDown={(e)=>{e.preventDefault(); insertFormat('1. ','',true);}} title="Numaralı Liste" className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-all"><ListOrdered size={14}/></button>
                                        <div className="w-px h-4 bg-border mx-1"/>
                                        <button type="button" onMouseDown={(e)=>{e.preventDefault(); insertFormat('\n\n');}} title="Paragraf Boşluğu" className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-all"><AlignJustify size={14}/></button>
                                        <button type="button" onMouseDown={(e)=>{e.preventDefault(); insertFormat('\n---\n');}} title="Yatay Çizgi" className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-all"><HR size={14}/></button>
                                        <span className="ml-auto text-[9px] text-slate-400 font-bold">**kalın** *italik* - liste</span>
                                    </div>
                                    <textarea
                                        ref={textareaRef}
                                        value={post.content}
                                        onChange={(e) => setPost({ ...post, content: e.target.value })}
                                        placeholder={contentPlaceholder}
                                        className="w-full p-5 bg-transparent outline-none font-medium text-sm min-h-[160px] resize-y"
                                    />
                                </div>
                            </div>
                    {post.attachments && post.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-2xl border border-dashed border-border mt-4 overflow-x-auto no-scrollbar">
                            {post.attachments.map((at: any, i: number) => (
                                <div key={i} className="relative group/at w-20 h-20 rounded-xl overflow-hidden border border-border bg-card shadow-sm flex items-center justify-center shrink-0">
                                    {at.type === 'image' ? (
                                        <img src={resolveUrl(at.url)} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full bg-muted/30 p-2">
                                            <FileText size={24} className="text-slate-400" />
                                            <span className="text-[8px] font-bold text-muted-foreground mt-1 truncate w-full text-center" title={at.name}>{at.name || "Dosya"}</span>
                                        </div>
                                    )}
                                    <button type="button" onClick={() => setPost((p: any) => ({ ...p, attachments: p.attachments.filter((_: any, idx: number) => idx !== i) }))} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover/at:opacity-100 transition-all shadow-lg z-10"><X size={8} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 md:p-8 bg-muted border-t border-border flex items-center justify-between">
                    <div className="flex gap-2">
                        <button type="button" disabled={uploading} onClick={() => document.getElementById('post-file-input')?.click()} className="p-4 bg-card rounded-2xl text-slate-400 hover:text-primary transition-all border border-border flex items-center justify-center relative">
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                        </button>
                        <button type="button" disabled={uploading} onClick={() => document.getElementById('post-file-input')?.click()} className="p-4 bg-card rounded-2xl text-slate-400 hover:text-primary transition-all border border-border flex items-center justify-center">
                            <Paperclip size={20} />
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <Button type="button" disabled={isPosting} onClick={onSubmit} className="rounded-2xl px-12 h-11 font-bold text-[11px] capitalize tracking-wider shadow-xl shadow-primary/20 bg-primary">
                            {isPosting ? <Loader2 className="animate-spin" /> : (isEdit ? "Kaydet" : "Paylaş")}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    , document.body);
}

function ThreadView({ post, comments, onBack, onComment, commentText, setCommentText, isCommenting, user, onReply, onDeleteComment, onUpdateComment, editingCommentId, setEditingCommentId, editCommentText, setEditCommentText, onEditPost, onDeletePost, onAttach, onFileUpload, attachments, setAttachments, onZoom, isStatic, resolveUrl }: any) {
    return (
        <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-500">
            <input id="comment-file-input" type="file" hidden onChange={(e) => onFileUpload(e, true)} />
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-primary transition-all text-xs">
                    <ArrowLeft size={16} /> Geri Dön
                </button>
                <div className="px-3 py-1 bg-primary/5 text-primary rounded-lg text-[9px] font-black capitalize tracking-widest">{post.category}</div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-8 no-scrollbar pb-32">
                <div className="bg-card border border-border/60 p-8 rounded-[32px] shadow-sm space-y-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-muted/80 rounded-2xl flex items-center justify-center font-black text-slate-400 text-base md:text-lg shrink-0">
                                {post.author_name?.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-black text-foreground text-base md:text-lg tracking-tight truncate">{post.author_name}</h2>
                                <p className="text-[10px] font-bold text-slate-400 capitalize tracking-widest">{new Date(post.created_at).toLocaleString('tr-TR')}</p>
                            </div>
                        </div>
                        {user?.uid === post.author_id && (
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => onEditPost(post)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl transition-all hover:bg-blue-100" title="Düzenle">
                                    <Edit3 size={15} />
                                </button>
                                <button onClick={() => onDeletePost(post.id)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl transition-all hover:bg-rose-100" title="Sil">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-xl font-black text-foreground leading-tight tracking-tight">{post.title}</h1>
                        <div
                            className="text-slate-600 font-medium leading-relaxed text-sm [&_strong]:font-black [&_strong]:text-foreground [&_em]:italic [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-2"
                            dangerouslySetInnerHTML={{ __html: renderPostContent(post.content, resolveUrl) }}
                        />
                    </div>
                    {post.attachments && post.attachments.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                            {post.attachments.map((at: any, i: number) => {
                                const resolvedUrl = resolveUrl(at.url);
                                return (
                                <div 
                                    key={i} 
                                    onClick={() => {
                                        if (at.type === 'image') onZoom({ ...at, url: resolvedUrl });
                                        else window.open(resolvedUrl, '_blank');
                                    }} 
                                    className="group/img relative aspect-square rounded-3xl overflow-hidden bg-muted/80 border border-border cursor-pointer flex items-center justify-center"
                                >
                                    {at.type === 'image' ? (
                                        <>
                                            <img src={resolvedUrl} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center"><Eye className="text-white" size={32} /></div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 p-4 justify-center w-full h-full group-hover/img:bg-primary/5 transition-all relative">
                                            <FileText size={40} className="text-slate-400 group-hover/img:text-primary transition-all" />
                                            <span className="text-[10px] font-black text-muted-foreground group-hover/img:text-primary text-center break-all line-clamp-2 leading-tight px-2">{at.name || "Dosya Eki"}</span>
                                            <div className="absolute inset-0 bg-primary/80 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center gap-2">
                                                <Download className="text-white" size={24} />
                                                <span className="text-white text-[9px] font-black tracking-widest">İNDİR</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );})}
                        </div>
                    )}
                </div>
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-muted/80"></div>
                        <span className="text-[10px] font-black text-slate-400 capitalize tracking-[0.2em]">Cevaplar ({comments.length})</span>
                        <div className="h-px flex-1 bg-muted/80"></div>
                    </div>
                    {!isStatic ? comments.map((comment: any) => (
                        <div key={comment.id} className="flex gap-4 group/reply">
                            <div className="w-10 h-10 bg-muted rounded-xl flex shrink-0 items-center justify-center font-black text-slate-300 text-sm">
                                {comment.author_name?.charAt(0)}
                            </div>
                            <div className="flex-1 space-y-2 bg-card/50 p-4 rounded-2xl border border-transparent hover:border-border hover:bg-card transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-foreground">{comment.author_name}</span>
                                        <span className="text-[9px] font-bold text-slate-300">{new Date(comment.created_at).toLocaleTimeString('tr-TR')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isStatic && (
                                            <button onClick={() => onReply(comment.author_name)} className="p-2 text-slate-400 hover:text-primary transition-all bg-muted rounded-xl">
                                                <Reply size={18} />
                                            </button>
                                        )}
                                        {(user?.uid === comment.author_id || user?.role === 'admin') && (
                                            <>
                                                <button onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.content); }} className="p-2 text-slate-300 hover:text-blue-500 transition-all bg-muted rounded-xl"><Edit3 size={18} /></button>
                                                <button onClick={() => onDeleteComment(comment.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all bg-muted rounded-xl"><Trash2 size={18} /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {editingCommentId === comment.id ? (
                                    <div className="space-y-3 py-2">
                                        <textarea autoFocus value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className="w-full p-4 bg-muted border-2 border-primary/10 rounded-2xl text-sm font-medium outline-none min-h-[100px] resize-none" />
                                        <div className="flex gap-2 justify-end">
                                            <Button onClick={() => setEditingCommentId(null)} variant="ghost">İptal</Button>
                                            <Button onClick={() => onUpdateComment(comment.id)}>Kaydet</Button>
                                        </div>
                                    </div>
                                ) : <p className="text-sm text-slate-600 font-medium leading-relaxed">{comment.content}</p>}
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center space-y-4">
                             <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto text-slate-300"><LockIcon size={32} /></div>
                             <p className="text-xs font-bold text-slate-400">Yorumlar Kapalı</p>
                        </div>
                    )}
                </div>
            </div>
            {!isStatic && (
                <div className="sticky bottom-0 mt-auto pt-6 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pb-8 z-50">
                    <div className="max-w-2xl mx-auto relative">
                        <div className="bg-card/80 backdrop-blur-xl border border-border/50 p-2 rounded-2xl shadow-2xl flex flex-col gap-2">
                            {attachments.length > 0 && (
                                <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar">
                                    {attachments.map((at: any, i: number) => (
                                        <div 
                                            key={i} 
                                            onClick={() => at.type !== 'image' && window.open(resolveUrl(at.url), '_blank')}
                                            className={cn("relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-border bg-card flex items-center justify-center group/cat", at.type !== 'image' && "cursor-pointer hover:bg-primary/5")}
                                        >
                                            {at.type === 'image' ? (
                                                <img src={resolveUrl(at.url)} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center w-full h-full p-1">
                                                    <FileText size={18} className="text-slate-400 group-hover/cat:text-primary transition-colors" />
                                                    <span className="text-[7px] font-black mt-1 text-muted-foreground group-hover/cat:text-primary text-center truncate w-full">{at.name || "Dosya"}</span>
                                                </div>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); setAttachments((prev: any[]) => prev.filter((_, idx) => idx !== i)); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><X size={8} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                <div className="flex-1 w-full flex items-center gap-2">
                                    <button onClick={onAttach} className="p-3 text-slate-400 hover:text-primary transition-all shrink-0"><Paperclip size={20} /></button>
                                    <input 
                                        value={commentText} 
                                        onChange={e => setCommentText(e.target.value)} 
                                        placeholder="Cevap yaz..." 
                                        className="flex-1 bg-muted border-none rounded-xl px-4 h-12 text-sm font-bold outline-none" 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                onComment();
                                            }
                                        }}
                                    />
                                </div>
                                <button 
                                    disabled={isCommenting || (!commentText.trim() && attachments.length === 0)} 
                                    onClick={onComment} 
                                    className="w-full sm:w-auto bg-primary text-white h-12 px-8 rounded-xl font-black text-xs shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                                >
                                    {isCommenting ? <Loader2 className="animate-spin mx-auto" /> : "GÖNDER"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function GalleryOverlay({ attachment, onClose }: any) {
    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col items-center justify-center p-12" onClick={onClose}>
            <div className="absolute top-10 right-10 flex items-center gap-4" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="p-3 bg-card/10 hover:bg-rose-500 text-white rounded-2xl transition-all backdrop-blur-md border border-white/10"><X size={24} /></button>
            </div>
            <img src={attachment.url} className="max-h-[80vh] max-w-full object-contain shadow-2xl rounded-3xl" />
        </div>
    , document.body);
}



