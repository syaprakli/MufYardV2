import { useState } from 'react';
import { Bell, CheckCheck, Trash2, Calendar, FileText, UserPlus, Info, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../lib/context/NotificationContext';
import { useChat } from '../../lib/context/ChatContext';
import { useAuth } from '../../lib/hooks/useAuth';
import { MessageSquare } from 'lucide-react';




export function NotificationDropdown() {
    const { 
        notifications, 
        unreadCount, 
        markAsRead, 
        markAllAsRead, 
        clearAll
    } = useNotifications();
    const { openChat } = useChat();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
    const navigate = useNavigate();

    const filteredNotifications = activeTab === 'all' 
        ? notifications 
        : notifications.filter(n => !n.read);

    const getDisplayTime = (createdAt: string) => {
        try {
            const date = new Date(createdAt);
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return 'Yeni';
        }
    };


const getIcon = (type: string) => {
        switch (type) {
            case 'task':
            case 'task_invite':
            case 'task_accepted':
                return <Calendar className="text-amber-500" size={16} />;
            case 'audit': return <FileText className="text-blue-500" size={16} />;
            case 'contact': return <UserPlus className="text-purple-500" size={16} />;
            case 'system': return <CheckCircle2 className="text-emerald-500" size={16} />;
            case 'collaboration': return <MessageSquare className="text-primary" size={16} />;
            default: return <Info className="text-slate-500" size={16} />;
        }
    };


    return (
        <div className="absolute top-full right-0 mt-4 w-[400px] bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl shadow-slate-200/50 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white/50">
                <div>
                    <h3 className="text-base font-black text-slate-800">Bildirimler</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        {unreadCount > 0 ? `${unreadCount} Yeni Bildirim` : 'Tümü okundu'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={markAllAsRead}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                        title="Tümünü okundu işaretle"
                    >
                        <CheckCheck size={18} />
                    </button>
                    <button 
                        onClick={clearAll}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 white/5 rounded-xl transition-all"
                        title="Tümünü temizle"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex px-4 pt-3 pb-1 gap-1">
                <button 
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        activeTab === 'all' 
                        ? 'bg-slate-100 text-slate-800' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    Hepsi
                </button>
                <button 
                    onClick={() => setActiveTab('unread')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                        activeTab === 'unread' 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    Okunmamış
                </button>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto scrollbar-none py-2">
                {filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notif) => (
                        <div 
                            key={notif.id}
                            onClick={() => {
                                markAsRead(notif.id);
                                if (notif.type === 'collaboration' && notif.chat_room_id) {
                                    const title = notif.title.replace('Yeni Mesaj: ', '');
                                    openChat(notif.chat_room_id, title, 'dm');
                                } else if (notif.type === 'task' || notif.type === 'task_invite') {
                                    navigate('/tasks');
                                }
                            }}
                            className={`px-4 py-4 flex gap-4 hover:bg-slate-50/80 transition-all cursor-pointer relative group ${
                                !notif.read ? 'bg-primary/[0.02]' : ''
                            }`}

                        >
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                                !notif.read ? 'bg-white' : 'bg-slate-100 opacity-60'
                            }`}>
                                {getIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <h4 className={`text-sm tracking-tight truncate pr-4 ${
                                        !notif.read ? 'font-black text-slate-800' : 'font-bold text-slate-500'
                                    }`}>
                                        {notif.title}
                                    </h4>
                                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                        {getDisplayTime(notif.created_at)}
                                    </span>
                                </div>
                                <p className={`text-xs leading-relaxed ${
                                    !notif.read ? 'text-slate-600 font-medium' : 'text-slate-400'
                                }`}>
                                    {notif.message}
                                </p>
                            </div>
                            {!notif.read && (
                                <div className="absolute top-6 right-4 w-2 h-2 bg-primary rounded-full" />
                            )}
                        </div>
                    ))
                ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center px-8">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Bell className="text-slate-200" size={32} />
                        </div>
                        <h4 className="text-sm font-black text-slate-400">Bildirim Bulunmuyor</h4>
                        <p className="text-xs text-slate-400 mt-1 font-medium">Buralar şimdilik çok sessiz...</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <button 
                    onClick={() => navigate('/notifications')}
                    className="w-full py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all"
                >
                    Tüm Bildirim Geçmişini Gör
                </button>
            </div>
        </div>
    );
}
