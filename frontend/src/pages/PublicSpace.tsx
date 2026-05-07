import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { 
    User, MessageSquare, Search,
    Loader2, Trash2,
    ChevronDown, ChevronUp,
    Plus, Eye, Edit3,
    ArrowLeft, Image as ImageIcon, Paperclip, 
    Shield, Bell, HelpCircle, Check, X, Lock as LockIcon,
    ChevronRight, FolderTree, Reply
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/hooks/useAuth";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { DraggableChatWidget } from "../components/layout/DraggableChatWidget";
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
    const { user, loading: authLoading } = useAuth();
    const confirm = useConfirm();

    const location = useLocation();
    const [posts, setPosts] = useState<Post[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'Forum' | 'SSS' | 'Duyurular'>(localStorage.getItem('forum_view') as any || 'Forum');
    const [userProfile, setUserProfile] = useState<any>(null);
    const [userRole, setUserRole] = useState('user');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("Hepsi");
    const [loading, setLoading] = useState(true);
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
                setLoading(false);
            }
        };
        loadInitialData();
    }, [user]);

    useEffect(() => {
        const loadPosts = async () => {
            setLoading(true);
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
                setLoading(false);
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
        if (!newPost.content.trim() || !newPost.title.trim() || !user) return;
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
            await fetchWithTimeout(`${API_URL}/collaboration/posts/${postId}`, { method: 'DELETE' });
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
            if (isComment) setCommentAttachments(p => [...p, data]);
            else setNewPost(p => ({ ...p, attachments: [...p.attachments, data] }));
            toast.success("Yüklendi");
        } catch {
            toast.error("Hata");
        } finally {
            setFileUploading(false);
        }
    };

    if (authLoading || loading) return <LoadingScreen />;

    return (
        <div className="flex h-full w-full bg-card relative font-outfit overflow-hidden flex-col md:flex-row">
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
                    />
                )}
                {zoomedAttachment && <GalleryOverlay attachment={zoomedAttachment} onClose={() => setZoomedAttachment(null)} />}
            </AnimatePresence>

            <DraggableChatWidget />
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

function PostCreator({ onClose, onSubmit, post, setPost, categories, isPosting, isEdit, inspectors, sharedWith, onSharedWithChange, onUpload, uploading, isAdmin }: any) {
    const [step, setStep] = useState(1);
    const isForum = post.category !== 'Duyurular' && post.category !== 'SSS';

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

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 backdrop-blur-md bg-slate-900/40">
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
                    {step === 1 ? (
                        <>
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
                                <textarea value={post.content} onChange={(e) => setPost({ ...post, content: e.target.value })} placeholder={contentPlaceholder} className="w-full p-5 bg-muted rounded-3xl border-2 border-transparent focus:border-primary/10 focus:bg-card outline-none font-bold text-sm transition-all min-h-[150px] resize-none" />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black capitalize text-slate-400 tracking-widest ml-1">Seçmeli Paylaşım</label>
                                <div className="p-6 bg-muted rounded-3xl space-y-4">
                                    <p className="text-xs font-bold text-muted-foreground mb-4">Bu konuyu sadece seçtiğiniz müfettişler görebilir.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {inspectors.map((insp: any) => (
                                            <button 
                                                key={insp.uid || insp.id}
                                                type="button"
                                                onClick={() => {
                                                    const id = insp.uid || insp.id;
                                                    onSharedWithChange(sharedWith.includes(id) ? sharedWith.filter((x: string) => x !== id) : [...sharedWith, id]);
                                                }}
                                                className={cn("flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left", sharedWith.includes(insp.uid || insp.id) ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-card text-slate-600")}
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center font-black text-xs">{insp.full_name?.charAt(0) || insp.name?.charAt(0)}</div>
                                                <span className="text-[11px] font-black truncate">{insp.full_name || insp.name}</span>
                                                {sharedWith.includes(insp.uid || insp.id) && <Check size={14} className="ml-auto" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {!isAdmin && !isEdit && sharedWith.length === 0 && (
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                                    <Shield size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[10px] font-bold text-amber-700 leading-normal uppercase">
                                        Genel paylaşımlar (Forum, SSS, Duyuru) moderatör onayından sonra diğer kullanıcılara görünür olacaktır.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    {post.attachments && post.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-2xl border border-dashed border-border mt-4 overflow-x-auto no-scrollbar">
                            {post.attachments.map((at: any, i: number) => (
                                <div key={i} className="relative group/at w-20 h-20 rounded-xl overflow-hidden border border-border bg-card shadow-sm flex items-center justify-center shrink-0">
                                    {at.type === 'image' ? <img src={at.url} className="w-full h-full object-cover" /> : <Paperclip size={24} className="text-slate-300" />}
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
                        {step === 1 ? (
                            <Button type="button" onClick={() => setStep(2)} className="rounded-2xl px-10 h-11 font-bold text-[11px] capitalize tracking-wider bg-slate-200 text-slate-600">İleri</Button>
                        ) : (
                            <Button type="button" onClick={() => setStep(1)} variant="ghost" className="rounded-2xl px-6 h-11 font-bold text-[11px] capitalize tracking-wider text-slate-400">Geri</Button>
                        )}
                        <Button type="button" disabled={isPosting} onClick={onSubmit} className="rounded-2xl px-12 h-11 font-bold text-[11px] capitalize tracking-wider shadow-xl shadow-primary/20 bg-primary">
                            {isPosting ? <Loader2 className="animate-spin" /> : (isEdit ? "Kaydet" : "Paylaş")}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function ThreadView({ post, comments, onBack, onComment, commentText, setCommentText, isCommenting, user, onReply, onDeleteComment, onUpdateComment, editingCommentId, setEditingCommentId, editCommentText, setEditCommentText, onEditPost, onDeletePost, onAttach, onFileUpload, attachments, setAttachments, onZoom, isStatic }: any) {
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
                        <p className="text-slate-600 font-medium leading-relaxed text-sm">{post.content}</p>
                    </div>
                    {post.attachments && post.attachments.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                            {post.attachments.map((at: any, i: number) => (
                                <div key={i} onClick={() => at.type === 'image' && onZoom(at)} className="group/img relative aspect-square rounded-3xl overflow-hidden bg-muted/80 border border-border cursor-pointer flex items-center justify-center">
                                    {at.type === 'image' ? (
                                        <>
                                            <img src={at.url} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center"><Eye className="text-white" size={32} /></div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 p-6 justify-center">
                                            <Paperclip size={40} className="text-slate-300" />
                                            <span className="text-[10px] font-black capitalize text-muted-foreground text-center truncate w-full">{at.name}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
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
                                        <div key={i} className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-border bg-card flex items-center justify-center">
                                            {at.type === 'image' ? <img src={at.url} className="w-full h-full object-cover" /> : <Paperclip size={18} className="text-slate-300" />}
                                            <button onClick={() => setAttachments((prev: any[]) => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><X size={8} /></button>
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
    return (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-12" onClick={onClose}>
            <div className="absolute top-10 right-10 flex items-center gap-4" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="p-3 bg-card/10 hover:bg-rose-500 text-white rounded-2xl transition-all backdrop-blur-md border border-white/10"><X size={24} /></button>
            </div>
            <img src={attachment.url} className="max-h-[80vh] max-w-full object-contain shadow-2xl rounded-3xl" />
        </div>
    );
}

function LoadingScreen() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-card flex-col gap-6">
            <Loader2 className="animate-spin text-primary" size={64} />
            <span className="text-[10px] font-black capitalize tracking-[0.4em] text-slate-400">Yükleniyor...</span>
        </div>
    );
}
