import { useState } from 'react';
import { 
    Bell, Search, Trash2, CheckCheck, 
    Calendar, FileText, UserPlus, Info, 
    CheckCircle2, ChevronRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../lib/context/NotificationContext';
import { type Notification } from '../lib/api/notifications';

export default function Notifications() {
    const { 
        notifications, 
        markAllAsRead, 
        clearAll, 
        deleteNotification,
        markAsRead,
        loading 
    } = useNotifications();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const navigate = useNavigate();

    const filteredNotifications = notifications.filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             n.message.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || 
                           (filterType === 'audit' && n.type === 'audit') ||
                           (filterType === 'task' && (n.type === 'task_invite' || n.type === 'task_accepted')) ||

                           (filterType === 'system' && n.type === 'system') ||
                           (filterType === 'contact' && n.type === 'contact');
        return matchesSearch && matchesType;
    });

    const handleDetailClick = (notification: Notification) => {
        markAsRead(notification.id);
        switch (notification.type) {
            case 'audit':
                navigate('/audit');
                break;
            case 'task_invite':
            case 'task_accepted':
                navigate('/tasks');
                break;
            case 'contact':
                navigate('/contacts');
                break;
            case 'system':
                navigate('/settings');
                break;
            default:
                break;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'task':
            case 'task_invite':
            case 'task_accepted':
                return <Calendar className="text-amber-500" size={20} />;
            case 'audit': return <FileText className="text-blue-500" size={20} />;
            case 'contact': return <UserPlus className="text-purple-500" size={20} />;
            case 'system': return <CheckCircle2 className="text-emerald-500" size={20} />;
            default: return <Info className="text-slate-500" size={20} />;
        }
    };

    const categories = [
        { id: 'all', label: 'Tüm Bildirimler', icon: <Bell size={18} /> },
        { id: 'audit', label: 'Denetimler', icon: <FileText size={18} /> },
        { id: 'task', label: 'Görevler', icon: <Calendar size={18} /> },
        { id: 'system', label: 'Sistem', icon: <CheckCircle2 size={18} /> },
        { id: 'contact', label: 'Ekip', icon: <UserPlus size={18} /> },
    ];

    if (loading && notifications.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                        Bildirim Geçmişi
                    </h1>
                    <p className="text-slate-400 dark:text-slate-500 font-bold mt-2 uppercase tracking-[0.2em] text-[10px]">
                        Tüm aktiviteleriniz ve sistem güncellemeleri
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={() => markAllAsRead()}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-card border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                    >
                        <CheckCheck size={16} />
                        Okundu İşaretle
                    </button>
                    <button 
                        onClick={() => clearAll()}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                    >
                        <Trash2 size={16} />
                        Geçmişi Sil
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* Sidebar Filter */}
                <div className="col-span-12 lg:col-span-3">
                    <div className="bg-card rounded-3xl border border-slate-100 dark:border-slate-800 p-4 lg:sticky lg:top-24 shadow-sm overflow-x-auto no-scrollbar">
                        <div className="relative mb-4 lg:mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                            <input 
                                type="text" 
                                placeholder="Ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-muted border-none rounded-2xl text-sm font-bold dark:text-slate-200 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-500"
                            />
                        </div>

                        <div className="flex lg:flex-col gap-2 min-w-max lg:min-w-0">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFilterType(cat.id)}
                                    className={`flex items-center gap-3 px-4 py-2.5 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                        filterType === cat.id 
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {cat.icon}
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="col-span-12 lg:col-span-9 space-y-4">
                    {filteredNotifications.length > 0 ? (
                        filteredNotifications.map((notif) => {
                            const isNew = !notif.read;
                            const dateObj = new Date(notif.created_at);
                            
                            return (
                                <div 
                                    key={notif.id}
                                    className={`group bg-card rounded-3xl border transition-all p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start relative overflow-hidden ${
                                        isNew ? 'border-primary/20 bg-primary/[0.01] dark:bg-primary/[0.03]' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 shadow-sm'
                                    }`}
                                >
                                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 ${
                                        isNew ? 'bg-card' : 'bg-muted/50'
                                    }`}>
                                        {getIcon(notif.type)}
                                    </div>

                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                                            <div className="flex items-center gap-3">
                                                <h3 className={`text-base sm:text-lg tracking-tight ${
                                                    isNew ? 'font-black text-slate-800 dark:text-slate-100' : 'font-bold text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    {notif.title}
                                                </h3>
                                                {isNew && (
                                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded-full">
                                                        Yeni
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between sm:justify-end gap-4">
                                                <div className="text-left sm:text-right">
                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                        {dateObj.toLocaleDateString('tr-TR')}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600">
                                                        {dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={() => deleteNotification(notif.id)}
                                                    className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className={`text-sm leading-relaxed max-w-2xl ${
                                            isNew ? 'text-slate-600 dark:text-slate-300 font-bold' : 'text-slate-400 dark:text-slate-500 font-medium'
                                        }`}>
                                            {notif.message}
                                        </p>
                                        
                                        <div className="mt-4 flex items-center gap-6">
                                            <button 
                                                onClick={() => handleDetailClick(notif)}
                                                className="text-[10px] font-black text-primary dark:text-primary/90 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                                            >
                                                Detayları Görüntüle <ChevronRight size={12} />
                                            </button>
                                            <div className="h-1 w-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                Kategori: {notif.type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="bg-card rounded-[40px] border border-slate-100 dark:border-slate-800 py-24 flex flex-col items-center justify-center text-center px-8 shadow-sm">
                            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                                <Bell className="text-slate-200 dark:text-slate-700" size={48} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-400 dark:text-slate-500">Aradığınız bildirim bulunamadı</h2>
                            <p className="text-slate-400 dark:text-slate-500 mt-2 font-bold max-w-sm">
                                Filtreleri değiştirmeyi veya farklı anahtar kelimeler ile arama yapmayı deneyebilirsiniz.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


