import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, AlertCircle, ChevronUp, Lock, Volume2, Volume1, VolumeX } from 'lucide-react';
import Hls from 'hls.js';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Station {
    id: string;
    name: string;
    category: string;
    url: string;
    color: string;
    bg: string;
    isLocked: boolean;
    isHls?: boolean;
}

const MUFYARD_PLAYLIST = [
    { name: 'Başkanım (Özel)', url: 'Baskanim.mp3' },
    { name: 'Üstadım (Özel)', url: 'Ustadim.mp3' }
];

const STATIONS: Station[] = [
    // Özel
    { id: 'lofi', name: 'MüfyardFM', category: 'Özel', url: 'Baskanim.mp3', color: 'text-violet-400', bg: 'bg-violet-500', isLocked: false },

    // Halk Müziği & Türkü
    { id: 'turkulerleturkiye', name: 'Türkülerle Türkiye', category: 'Halk Müziği & Türkü', url: 'https://moondigitaledge.radyotvonline.net/turkulerleturkiye/playlist.m3u8', color: 'text-emerald-400', bg: 'bg-emerald-500', isLocked: false, isHls: true },
    { id: 'kralfm', name: 'Kral FM (Türkü & Nostalji)', category: 'Halk Müziği & Türkü', url: 'https://dygedge2.radyotvonline.net/kralfm/playlist.m3u8', color: 'text-teal-400', bg: 'bg-teal-500', isLocked: false, isHls: true },

    // 80'ler & 90'lar Nostalji
    { id: 'retroturk', name: 'RetroTürk (80 & 90)', category: "80'ler & 90'lar", url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RETROTURK_SC', color: 'text-amber-400', bg: 'bg-amber-500', isLocked: false },
    { id: 'pop90', name: "Pop 90'lar", category: "80'ler & 90'lar", url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/POP90_SC', color: 'text-yellow-400', bg: 'bg-yellow-500', isLocked: false },

    // Slow & Duygusal
    { id: 'slowturk', name: 'Slow Türk', category: 'Slow & Duygusal', url: 'https://radyo.duhnet.tv/slowturk', color: 'text-blue-400', bg: 'bg-blue-500', isLocked: false },
    { id: 'joyturk', name: 'Joy Türk (Akustik)', category: 'Slow & Duygusal', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURKAAC.aac', color: 'text-rose-400', bg: 'bg-rose-500', isLocked: false },
    { id: 'joyfm', name: 'Joy FM (Yabancı Slow)', category: 'Slow & Duygusal', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_FMAAC.aac', color: 'text-sky-400', bg: 'bg-sky-500', isLocked: false },

    // Hareketli Pop
    { id: 'superfm', name: 'Süper FM (Hit Pop)', category: 'Hareketli Pop', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FMAAC.aac', color: 'text-orange-400', bg: 'bg-orange-400', isLocked: false },
    { id: 'powerturk', name: 'PowerTürk (Hit Pop)', category: 'Hareketli Pop', url: 'https://listen.powerapp.com.tr/powerturk/mpeg/icecast.audio', color: 'text-red-400', bg: 'bg-red-500', isLocked: false },
    { id: 'kralpop', name: 'Kral Pop', category: 'Hareketli Pop', url: 'https://dygedge.radyotvonline.net/kralpop/playlist.m3u8', color: 'text-pink-400', bg: 'bg-pink-500', isLocked: false, isHls: true },
    { id: 'metrofm', name: 'Metro FM (Hit Yabancı)', category: 'Hareketli Pop', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FMAAC.aac', color: 'text-cyan-400', bg: 'bg-cyan-500', isLocked: false },

    // Klasik Müzik
    { id: 'borusanklasik', name: 'Borusan Klasik', category: 'Klasik Müzik', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/BORUSAN_KLASIK_SC', color: 'text-purple-400', bg: 'bg-purple-500', isLocked: false }
];

export function DraggableRadioWidget() {
    const [currentStation, setCurrentStation] = useState<Station>(STATIONS[0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [hasError, setHasError] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [showStations, setShowStations] = useState(false);
    const [playlistIndex, setPlaylistIndex] = useState(0);
    const [currentSongTitle, setCurrentSongTitle] = useState('');
    const [volume, setVolume] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('mufyard_radio_volume');
            return saved !== null ? Math.min(1, Math.max(0, Number(saved))) : 0.5;
        } catch {
            return 0.5;
        }
    });
    const [isMuted, setIsMuted] = useState(false);
    const [prevVolume, setPrevVolume] = useState(0.5);

    const destroyHls = () => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    };

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    useEffect(() => {
        return () => {
            destroyHls();
        };
    }, []);

    const playStream = (station: Station, pIndex: number) => {
        const audio = audioRef.current;
        if (!audio || station.isLocked) return;

        destroyHls();
        setHasError(false);
        audio.volume = isMuted ? 0 : volume;

        const streamUrl = station.id === 'lofi' ? MUFYARD_PLAYLIST[pIndex].url : station.url;

        if (station.isHls) {
            if (Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                });
                hlsRef.current = hls;
                hls.loadSource(streamUrl);
                hls.attachMedia(audio);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    audio.play().then(() => {
                        setIsPlaying(true);
                    }).catch(() => {
                        setHasError(true);
                        setIsPlaying(false);
                    });
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                        setHasError(true);
                        setIsPlaying(false);
                        destroyHls();
                    }
                });
            } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
                audio.src = streamUrl;
                audio.play().then(() => {
                    setIsPlaying(true);
                }).catch(() => {
                    setHasError(true);
                    setIsPlaying(false);
                });
            } else {
                setHasError(true);
                setIsPlaying(false);
            }
        } else {
            audio.src = streamUrl;
            audio.load();
            audio.play().then(() => {
                setIsPlaying(true);
            }).catch(() => {
                setHasError(true);
                setIsPlaying(false);
            });
        }

        if (station.id === 'lofi') {
            setCurrentSongTitle(MUFYARD_PLAYLIST[pIndex].name);
        } else {
            setCurrentSongTitle('');
        }
    };

    const stopStream = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        destroyHls();
        setIsPlaying(false);
    };

    const handleTrackEnd = () => {
        if (currentStation.id === 'lofi') {
            const nextIndex = (playlistIndex + 1) % MUFYARD_PLAYLIST.length;
            setPlaylistIndex(nextIndex);
            if (isPlaying) {
                playStream(currentStation, nextIndex);
            }
        } else {
            setIsPlaying(false);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        try {
            localStorage.setItem('mufyard_radio_volume', String(val));
        } catch {}
        if (val > 0 && isMuted) {
            setIsMuted(false);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isMuted) {
            setIsMuted(false);
            if (volume === 0) {
                const restored = prevVolume > 0 ? prevVolume : 0.5;
                setVolume(restored);
                try {
                    localStorage.setItem('mufyard_radio_volume', String(restored));
                } catch {}
            }
        } else {
            setPrevVolume(volume > 0 ? volume : 0.5);
            setIsMuted(true);
        }
    };

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentStation.isLocked) {
            toast.error("Yakında!", { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
            return;
        }

        if (isPlaying) {
            stopStream();
        } else {
            playStream(currentStation, playlistIndex);
            setShowInfo(true);
            const displayTitle = currentStation.id === 'lofi' ? MUFYARD_PLAYLIST[playlistIndex].name : currentStation.name;
            toast.success(`${displayTitle} yayında.`, {
                icon: '📻',
                style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '12px' }
            });
        }
    };

    const selectStation = (station: Station) => {
        if (station.isLocked) return;
        setCurrentStation(station);
        setShowStations(false);
        setHasError(false);
        if (isPlaying) {
            playStream(station, playlistIndex);
        }
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
                        className="mb-2 bg-slate-950/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)] min-w-[210px] max-w-[240px] flex flex-col"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="px-2.5 py-1.5 border-b border-slate-800/50 mb-1 flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Kanallar</span>
                            <span className="text-[9px] font-bold text-slate-500">{STATIONS.length} İstasyon</span>
                        </div>
                        <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto pr-1 select-none">
                            {STATIONS.map((station, index) => {
                                const isFirstOfCategory = index === 0 || STATIONS[index - 1].category !== station.category;
                                return (
                                    <div key={station.id} className="flex flex-col">
                                        {isFirstOfCategory && (
                                            <div className="px-2 pt-2 pb-1 text-[8px] font-extrabold uppercase tracking-wider text-slate-500">
                                                {station.category}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => selectStation(station)}
                                            className={cn(
                                                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all text-left active:scale-95",
                                                currentStation.id === station.id ? "bg-white/10" : "hover:bg-white/5",
                                                station.isLocked ? "opacity-30 grayscale" : ""
                                            )}
                                        >
                                            <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", station.bg)} />
                                            <span className={cn(
                                                "text-[11px] font-bold whitespace-nowrap truncate",
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
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info pill with integrated volume control (stacked vertically) */}
            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={cn(
                            "mb-2 flex flex-col gap-1.5 bg-slate-950/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all min-w-[170px]",
                            showStations && "border-violet-500/40"
                        )}
                    >
                        {/* Upper row: Station info - click to open channels */}
                        <button
                            type="button"
                            onClick={toggleStations}
                            className="flex items-center justify-between gap-2 text-left active:scale-95 transition-transform w-full"
                            title="Kanal Listesini Aç/Kapat"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", currentStation.bg)} />
                                <div className="flex flex-col items-start min-w-0">
                                    <span className="text-[10px] font-black text-white uppercase tracking-wider truncate max-w-[125px]">
                                        {currentStation.name}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-500 truncate max-w-[125px]">
                                        {hasError ? "Bağlantı Yok" : isPlaying ? (currentSongTitle || "Canlı Yayın") : "Hazır"}
                                    </span>
                                </div>
                            </div>
                            <ChevronUp size={12} className={cn(
                                "text-slate-500 transition-transform duration-200 flex-shrink-0",
                                showStations && "rotate-180 text-violet-400"
                            )} />
                        </button>

                        {/* Lower row: Volume Control directly under the station name */}
                        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800/70" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={toggleMute}
                                title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
                                className="p-0.5 rounded text-slate-400 hover:text-white transition-colors shrink-0"
                            >
                                {isMuted || volume === 0 ? (
                                    <VolumeX size={12} className="text-rose-400" />
                                ) : volume < 0.5 ? (
                                    <Volume1 size={12} className="text-slate-300" />
                                ) : (
                                    <Volume2 size={12} className="text-slate-300" />
                                )}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.02"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                title={`Ses Seviyesi: %${Math.round((isMuted ? 0 : volume) * 100)}`}
                                className="flex-1 min-w-[70px] h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400 focus:outline-none"
                            />
                            <span className="text-[8px] font-mono font-bold text-slate-400 w-5 text-right select-none shrink-0">
                                %{Math.round((isMuted ? 0 : volume) * 100)}
                            </span>
                        </div>
                    </motion.div>
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
                preload="none"
                onEnded={handleTrackEnd}
            />
        </motion.div>
    );
}
