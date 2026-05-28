import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, AlertCircle, ChevronUp, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

const MUFYARD_PLAYLIST = [
    { name: 'Başkanım (Özel)', url: 'Baskanim.mp3' },
    { name: 'Üstadım (Özel)', url: 'Ustadim.mp3' }
];

const STATIONS = [
    { id: 'lofi', name: 'MüfyardFM', url: 'Baskanim.mp3', color: 'text-violet-400', bg: 'bg-violet-500', isLocked: false },
    { id: 'superfm', name: 'Süper FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FMAAC.aac', color: 'text-orange-400', bg: 'bg-orange-400', isLocked: false },
    { id: 'metrofm', name: 'Metro FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FMAAC.aac', color: 'text-amber-400', bg: 'bg-amber-400', isLocked: false },
    { id: 'joyfm', name: 'Joy FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_FMAAC.aac', color: 'text-sky-400', bg: 'bg-sky-400', isLocked: false },
    { id: 'joyturk', name: 'Joy Türk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURKAAC.aac', color: 'text-rose-400', bg: 'bg-rose-400', isLocked: false }
];

export function DraggableRadioWidget() {
    const [currentStation, setCurrentStation] = useState(STATIONS[0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [hasError, setHasError] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [showStations, setShowStations] = useState(false);
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const [currentSongTitle, setCurrentSongTitle] = useState('');

    useEffect(() => {
        if (isPlaying && audioRef.current && !currentStation.isLocked) {
            audioRef.current.load();
            audioRef.current.play().catch(() => {
                setHasError(true);
                setIsPlaying(false);
            });
        }
        if (currentStation.id === 'lofi') {
            setCurrentSongTitle(MUFYARD_PLAYLIST[playlistIndex].name);
        } else {
            setCurrentSongTitle('');
        }
    }, [currentStation, playlistIndex]);

    const handleTrackEnd = () => {
        if (currentStation.id === 'lofi') {
            const nextIndex = (playlistIndex + 1) % MUFYARD_PLAYLIST.length;
            setPlaylistIndex(nextIndex);
            if (audioRef.current) {
                audioRef.current.src = MUFYARD_PLAYLIST[nextIndex].url;
                audioRef.current.load();
                audioRef.current.play().catch(() => setHasError(true));
            }
        } else {
            setIsPlaying(false);
        }
    };

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
                if (currentStation.id === 'lofi') {
                    audioRef.current.src = MUFYARD_PLAYLIST[playlistIndex].url;
                }
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        setIsPlaying(true);
                        const displayTitle = currentStation.id === 'lofi' ? MUFYARD_PLAYLIST[playlistIndex].name : currentStation.name;
                        toast.success(`${displayTitle} yayında.`, {
                            icon: '📻',
                            style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '12px' }
                        });
                    }).catch(() => {
                        setHasError(true);
                        setIsPlaying(false);
                        toast.error("Bağlantı kurulamadı.", {
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

    const toggleInfo = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (showInfo) {
            setShowInfo(false);
            setShowStations(false);
        } else {
            setShowInfo(true);
        }
    };

    const toggleStations = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowStations(!showStations);
    };

    return (
        <motion.div
            drag
            dragMomentum={false}
            className="fixed z-[9999] flex flex-col items-end cursor-grab active:cursor-grabbing"
            style={{ right: '1.25rem', bottom: '1.5rem' }}
        >
            {/* Station list - opens ABOVE */}
            <AnimatePresence>
                {showStations && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="mb-2 bg-slate-950/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] min-w-[180px]"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="px-2.5 py-1.5 border-b border-slate-800/50 mb-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Kanallar</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            {STATIONS.map((station) => (
                                <button
                                    key={station.id}
                                    onClick={() => selectStation(station)}
                                    className={cn(
                                        "flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all text-left active:scale-95",
                                        currentStation.id === station.id ? "bg-white/10" : "hover:bg-white/5",
                                        station.isLocked ? "opacity-30 grayscale" : ""
                                    )}
                                >
                                    <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", station.bg)} />
                                    <span className={cn(
                                        "text-[11px] font-bold whitespace-nowrap",
                                        currentStation.id === station.id ? "text-white" : "text-slate-400"
                                    )}>
                                        {station.name}
                                    </span>
                                    {station.isLocked && <Lock size={9} className="text-slate-600 ml-auto" />}
                                    {currentStation.id === station.id && isPlaying && !station.isLocked && (
                                        <div className="flex gap-[2px] items-end h-2.5 ml-auto">
                                            <motion.span animate={{ height: [3, 9, 3] }} transition={{ repeat: Infinity, duration: 0.5 }} className={cn("w-[2px] rounded-full", station.bg)} />
                                            <motion.span animate={{ height: [8, 3, 8] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.15 }} className={cn("w-[2px] rounded-full", station.bg)} />
                                            <motion.span animate={{ height: [4, 9, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.3 }} className={cn("w-[2px] rounded-full", station.bg)} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info pill - shows station name, click to open channels */}
            <AnimatePresence>
                {showInfo && (
                    <motion.button
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        onClick={toggleStations}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={cn(
                            "mb-2 flex items-center gap-2 bg-slate-950/95 backdrop-blur-xl border border-slate-700/50 rounded-full px-3.5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] active:scale-95 transition-transform",
                            showStations && "border-violet-500/40"
                        )}
                    >
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", currentStation.bg)} />
                        <div className="flex flex-col items-start min-w-0">
                            <span className="text-[10px] font-black text-white uppercase tracking-wider whitespace-nowrap">
                                {currentStation.name}
                            </span>
                            <span className="text-[8px] font-bold text-slate-500 whitespace-nowrap">
                                {hasError ? "Bağlantı Yok" : isPlaying ? (currentSongTitle || "Canlı Yayın") : "Hazır"}
                            </span>
                        </div>
                        <ChevronUp size={12} className={cn(
                            "text-slate-500 transition-transform duration-200 flex-shrink-0",
                            showStations && "rotate-180 text-violet-400"
                        )} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Single round button with integrated arrow */}
            <div className="relative">
                {/* Small arrow badge on top of the button */}
                <button
                    onClick={toggleInfo}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                        "absolute -top-1 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full flex items-center justify-center transition-all active:scale-90",
                        showInfo
                            ? "bg-violet-500 text-white shadow-md shadow-violet-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700/60 shadow-md hover:text-white"
                    )}
                >
                    <ChevronUp size={10} className={cn(
                        "transition-transform duration-200",
                        showInfo ? "rotate-180" : ""
                    )} />
                </button>

                {/* Main play/pause button */}
                <button
                    onClick={togglePlay}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                        "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all active:scale-90 border relative overflow-hidden",
                        isPlaying
                            ? cn(currentStation.bg, "border-transparent text-white")
                            : hasError
                            ? "bg-slate-950 border-red-500/30 text-red-400"
                            : "bg-slate-950 border-slate-700/60 text-slate-400 hover:text-white"
                    )}
                >
                    {isPlaying && !hasError && (
                        <motion.div
                            animate={{ scale: [1, 1.4], opacity: [0.3, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className={cn("absolute inset-0 rounded-full", currentStation.bg)}
                        />
                    )}
                    <div className="relative z-10">
                        {hasError ? (
                            <AlertCircle size={20} />
                        ) : isPlaying ? (
                            <Pause size={18} className="fill-current" />
                        ) : currentStation.isLocked ? (
                            <Lock size={16} />
                        ) : (
                            <Play size={18} className="fill-current ml-0.5" />
                        )}
                    </div>
                </button>
            </div>

            <audio
                ref={audioRef}
                src={currentStation.url}
                preload="none"
                onEnded={handleTrackEnd}
            />
        </motion.div>
    );
}
