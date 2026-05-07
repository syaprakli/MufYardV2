import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, AlertCircle, GripHorizontal, ChevronUp, Music, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const STATIONS = [
    { id: 'superfm', name: 'Süper FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FMAAC.aac', color: 'text-orange-400', bg: 'bg-orange-400' },
    { id: 'metrofm', name: 'Metro FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FMAAC.aac', color: 'text-amber-400', bg: 'bg-amber-400' },
    { id: 'joyfm', name: 'Joy FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_FMAAC.aac', color: 'text-sky-400', bg: 'bg-sky-400' },
    { id: 'joyturk', name: 'Joy Türk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURKAAC.aac', color: 'text-rose-400', bg: 'bg-rose-400' },
    { id: 'virgin', name: 'Virgin Radio', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/VIRGIN_RADIO_TURKIYEAAC.aac', color: 'text-red-500', bg: 'bg-red-500' },
    { id: 'retroturk', name: 'Retro Türk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RETRO_TURKAAC.aac', color: 'text-emerald-400', bg: 'bg-emerald-400' },
    { id: 'palnostalji', name: 'Pal Nostalji', url: 'https://radyo.palnostalji.com.tr/nostalji/mpeg/icecast.audio', color: 'text-sky-300', bg: 'bg-sky-300' },
    { id: 'lofi', name: 'MüfyardFM', url: '', color: 'text-slate-500', bg: 'bg-slate-500', isLocked: true }
];

export function DraggableRadioWidget() {
    const [currentStation, setCurrentStation] = useState(STATIONS[0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [showStations, setShowStations] = useState(false);
    const [isCompact, setIsCompact] = useState(false);

    useEffect(() => {
        if (isPlaying && audioRef.current && !currentStation.isLocked) {
            audioRef.current.load();
            audioRef.current.play().catch(() => {
                setHasError(true);
                setIsPlaying(false);
            });
        }
    }, [currentStation]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (currentStation.isLocked) {
            toast.error("Yakında!", { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
            return;
        }

        if (audioRef.current) {
            setHasError(false);
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.volume = 0.5;
                const playPromise = audioRef.current.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        setIsPlaying(true);
                        toast.success(`${currentStation.name} yayında.`, {
                            icon: '📻',
                            style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '12px' }
                        });
                    }).catch(error => {
                        console.error("Radio play error:", error);
                        setHasError(true);
                        setIsPlaying(false);
                        toast.error("Bağlantı kurulamadı. Kaynak HTTPS desteklemiyor olabilir.", {
                            icon: '🚫',
                            style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '12px' }
                        });
                    });
                }
            }
        }
    };

    const selectStation = (station: typeof STATIONS[0]) => {
        if (station.isLocked) return;
        setCurrentStation(station);
        setShowStations(false);
        setHasError(false);
    };

    return (
        <motion.div 
            drag
            dragMomentum={false}
            className="fixed z-[9999] cursor-grab active:cursor-grabbing flex flex-col items-center group"
            style={{ right: '2rem', bottom: '2rem' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <AnimatePresence>
                {showStations && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full mb-4 bg-slate-950 border border-slate-700/50 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] min-w-[200px] flex flex-col gap-1 overflow-hidden"
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseLeave={() => setShowStations(false)}
                    >
                        <div className="px-3 py-2 border-b border-slate-800/50 mb-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Canlı Radyo</span>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                            {STATIONS.map((station) => (
                                <button
                                    key={station.id}
                                    onClick={() => selectStation(station)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/10 text-left group/btn",
                                        currentStation.id === station.id ? "bg-white/15" : "",
                                        station.isLocked ? "opacity-30 grayscale" : ""
                                    )}
                                >
                                    <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", station.bg)} />
                                    <div className="flex flex-col">
                                        <span className={cn(
                                            "text-xs font-bold whitespace-nowrap",
                                            currentStation.id === station.id ? "text-white" : "text-slate-400 group-hover/btn:text-slate-100"
                                        )}>
                                            {station.name}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={cn(
                "mb-2 flex items-center gap-2 transition-all duration-300",
                isHovered || showStations ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
            )}>
                <button 
                    onClick={() => setShowStations(!showStations)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                        "p-2.5 rounded-full bg-slate-800 text-slate-300 hover:text-white shadow-xl transition-all hover:scale-110",
                        showStations && "bg-primary text-white"
                    )}
                >
                    <ChevronUp size={16} className={cn("transition-transform duration-300", showStations && "rotate-180")} />
                </button>
                <div className="p-2.5 rounded-full bg-slate-800 text-slate-400 shadow-xl">
                    <GripHorizontal size={16} />
                </div>
            </div>

            <div 
                onClick={() => isPlaying && setIsCompact(!isCompact)}
                className={cn(
                    "flex items-center shadow-[0_10px_40px_rgb(0,0,0,0.6)] rounded-full bg-slate-950 border border-slate-700/60 overflow-hidden transition-all duration-300",
                    isPlaying && !isCompact ? "cursor-pointer" : ""
                )}
            >
                <div className={cn(
                    "flex items-center transition-all duration-500 ease-in-out",
                    (isHovered || isPlaying || showStations) && !isCompact ? "w-52 sm:w-60 px-4 opacity-100" : "w-0 px-0 opacity-0"
                )}>
                    <div className="flex flex-col flex-1 min-w-0 py-2.5 pointer-events-none">
                        <div className="flex items-center gap-2 mb-0.5">
                            {currentStation.isLocked ? <Lock size={12} className="text-slate-600" /> : <Music size={12} className={cn(hasError ? "text-red-400" : currentStation.color)} />}
                            <span className={cn(
                                "text-[11px] font-black uppercase tracking-widest truncate",
                                hasError ? "text-red-400" : "text-white"
                            )}>
                                {currentStation.name}
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 truncate">
                            {hasError ? "Bağlantı Başarısız" : currentStation.isLocked ? "Bakımda" : isPlaying ? "Canlı Yayınlanıyor..." : "Dinlemeye Hazır"}
                        </span>
                    </div>
                    {isPlaying && !hasError && !currentStation.isLocked && (
                        <div className="flex gap-[3px] items-end h-3 mx-2 shrink-0">
                            <motion.span animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6 }} className={cn("w-[2.5px] rounded-full", currentStation.bg)} />
                            <motion.span animate={{ height: [10, 3, 10] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className={cn("w-[2.5px] rounded-full", currentStation.bg)} />
                            <motion.span animate={{ height: [5, 12, 5] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className={cn("w-[2.5px] rounded-full", currentStation.bg)} />
                        </div>
                    )}
                </div>

                <button 
                    onClick={togglePlay}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                        "w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full transition-all flex-shrink-0 relative overflow-hidden",
                        isPlaying ? cn("shadow-lg shadow-primary/20", currentStation.bg) : 
                        hasError ? "bg-red-900/40 text-red-400" :
                        currentStation.isLocked ? "bg-slate-900 text-slate-700" :
                        "bg-slate-800 text-slate-400 hover:text-white"
                    )}
                >
                    <div className="relative z-10 flex items-center justify-center pointer-events-none">
                        {hasError ? (
                            <AlertCircle size={22} />
                        ) : isPlaying ? (
                            <Pause size={20} className="fill-current text-white" />
                        ) : currentStation.isLocked ? (
                            <Lock size={18} />
                        ) : (
                            <Play size={20} className="fill-current ml-1" />
                        )}
                    </div>
                </button>
            </div>
            
            <audio 
                ref={audioRef} 
                src={currentStation.url} 
                preload="none" 
            />
        </motion.div>
    );
}
