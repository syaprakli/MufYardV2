import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { 
    Send, User, MessageSquare, Search,
    Loader2, Trash2,
    ChevronDown, ChevronUp,
    Plus, Eye, Edit3,
    ArrowLeft, Image as ImageIcon, Paperclip, 
    Shield, Bell, HelpCircle, Check, X, Lock as LockIcon,
    ChevronLeft, ChevronRight, FolderTree, Reply, Smile
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/hooks/useAuth";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { API_URL, WS_URL } from "../lib/config";
import { fetchWithTimeout } from "../lib/api/utils";
import toast from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { motion, AnimatePresence } from "framer-motion";

interface Post {
    id: string;
    title: string;
    content: string;
    category: string;
    author_name: string;
    author_id?: string;
    author_role?: string;
    created_at: string;
    likes_count: number;
    attachments?: Attachment[];
    is_public?: boolean;
    shared_with?: string[];
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

interface Message {
    id: string;
    text: string;
    author_name: string;
    author_id?: string;
    author_avatar?: string;
    timestamp: string;
    isMine: boolean;
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
    const [messages, setMessages] = useState<Message[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'Forum' | 'SSS' | 'Duyurular'>(localStorage.getItem('forum_view') as any || 'Forum');
    const [userRole, setUserRole] = useState('user');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [isChatCollapsed, setIsChatCollapsed] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("Hepsi");
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [newPost, setNewPost] = useState({ title: "", content: "", category: "Genel", attachments: [] as Attachment[] });
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isPosting, setIsPosting] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    const [isSendingMsg, setIsSendingMsg] = useState(false);
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
    const [showEmojiPicker, setShowEmojiPicker] = useState<'chat' | 'comment' | null>(null);
    const [showGifPicker, setShowGifPicker] = useState<'chat' | 'comment' | null>(null);
    const [gifSearchQuery, setGifSearchQuery] = useState("");
    const [onlineGifs, setOnlineGifs] = useState<any[]>([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Edit states
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editCommentText, setEditCommentText] = useState("");

    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    useEffect(() => {
        if (!gifSearchQuery.trim() || !isOnline) {
            setOnlineGifs([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await fetchWithTimeout(`https://tenor.googleapis.com/v2/search?q=${gifSearchQuery}&key=LIVDSRZULEUB&limit=8`);
                const data = await res.json();
                setOnlineGifs(data.results.map((r: any) => r.media_formats.tinygif.url));
            } catch (err) {}
        }, 500);
        return () => clearTimeout(timer);
    }, [gifSearchQuery, isOnline]);

    const commonEmojis = ["😊", "👍", "🔥", "🚀", "❤️", "😂", "😮", "🙏", "👏", "✅", "😢", "🎉", "💯", "🤔", "👀", "✨"];
    const offlineGifs = [
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1eHhjZ3J4eHV4eHhjZ3J4eHV4eHhjZ3J4eHV4eHhjZ3J4ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKMGpxS7AEXM0Cs/giphy.gif",
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1eHhjZ3J4eHV4eHhjZ3J4eHV4eHhjZ3J4eHV4eHhjZ3J4ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlIDW6X6X8Z7M3O/giphy.gif"
    ];

    const chatEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const retryTimer = useRef<any>(null);

    // Initial load
    useEffect(() => {
        const loadInitialData = async () => {
            if (!user?.uid) return;
            try {
                const [prof, cats, insps] = await Promise.all([
                    fetchWithTimeout(`${API_URL}/profiles/${user.uid}`).then(r => r.json()),
                    fetchWithTimeout(`${API_URL}/collaboration/categories`).then(r => r.json()),
                    fetchWithTimeout(`${API_URL}/profiles/`).then(r => r.json())
                ]);
                setUserRole(prof.role || 'user');
                setCategories(cats);
                setAllInspectors(insps.filter((i: any) => i.uid !== user?.uid));
            } catch (err: any) {
                console.error("Initial load error", err);
                toast.error(err.message || "Bağlantı hatası");
                setLoading(false); // Force stop loading on error
            }
        };
        loadInitialData();
    }, [user]);

    // Logic to load posts & history
    useEffect(() => {
        const loadPosts = async () => {
            setLoading(true);
            try {
                const url = new URL(`${API_URL}/collaboration/posts`);
                if (selectedCategory !== 'Hepsi') url.searchParams.append('category', selectedCategory);
                if (user?.uid) url.searchParams.append('user_id', user.uid);
                
                const [postsRes, msgsRes] = await Promise.all([
                    fetchWithTimeout(url.toString()),
                    fetchWithTimeout(`${API_URL}/collaboration/messages`)
                ]);
                const postsData = await postsRes.json();
                const msgsData = await msgsRes.json();
                
                setPosts(Array.isArray(postsData) ? postsData : []);
                setMessages(Array.isArray(msgsData) ? msgsData.map((m: any) => ({
                    ...m,
                    isMine: m.author_id === user?.uid
                })) : []);
            } catch (err: any) {
                console.error("Data load error", err);
                toast.error("Veriler alınamadı: " + (err.message || "Bilinmeyen hata"));
            } finally {
                setLoading(false);
            }
        };

        if (user) loadPosts();
    }, [selectedCategory, user]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Handle incoming navigation state (e.g., from Dashboard)
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
            // Clear state to avoid re-triggering on manual navigation
            window.history.replaceState({}, document.title);
        }
    }, [location.state, posts]);

    // WebSocket Connectivity with Retry Logic
    useEffect(() => {
        let ws: WebSocket;

        const connectWS = () => {
            if (!user) return;
            try {
                const baseWsUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
                const wsUrl = `${baseWsUrl}/api/collaboration/chat?uid=${user.uid}&name=${encodeURIComponent(user.displayName || 'Müfettiş')}`;

                ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    console.log("WebSocket connected");
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'presence') {
                            setOnlineUsers(Array.isArray(data.users) ? data.users : []);
                        } else if (data.text && data.author_id !== user?.uid) {
                            setMessages(prev => [...prev, {
                                id: data.id || Date.now().toString(),
                                text: data.text,
                                author_id: data.author_id,
                                author_name: data.author_name || "Müfettiş",
                                timestamp: data.timestamp || new Date().toISOString(),
                                isMine: false,
                                attachments: data.attachments || []
                            }]);
                        }
                    } catch (err) {
                        console.error("WS Parse Error", err);
                    }
                };

                ws.onclose = () => {
                    console.log("WebSocket closed, retrying in 5s...");
                    retryTimer.current = setTimeout(connectWS, 5000);
                };

                ws.onerror = (err) => {
                    console.error("WS Error:", err);
                    ws.close();
                };

                wsRef.current = ws;
            } catch (err) {
                console.error("WS Connection Error", err);
                retryTimer.current = setTimeout(connectWS, 10000);
            }
        };

        if (user) connectWS();

        return () => {
            ws?.close();
            if (retryTimer.current) clearTimeout(retryTimer.current);
        };
    }, [user]);

    const handleSendChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        const msgObj = {
            id: Date.now().toString(),
            text: newMessage,
            author_id: user.uid,
            author_name: user.displayName || "Müfettiş",
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, { ...msgObj, isMine: true }]);
        setIsSendingMsg(true);
        setNewMessage("");
        
        try {
            await fetchWithTimeout(`${API_URL}/collaboration/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(msgObj)
            });
            wsRef.current?.send(JSON.stringify(msgObj));
        } catch (err) {
            toast.error("Mesaj gönderilemedi");
        } finally {
            setIsSendingMsg(false);
        }
    };

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
        } catch (err) {
            console.error("Yorum silme hatası", err);
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
                    author_name: user.displayName || "Müfettiş",
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
            const url = editingPost 
                ? `${API_URL}/collaboration/posts/${editingPost.id}` 
                : `${API_URL}/collaboration/posts`;
            
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
                author_name: user.displayName || "Müfettiş",
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
            
            setNewPost({ title: "", content: "", category: "Genel", attachments: [] });
            setSharedWith([]);
            setShowPostCreator(false);
            toast.success(editingPost ? "Güncellendi!" : "Paylaşıldı!");
        } catch {
            toast.error("Hata oluştu.");
        } finally {
            setIsPosting(false);
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
        <div className="flex h-full w-full bg-white relative font-outfit overflow-hidden">
            {/* Main Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
                
                {/* Header */}
                <div className="px-8 pt-10 pb-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 capitalize tracking-[0.3em]">
                                <Shield size={10} className="text-primary/60" />
                                <button onClick={() => { setSelectedPost(null); setViewMode('Forum'); }} className="hover:text-primary transition-all">Platform</button>
                                <ChevronRight size={10} />
                                <span className="text-primary opacity-80">{viewMode === 'SSS' ? 'Bilgi Bankası' : 'Kamusal Alan'}</span>
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                {selectedPost ? "Konu Detayı" : viewMode === 'SSS' ? "Yardım Rehberi" : "Müzakere Forumu"}
                            </h1>
                        </div>

                        <div className="flex items-center gap-4">
                            {(userRole === 'admin' || userRole === 'moderator') && !selectedPost && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => { setNewPost({ ...newPost, category: 'Duyurular' }); setShowPostCreator(true); }}
                                    className="border-primary/20 text-primary font-black text-[10px] uppercase tracking-widest bg-primary/5 rounded-2xl h-11 px-6"
                                >
                                    <Bell size={16} className="mr-2" /> Duyuru Ekle
                                </Button>
                            )}
                            <Button 
                                onClick={() => {
                                    setEditingPost(null);
                                    let initialCategory = "Genel";
                                    if (viewMode === 'SSS') initialCategory = "SSS";
                                    if (viewMode === 'Duyurular') initialCategory = "Duyurular";
                                    
                                    setNewPost({ title: "", content: "", category: initialCategory, attachments: [] });
                                    setShowPostCreator(true);
                                }}
                                className="bg-primary text-white rounded-2xl px-6 h-11 font-bold shadow-lg shadow-primary/20 flex items-center gap-2 text-[10px] capitalize tracking-widest hover:scale-105 transition-all"
                            >
                                <Plus size={18} /> 
                                {viewMode === 'SSS' ? 'Soru Ekle' : viewMode === 'Duyurular' ? 'Yeni Duyuru' : 'Yeni Konu'}
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <button 
                            onClick={() => { setViewMode('Forum'); setSelectedPost(null); }}
                            className={cn("pb-3 text-xs font-black tracking-widest transition-all relative", viewMode === 'Forum' ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                        >
                            Forum <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-[10px] rounded-md text-slate-500">{posts.length}</span>
                            {viewMode === 'Forum' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                        <button 
                            onClick={() => { setViewMode('SSS'); setSelectedPost(null); }}
                            className={cn("pb-3 text-xs font-black tracking-widest transition-all relative", viewMode === 'SSS' ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                        >
                            Sss / Rehber
                            {viewMode === 'SSS' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                        <button 
                            onClick={() => { setViewMode('Duyurular'); setSelectedPost(null); }}
                            className={cn("pb-3 text-xs font-black tracking-widest transition-all relative", viewMode === 'Duyurular' ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                        >
                            Duyurular
                            {viewMode === 'Duyurular' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar relative p-8">
                    <AnimatePresence mode="wait">
                        {selectedPost ? (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
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
                                        setNewPost({ title: p.title, content: p.content, category: p.category, attachments: p.attachments || [] });
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
                                    showEmojiPicker={showEmojiPicker}
                                    setShowEmojiPicker={setShowEmojiPicker}
                                    showGifPicker={showGifPicker}
                                    setShowGifPicker={setShowGifPicker}
                                    commonEmojis={commonEmojis}
                                    offlineGifs={offlineGifs}
                                    gifSearchQuery={gifSearchQuery}
                                    setGifSearchQuery={setGifSearchQuery}
                                    onlineGifs={onlineGifs}
                                    isOnline={isOnline}
                                    isStatic={viewMode === 'Duyurular'}
                                />
                            </motion.div>
                        ) : viewMode === 'SSS' ? (
                            <motion.div key="sss" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto space-y-4">
                                {[...FAQ_DATA, ...posts.filter(p => p.category?.toLowerCase() === 'sss')].map((faq, idx) => (
                                    <FAQCard key={faq.id} faq={faq} isOpen={openFAQIndex === idx} onToggle={() => setOpenFAQIndex(openFAQIndex === idx ? null : idx)} />
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
                                                setNewPost({ title: post.title, content: post.content, category: post.category, attachments: post.attachments || [] });
                                                setShowPostCreator(true);
                                            }}
                                            canDelete={userRole === 'admin' || post.author_id === user?.uid}
                                            canEdit={post.author_id === user?.uid}
                                        />
                                    ))}
                            </motion.div>
                        ) : (
                            <motion.div key="forum" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                <div className="flex gap-4 items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* Category Dropdown */}
                                        <div className="relative" ref={categoryDropdownRef}>
                                            <button 
                                                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                                className="h-12 px-6 bg-white border border-slate-100 rounded-2xl flex items-center gap-3 text-xs font-black text-slate-700 shadow-sm hover:border-primary/20 transition-all"
                                            >
                                                <FolderTree size={16} className="text-primary" />
                                                {selectedCategory.toUpperCase()}
                                                <ChevronDown size={14} className={cn("transition-transform duration-200", showCategoryDropdown && "rotate-180")} />
                                            </button>
                                            
                                            {showCategoryDropdown && (
                                                <div className="absolute top-14 left-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="p-2 border-b border-slate-50 mb-1">
                                                        <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner group">
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
                                                            className={cn("w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-colors", selectedCategory === 'Hepsi' ? "bg-primary/5 text-primary" : "hover:bg-slate-50 text-slate-600")}
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
                                                                className={cn("w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-colors", selectedCategory === cat ? "bg-primary/5 text-primary" : "hover:bg-slate-50 text-slate-600")}
                                                            >
                                                                {cat.toUpperCase()}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="p-2 border-t border-slate-50 mt-1">
                                                        {isAddingCategory ? (
                                                            <div className="flex gap-2">
                                                                <input 
                                                                    className="flex-1 bg-slate-50 p-2 rounded-xl text-[10px] font-bold outline-none border border-slate-100"
                                                                    placeholder="Kategori Adı..."
                                                                    value={newCategoryName}
                                                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                                                />
                                                                <button onClick={handleAddCategory} className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Plus size={14} /></button>
                                                                <button onClick={() => setIsAddingCategory(false)} className="p-2 bg-slate-100 text-slate-400 rounded-xl"><X size={14} /></button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={() => setIsAddingCategory(true)}
                                                                className="w-full mt-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-primary hover:text-primary transition-all group"
                                                            >
                                                                <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                                                                <span className="text-[10px] font-black capitalize tracking-widest">Yeni Kategori Ekle</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Sort Options */}
                                        <div className="flex p-1 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                            <button 
                                                onClick={() => setSortBy('newest')}
                                                className={cn("px-4 py-2 text-[10px] font-black rounded-xl transition-all", sortBy === 'newest' ? "bg-slate-50 text-primary shadow-inner" : "text-slate-400 hover:text-slate-600")}
                                            >
                                                En Yeni
                                            </button>
                                            <button 
                                                onClick={() => setSortBy('popular')}
                                                className={cn("px-4 py-2 text-[10px] font-black rounded-xl transition-all", sortBy === 'popular' ? "bg-slate-50 text-primary shadow-inner" : "text-slate-400 hover:text-slate-600")}
                                            >
                                                Popüler
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative w-72">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            placeholder="Ara..." 
                                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 h-12 bg-white border border-slate-100 rounded-2xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-primary/10"
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
                                                    setNewPost({ title: post.title, content: post.content, category: post.category, attachments: post.attachments || [] });
                                                    setShowPostCreator(true);
                                                }}
                                                canDelete={userRole === 'admin' || post.author_id === user?.uid}
                                                canEdit={post.author_id === user?.uid}
                                            />
                                        ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Chat Sidebar */}
            <motion.div 
                initial={false}
                animate={{ width: isChatCollapsed ? 0 : 384 }}
                className="relative h-full flex shrink-0"
            >
                {/* Toggle Button */}
                <button 
                    onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                    className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-20 bg-[#002B4B] text-white flex items-center justify-center rounded-l-2xl shadow-xl z-50 border-r border-white/10 hover:w-10 transition-all"
                >
                    {isChatCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                </button>

                <div className={cn("w-[384px] border-l border-slate-200/50 bg-white flex flex-col shadow-2xl overflow-hidden", isChatCollapsed && "opacity-0 invisible")}>
                    <div className="p-6 border-b border-white/10 bg-[#002B4B] text-white">
                        <h3 className="text-sm font-black capitalize tracking-widest flex items-center gap-2">
                            <MessageSquare size={16} className="text-blue-400" /> Canlı Müzakere
                        </h3>
                        {/* Online Users Avatars */}
                        <div className="flex -space-x-2 overflow-hidden mt-4">
                            {Array.isArray(onlineUsers) && onlineUsers.map((u) => (
                                <div key={u.uid} title={u.name} className="inline-block h-8 w-8 rounded-full ring-2 ring-[#002B4B] bg-blue-500 flex items-center justify-center text-[10px] font-black capitalize">
                                    {u.name ? u.name.charAt(0) : '?'}
                                </div>
                            ))}
                            {(!onlineUsers || onlineUsers.length === 0) && <span className="text-[10px] font-bold text-white/40 italic">Kimse bağlı değil</span>}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                        {messages.map((msg: any) => (
                            <div key={msg.id} className={cn("flex flex-col", (msg.isMine || msg.author_id === user?.uid) ? "items-end" : "items-start")}>
                                <div className={cn("max-w-[85%] p-4 rounded-3xl text-sm font-medium shadow-sm space-y-2", (msg.isMine || msg.author_id === user?.uid) ? "bg-primary text-white rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none")}>
                                    {msg.text !== "GIF" && msg.text}
                                    {msg.attachments && msg.attachments.length > 0 && msg.attachments[0].url && (
                                        <div className="rounded-2xl overflow-hidden shadow-md">
                                            <img src={msg.attachments[0].url} className="max-w-full h-auto object-cover" />
                                        </div>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 mt-1 px-2">{msg.author_name} • {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleSendChat} className="p-6 border-t border-slate-100 flex flex-col gap-3 relative">
                        <AnimatePresence>
                            {showEmojiPicker === 'chat' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-full left-6 mb-2 p-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 grid grid-cols-5 gap-2">
                                    {commonEmojis.map(e => <button key={e} onClick={() => { setNewMessage(prev => prev + e); setShowEmojiPicker(null); }} className="p-2 hover:bg-slate-50 rounded-lg text-xl">{e}</button>)}
                                    <button onClick={() => { setShowEmojiPicker(null); setShowGifPicker('chat'); }} className="col-span-5 text-[10px] font-black text-primary py-2 capitalize tracking-widest border-t border-slate-50 mt-2">Gif Ara</button>
                                </motion.div>
                            )}
                            {showGifPicker === 'chat' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-full left-6 mb-2 p-4 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 w-72 space-y-3">
                                     <div className="flex items-center gap-2 px-2 bg-slate-50 rounded-xl border border-slate-100">
                                         <Search size={14} className="text-slate-400" />
                                         <input 
                                            autoFocus 
                                            placeholder={isOnline ? "Gif Ara..." : "Çevrimdışı (Hazır Gif'ler)"} 
                                            value={gifSearchQuery} 
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGifSearchQuery(e.target.value)}
                                            className="w-full py-2 bg-transparent text-[10px] font-bold outline-none" 
                                         />
                                     </div>
                                     <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto no-scrollbar pt-1">
                                        {(gifSearchQuery.trim() && isOnline ? onlineGifs : offlineGifs).map((gif, i) => <img key={i} src={gif} onClick={() => { 
                                            const msgObj = { id: Date.now().toString(), text: "GIF", author_id: user?.uid, author_name: user?.displayName || "Müfettiş", timestamp: new Date().toISOString(), attachments: [{ url: gif, type: 'image', name: 'gif' }] };
                                            setMessages((prev: any) => [...prev, { ...msgObj, isMine: true } as Message]);
                                            wsRef.current?.send(JSON.stringify(msgObj));
                                            setShowGifPicker(null); 
                                            setGifSearchQuery("");
                                        }} className="w-full aspect-square object-cover rounded-xl cursor-pointer hover:scale-105 transition-transform" />)}
                                     </div>
                                     <button onClick={() => { setShowGifPicker(null); setGifSearchQuery(""); }} className="w-full text-[10px] font-black text-slate-400 py-2 capitalize tracking-widest border-t border-slate-50 mt-2">Kapat</button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <input 
                                    value={newMessage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
                                    placeholder="Mesajınızı yazın..." 
                                    className="w-full bg-slate-100 rounded-2xl pl-4 pr-12 py-3 text-xs font-bold outline-none border-2 border-transparent focus:border-primary/20 transition-all"
                                />
                                <button type="button" onClick={() => setShowEmojiPicker(showEmojiPicker === 'chat' ? null : 'chat')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors">
                                    <Smile size={20} />
                                </button>
                            </div>
                            <button 
                                disabled={isSendingMsg}
                                className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                            >
                                {isSendingMsg ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>

            {/* Modals */}
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
                    />
                )}
                {zoomedAttachment && <GalleryOverlay attachment={zoomedAttachment} onClose={() => setZoomedAttachment(null)} />}
            </AnimatePresence>
        </div>
    );
}


function TopicRow({ post, onClick, onDelete, onEdit, canDelete, canEdit }: any) {
    return (
        <div onClick={onClick} className="group p-5 bg-white border border-slate-200/60 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all cursor-pointer flex items-center gap-6 relative overflow-hidden">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-primary/40 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                <MessageSquare size={24} />
            </div>
            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black capitalize tracking-widest">{post.category}</span>
                    <h3 className="font-black text-slate-800 text-[13px] group-hover:text-primary transition-colors leading-tight">{post.title}</h3>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                    <span className="flex items-center gap-1"><User size={10} /> {post.author_name}</span>
                    <span className="flex items-center gap-1"><Bell size={10} /> {new Date(post.created_at).toLocaleDateString()}</span>
                    {post.shared_with && post.shared_with.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-500"><LockIcon size={10} /> Gizli Paylaşım</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 px-4 border-l border-slate-50">
                <div className="text-center mr-2">
                    <p className="text-xs font-black text-slate-700">{post.likes_count || 0}</p>
                    <p className="text-[9px] font-bold text-slate-400 capitalize tracking-widest">Beğeni</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {canEdit && (
                        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-all" title="Düzenle">
                            <Edit3 size={18} />
                        </button>
                    )}
                    {canDelete && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="Sil">
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function FAQCard({ faq, isOpen, onToggle }: any) {
    return (
        <Card className="overflow-hidden border-slate-100 rounded-3xl group shadow-sm hover:shadow-md transition-all">
            <button onClick={onToggle} className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center">
                        <HelpCircle size={20} />
                    </div>
                    <span className="font-black text-slate-800 text-sm tracking-tight">{faq.title}</span>
                </div>
                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="p-6 pt-0 text-sm text-slate-500 font-medium leading-relaxed border-t border-slate-50 bg-slate-50/30">
                            {faq.content}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
}

function PostCreator({ onClose, onSubmit, post, setPost, categories, isPosting, isEdit, inspectors, sharedWith, onSharedWithChange, onUpload, uploading }: any) {
    const [step, setStep] = useState(1);
    
    // Context-aware labels
    const isAnnouncement = post.category === 'Duyurular';
    const isSSS = post.category === 'SSS';
    const isForum = !isAnnouncement && !isSSS;

    let headerTitle = isEdit ? 'İçeriği Güncelle' : 'Yeni İçerik Oluştur';
    let headerDesc = isEdit ? 'Daha İyi Bir Anlatım' : 'Fikrini Müzakereye Aç';
    let titleLabel = 'Başlık';
    let titlePlaceholder = 'Konu başlığı nedir?';
    let contentLabel = 'İçerik';
    let contentPlaceholder = 'Meslektaşlarınla paylaşmak istediğin detaylar...';

    if (isAnnouncement) {
        headerTitle = isEdit ? 'Duyuruyu Düzenle' : 'Yeni Duyuru Yayınla';
        headerDesc = 'Kurumsal bir bildiri veya önemli bir gelişme paylaşın';
        titleLabel = 'Duyuru Başlığı';
        titlePlaceholder = 'Duyurunun ana başlığı nedir?';
        contentLabel = 'Duyuru Metni';
        contentPlaceholder = 'Duyurunun tüm detaylarını burada paylaşın...';
    } else if (isSSS) {
        headerTitle = isEdit ? 'Soruyu Düzenle' : 'Yeni Soru & Rehber Ekle';
        headerDesc = 'Sık sorulan bir soruya veya bir sorun çözümüne dair bilgi girin';
        titleLabel = 'Soru / Başlık';
        titlePlaceholder = 'Sorulan soru veya rehber konusu nedir?';
        contentLabel = 'Çözüm / Detaylar';
        contentPlaceholder = 'Çözüm yollarını veya rehber içeriğini açıklayın...';
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/40">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white relative">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black capitalize text-primary tracking-[0.3em]">{headerTitle}</p>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter">{headerDesc}</h2>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Single robust file input for PostCreator */}
                <input 
                    id="post-file-input" 
                    type="file" 
                    hidden 
                    onChange={onUpload}
                />

                <div className="p-8 overflow-y-auto space-y-6">
                    {step === 1 ? (
                        <>
                            {isForum && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black capitalize text-slate-400 tracking-widest ml-1">Kategori</label>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map((c: string) => {
                                            // Don't show Duyurular and SSS in the Forum creator's category list
                                            if (c === 'Duyurular' || c === 'SSS') return null;
                                            return (
                                                <button 
                                                    key={c}
                                                    onClick={() => setPost({ ...post, category: c })}
                                                    className={cn("px-4 py-2 rounded-xl text-[10px] font-bold capitalize tracking-wider transition-all", post.category === c ? "bg-primary text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100")}
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
                                <input value={post.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPost({ ...post, title: e.target.value })} placeholder={titlePlaceholder} className="w-full p-5 bg-slate-50 rounded-3xl border-2 border-transparent focus:border-primary/10 focus:bg-white outline-none font-bold text-sm transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black capitalize text-slate-400 tracking-widest ml-1">{contentLabel}</label>
                                <textarea value={post.content} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPost({ ...post, content: e.target.value })} placeholder={contentPlaceholder} className="w-full p-5 bg-slate-50 rounded-3xl border-2 border-transparent focus:border-primary/10 focus:bg-white outline-none font-bold text-sm transition-all min-h-[150px] resize-none" />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black capitalize text-slate-400 tracking-widest ml-1">Seçmeli Paylaşım (Selective Sharing)</label>
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                                    <p className="text-xs font-bold text-slate-500 mb-4">Bu konuyu sadece seçtiğiniz müfettişler görebilir. Kimse seçilmezse herkes görür.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {inspectors.map((insp: any) => (
                                            <button 
                                                key={insp.uid || insp.id}
                                                onClick={() => {
                                                    const id = insp.uid || insp.id;
                                                    onSharedWithChange(sharedWith.includes(id) ? sharedWith.filter((x: string) => x !== id) : [...sharedWith, id]);
                                                }}
                                                className={cn("flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left", sharedWith.includes(insp.uid || insp.id) ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-white text-slate-600")}
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-xs">{insp.full_name?.charAt(0) || insp.name?.charAt(0)}</div>
                                                <span className="text-[11px] font-black truncate">{insp.full_name || insp.name}</span>
                                                {sharedWith.includes(insp.uid || insp.id) && <Check size={14} className="ml-auto" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Attachments Preview in Creator */}
                    {post.attachments && post.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mt-4 overflow-x-auto no-scrollbar">
                            {post.attachments.map((at: any, i: number) => (
                                <div key={i} className="relative group/at w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm flex items-center justify-center shrink-0">
                                    {at.type === 'image' ? (
                                        <img src={at.url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            <Paperclip size={24} className="text-slate-300" />
                                            <span className="text-[8px] font-black capitalize text-slate-400 truncate w-16 text-center">{at.name?.split('.').pop()}</span>
                                        </div>
                                    )}
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setPost((p: any) => ({ ...p, attachments: p.attachments.filter((_: any, idx: number) => idx !== i) }));
                                        }}
                                        className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover/at:opacity-100 transition-all shadow-lg z-10"
                                    >
                                        <X size={8} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex gap-2">
                        <button 
                            disabled={uploading}
                            onClick={() => document.getElementById('post-file-input')?.click()}
                            className="p-4 bg-white rounded-2xl text-slate-400 hover:text-primary transition-all border border-slate-200 flex items-center justify-center relative"
                        >
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                        </button>
                        <button 
                            disabled={uploading}
                            onClick={() => document.getElementById('post-file-input')?.click()}
                            className="p-4 bg-white rounded-2xl text-slate-400 hover:text-primary transition-all border border-slate-200 flex items-center justify-center"
                        >
                            <Paperclip size={20} />
                        </button>
                    </div>
                    <div className="flex gap-3">
                        {step === 1 ? (
                                <Button onClick={() => setStep(2)} className="rounded-2xl px-10 h-11 font-bold text-[11px] capitalize tracking-wider bg-slate-200 text-slate-600 hover:bg-slate-300">İleri</Button>
                        ) : (
                            <Button onClick={() => setStep(1)} variant="ghost" className="rounded-2xl px-6 h-11 font-bold text-[11px] capitalize tracking-wider text-slate-400">Geri</Button>
                        )}
                        <Button disabled={isPosting} onClick={onSubmit} className="rounded-2xl px-12 h-11 font-bold text-[11px] capitalize tracking-wider shadow-xl shadow-primary/20 bg-primary">
                            {isPosting ? <Loader2 className="animate-spin" /> : (
                                isEdit ? "Değişiklikleri Kaydet" : (
                                    isAnnouncement ? "Duyuruyu Yayınla" : (
                                        isSSS ? "Soruyu Ekle" : "Konuyu Paylaş"
                                    )
                                )
                            )}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function ThreadView({ post, comments, onBack, onComment, commentText, setCommentText, isCommenting, user, onReply, onDeleteComment, onUpdateComment, editingCommentId, setEditingCommentId, editCommentText, setEditCommentText, onEditPost, onDeletePost, onAttach, onFileUpload, attachments, setAttachments, onZoom, showEmojiPicker, setShowEmojiPicker, showGifPicker, setShowGifPicker, commonEmojis, offlineGifs, gifSearchQuery, setGifSearchQuery, onlineGifs, isOnline, isStatic }: any) {
    return (
        <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-500">
            {/* Hidden Input for Comment Attachments */}
            <input 
                id="comment-file-input" 
                type="file" 
                hidden 
                onChange={(e) => onFileUpload(e, true)} 
            />
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-primary transition-all text-xs">
                    <ArrowLeft size={16} /> Geri Dön
                </button>
                <div className="px-3 py-1 bg-primary/5 text-primary rounded-lg text-[9px] font-black capitalize tracking-widest">{post.category}</div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-8 no-scrollbar pb-32">
                {/* Main Post */}
                <div className="bg-white border border-slate-200/60 p-8 rounded-[32px] shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 text-lg">
                                {post.author_name?.charAt(0)}
                            </div>
                            <div>
                                <h2 className="font-black text-slate-900 text-lg tracking-tight">{post.author_name}</h2>
                                <p className="text-[10px] font-bold text-slate-400 capitalize tracking-widest">Müfettiş • {new Date(post.created_at).toLocaleString('tr-TR')}</p>
                            </div>
                        </div>
                        {user?.uid === post.author_id && (
                            <div className="flex gap-2">
                                <button onClick={() => onEditPost(post)} className="flex items-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-[10px] capitalize tracking-widest hover:bg-blue-100 transition-all">
                                    <Edit3 size={14} /> Düzenle
                                </button>
                                <button onClick={() => onDeletePost(post.id)} className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] capitalize tracking-widest hover:bg-rose-100 transition-all">
                                    <Trash2 size={14} /> Sil
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight">{post.title}</h1>
                        <p className="text-slate-600 font-medium leading-relaxed text-sm">{post.content}</p>
                    </div>

                    {post.attachments && post.attachments.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                            {post.attachments.map((at: any, i: number) => (
                                <div key={i} onClick={() => at.type === 'image' && onZoom(at)} className="group/img relative aspect-square rounded-3xl overflow-hidden bg-slate-100 border border-slate-100 cursor-pointer flex items-center justify-center">
                                    {at.type === 'image' ? (
                                        <>
                                            <img src={at.url} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center">
                                                <Eye className="text-white" size={32} />
                                            </div>
                                        </>
                                    ) : (
                                        <a href={`${API_URL}${at.url}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 p-6 w-full h-full justify-center hover:bg-slate-200 transition-colors">
                                            <Paperclip size={40} className="text-slate-300" />
                                            <span className="text-[10px] font-black capitalize text-slate-500 text-center truncate w-full">{at.name}</span>
                                            <div className="px-3 py-1 bg-white rounded-lg text-[8px] font-black text-primary border border-slate-100 shadow-sm">Dosyayı Aç</div>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Comments Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <span className="text-[10px] font-black text-slate-400 capitalize tracking-[0.2em]">Cevaplar ({comments.length})</span>
                        <div className="h-px flex-1 bg-slate-100"></div>
                    </div>

                    {!isStatic ? comments.map((comment: any) => (
                        <div key={comment.id} className="flex gap-4 group/reply">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex shrink-0 items-center justify-center font-black text-slate-300 text-sm">
                                {comment.author_name?.charAt(0)}
                            </div>
                            <div className="flex-1 space-y-2 bg-white/50 p-4 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-white transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-800">{comment.author_name}</span>
                                        <span className="text-[9px] font-bold text-slate-300">{new Date(comment.created_at).toLocaleTimeString('tr-TR')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 transition-opacity">
                                        {!isStatic && (
                                            <button onClick={() => onReply(comment.author_name)} className="p-2 text-slate-400 hover:text-primary transition-all bg-slate-50 rounded-xl" title="Cevapla">
                                                <Reply size={18} />
                                            </button>
                                        )}
                                        {(user?.uid === comment.author_id || user?.role === 'admin') && (
                                            <>
                                                <button 
                                                    onClick={() => {
                                                        setEditingCommentId(comment.id);
                                                        setEditCommentText(comment.content);
                                                    }} 
                                                    className="p-2 text-slate-300 hover:text-blue-500 transition-all bg-slate-50 rounded-xl" 
                                                    title="Düzenle"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button onClick={() => onDeleteComment(comment.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all bg-slate-50 rounded-xl" title="Sil">
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {editingCommentId === comment.id ? (
                                    <div className="space-y-3 py-2 animate-in fade-in duration-200">
                                        <textarea 
                                            autoFocus
                                            value={editCommentText}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditCommentText(e.target.value)}
                                            className="w-full p-4 bg-slate-50 border-2 border-primary/10 rounded-2xl text-sm font-medium outline-none min-h-[100px] resize-none focus:bg-white transition-all"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button onClick={() => setEditingCommentId(null)} variant="ghost" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">İptal</Button>
                                            <Button onClick={() => onUpdateComment(comment.id)} className="h-9 px-6 text-[10px] font-black uppercase tracking-widest bg-primary text-white shadow-md shadow-primary/10">Kaydet</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">{comment.content}</p>
                                )}
                                {comment.attachments && comment.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {comment.attachments.map((at: any, i: number) => (
                                            <div 
                                                key={i} 
                                                onClick={() => at.type === 'image' && onZoom(at)}
                                                className="group/img relative rounded-xl overflow-hidden w-20 h-20 bg-slate-50 border border-slate-100 cursor-pointer flex items-center justify-center"
                                            >
                                                {at.type === 'image' ? (
                                                    <img src={at.url} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                                ) : (
                                                    <a 
                                                        href={at.url.startsWith('http') ? at.url : `${API_URL}${at.url}`} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="text-slate-400 font-black text-[9px] flex flex-col items-center gap-1 capitalize w-full h-full justify-center hover:bg-slate-100 transition-colors"
                                                    >
                                                        <Paperclip size={24} className="text-slate-200" />
                                                        <span className="truncate w-16 text-center">{at.name?.split('.').pop() || 'Dosya'}</span>
                                                    </a>
                                                )}
                                                {at.type === 'image' && <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center"><Eye className="text-white" size={16} /></div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center space-y-4">
                             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                                <LockIcon size={32} />
                             </div>
                             <p className="text-xs font-bold text-slate-400">Bu içerik yorumlara kapalıdır.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Reply Box - Sticky SaaS Style */}
            {!isStatic && (
                <div className="sticky bottom-0 mt-auto pt-6 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pb-8 z-50">
                    <div className="max-w-2xl mx-auto relative">
                        <AnimatePresence>
                            {showEmojiPicker === 'comment' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-full left-0 mb-4 p-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 grid grid-cols-5 gap-2">
                                    {commonEmojis.map((e: string) => <button key={e} onClick={() => { setCommentText((prev: string) => prev + e); setShowEmojiPicker(null); }} className="p-2 hover:bg-slate-50 rounded-lg text-xl">{e}</button>)}
                                    <button onClick={() => { setShowEmojiPicker(null); setShowGifPicker('comment'); }} className="col-span-5 text-[10px] font-black text-primary py-2 capitalize tracking-widest border-t border-slate-50 mt-2">Gif Ara</button>
                                </motion.div>
                            )}
                            {showGifPicker === 'comment' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-full left-0 mb-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 w-80 space-y-3">
                                    <div className="flex items-center gap-2 px-2 bg-slate-50 rounded-xl border border-slate-100">
                                        <Search size={14} className="text-slate-400" />
                                        <input 
                                            autoFocus 
                                            placeholder={isOnline ? "Gif Ara..." : "Çevrimdışı (Hazır Gif'ler)"} 
                                            value={gifSearchQuery} 
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGifSearchQuery(e.target.value)}
                                            className="w-full py-2 bg-transparent text-[10px] font-bold outline-none" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto no-scrollbar pt-1">
                                        {(gifSearchQuery.trim() && isOnline ? onlineGifs : offlineGifs).map((g: any, i: number) => (
                                            <img 
                                                key={g.id || i} 
                                                src={g.images?.fixed_height_small?.url || g} 
                                                onClick={() => { 
                                                    setAttachments((prev: any[]) => [...prev, { url: g.images?.fixed_height?.url || g, type: 'image', name: 'gif' }]);
                                                    setShowGifPicker(null); 
                                                    setGifSearchQuery("");
                                                }} 
                                                className="w-full aspect-square object-cover rounded-xl cursor-pointer hover:scale-105 transition-transform" 
                                            />
                                        ))}
                                    </div>
                                    <button onClick={() => { setShowGifPicker(null); setGifSearchQuery(""); }} className="w-full text-[10px] font-black text-slate-400 py-2 uppercase tracking-widest border-t border-slate-50 mt-2">Kapat</button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 p-2 rounded-2xl shadow-2xl flex flex-col gap-2">
                            {attachments.length > 0 && (
                                <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar">
                                    {attachments.map((at: any, i: number) => (
                                        <div key={i} className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                                            {at.type === 'image' ? (
                                                <img src={at.url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <Paperclip size={18} className="text-slate-300" />
                                                    <span className="text-[8px] font-black uppercase text-slate-400 truncate w-12 text-center">{at.name?.split('.').pop()}</span>
                                                </div>
                                            )}
                                            <button onClick={() => setAttachments((prev: any[]) => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow-lg z-10"><X size={8} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <button onClick={onAttach} className="p-3 text-slate-400 hover:text-primary transition-all"><Paperclip size={20} /></button>
                                <button onClick={() => setShowEmojiPicker(showEmojiPicker === 'comment' ? null : 'comment')} className="p-3 text-slate-400 hover:text-primary transition-all"><Smile size={20} /></button>
                                <input 
                                    value={commentText} 
                                    onChange={e => setCommentText(e.target.value)} 
                                    placeholder="Bir cevap yazın..." 
                                    className="flex-1 bg-slate-50 border-none rounded-xl px-4 h-12 text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all" 
                                />
                                <button 
                                    disabled={isCommenting || (!commentText.trim() && attachments.length === 0)} 
                                    onClick={onComment}
                                    className="bg-primary text-white h-12 px-6 rounded-xl font-black text-xs shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                                >
                                    {isCommenting ? <Loader2 className="animate-spin" /> : "Gönder"}
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
                <a 
                    href={attachment.url} 
                    download={attachment.name || 'image.jpg'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all backdrop-blur-md border border-white/10"
                >
                    İndir & Paylaş
                </a>
                <button onClick={onClose} className="p-3 bg-white/10 hover:bg-rose-500 text-white rounded-2xl transition-all backdrop-blur-md border border-white/10">
                    <X size={24} />
                </button>
            </div>
            <img 
                src={attachment.url} 
                className="max-h-[80vh] max-w-full object-contain shadow-2xl animate-in zoom-in-95 duration-500 rounded-3xl" 
            />
            <p className="mt-8 text-white/40 text-[10px] font-black uppercase tracking-[0.4em]">{attachment.name || 'Görsel Önizleme'}</p>
        </div>
    );
}

function LoadingScreen() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-white flex-col gap-6">
            <div className="relative">
                <Loader2 className="animate-spin text-primary" size={64} />
                <div className="absolute inset-0 flex items-center justify-center"><Shield size={24} className="text-primary/20" /></div>
            </div>
            <span className="text-[10px] font-black capitalize tracking-[0.4em] text-slate-400">Veriler Senkronize Ediliyor...</span>
        </div>
    );
}
