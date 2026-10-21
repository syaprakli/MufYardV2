import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { fetchStats } from '../api';
import { fetchProfile } from '../api/profiles';
import { fetchContacts } from '../api/contacts';
import * as tasksApi from '../api/tasks';
import * as auditsApi from '../api/audit';
import * as notesApi from '../api/notes';
import { getQueue, processQueue } from '../api/syncQueue';

const API_MAP = {
    'updateTask': tasksApi.updateTask,
    'updateAudit': auditsApi.updateAudit,
    'createNote': notesApi.createNote,
    // Add more as needed
};

interface GlobalData {
    stats: any;
    tasks: any[];
    profile: any;
    audits: any[];
    contactsCorporate: any[];
    contactsPersonal: any[];
    lastFetched: number | null;
    trialDaysLeft: number;
    isTrialExpired: boolean;
    trialStarted: boolean;
}

interface GlobalDataContextType {
    data: GlobalData;
    loading: boolean;
    isOffline: boolean;
    trialDaysLeft: number;
    isTrialExpired: boolean;
    refreshAll: (uid: string, email?: string, displayName?: string, force?: boolean) => Promise<void>;
    refreshProfile: (uid: string, email?: string, displayName?: string) => Promise<any>;
    refreshTasks: (uid: string, force?: boolean) => Promise<void>;
    refreshAudits: (uid: string, email?: string) => Promise<void>;
    refreshContactsCorporate: () => Promise<void>;
    refreshContactsPersonal: (uid: string, email?: string) => Promise<void>;
}

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

const TEST_UID = "tolEIwlWrHfWCQduDuXcnqBvWdo2";
const TEST_EMAIL = "test@mufyard.com";

function isTestAccount(uid?: string, email?: string): boolean {
    if (!uid && !email) return false;
    const lowerEmail = (email || "").toLowerCase().trim();
    return uid === TEST_UID || lowerEmail === TEST_EMAIL;
}

function sanitizeForUser<T extends Record<string, any>>(list: T[], isTest: boolean): T[] {
    if (!Array.isArray(list)) return [];
    if (isTest) return list;
    return list.filter(item => {
        const owner = (item.owner_id || "").toString().toLowerCase().trim();
        const itemEmail = (item.email || "").toString().toLowerCase().trim();
        const assigned = Array.isArray(item.assigned_to) 
            ? item.assigned_to.map((a: any) => String(a).toLowerCase().trim()) 
            : [];
        const shared = Array.isArray(item.shared_with) 
            ? item.shared_with.map((s: any) => String(s).toLowerCase().trim()) 
            : [];
        const accepted = Array.isArray(item.accepted_collaborators) 
            ? item.accepted_collaborators.map((s: any) => String(s).toLowerCase().trim()) 
            : [];

        const testIds = [TEST_UID.toLowerCase(), TEST_EMAIL];
        if (testIds.includes(owner)) return false;
        if (itemEmail === TEST_EMAIL) return false;
        if (assigned.some(a => testIds.includes(a))) return false;
        if (shared.some(s => testIds.includes(s))) return false;
        if (accepted.some(s => testIds.includes(s))) return false;
        return true;
    });
}

// --- Stale-while-revalidate: load persisted cache from localStorage immediately ---
function loadPersistedCache(uid: string): Partial<GlobalData> {
    const isTest = isTestAccount(uid);
    try {
        const tasks = (() => {
            const raw = localStorage.getItem(`mufyard_tasks_cache_${uid}`);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const list = Array.isArray(parsed.data) ? parsed.data : [];
            return sanitizeForUser(list, isTest);
        })();
        const audits = (() => {
            const raw = localStorage.getItem(`mufyard_audits_cache_${uid}`);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const list = Array.isArray(parsed.data) ? parsed.data : [];
            return sanitizeForUser(list, isTest);
        })();
        const profile = (() => {
            const raw = localStorage.getItem(`mufyard_profile_cache_${uid}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.data || null;
        })();
        return { tasks, audits, profile };
    } catch {
        return {};
    }
}

export const GlobalDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [data, setData] = useState<GlobalData>({
        stats: null,
        tasks: [],
        profile: null,
        audits: [],
        contactsCorporate: [],
        contactsPersonal: [],
        lastFetched: null,
        trialDaysLeft: 9999,
        isTrialExpired: false,
        trialStarted: true,
    });
    const [loading, setLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const lastFetchedRef = useRef<number | null>(null);
    const currentUidRef = useRef<string | null>(null);
    const cacheInjectedRef = useRef<string | null>(null);

    React.useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);


    const refreshAll = useCallback(async (uid: string, email?: string, displayName?: string, force = false) => {
        const CACHE_TIME = 5 * 60 * 1000;

        // --- Stale-while-revalidate: inject localStorage cache immediately on first call ---
        if (cacheInjectedRef.current !== uid) {
            cacheInjectedRef.current = uid;
            const persisted = loadPersistedCache(uid);
            setData(prev => ({
                ...prev,
                tasks: persisted.tasks || [],
                audits: persisted.audits || [],
                profile: persisted.profile || null,
            }));
        }
        
        if (!force && 
            lastFetchedRef.current && 
            (Date.now() - lastFetchedRef.current < CACHE_TIME) && 
            currentUidRef.current === uid
        ) {
            return;
        }

        setLoading(true);
        try {
            const [statsRes, tasksRes, profileRes, auditsRes, contactsCorpRes, contactsPersRes] = await Promise.allSettled([
                fetchStats(uid),
                tasksApi.fetchTasks(uid, undefined, force),
                fetchProfile(uid, email, displayName),
                auditsApi.fetchAudits(uid, email, true),
                fetchContacts('corporate'),
                fetchContacts('personal', uid, email)
            ]);

            const now = Date.now();
            const profileData = profileRes.status === 'fulfilled' ? profileRes.value : null;
            const isTest = isTestAccount(uid, email || profileData?.email);
            
            // Current user identity keys for filtering
            const myUid = uid;
            const myEmail = (email || profileData?.email || "").toLowerCase().trim();
            const myKeys = [myUid, myEmail].filter(Boolean);

            const filterMe = (list: any[]) => {
                if (!Array.isArray(list)) return [];
                return list.filter(item => {
                    const itemUid = item.uid || item.id;
                    const itemEmail = (item.email || "").toLowerCase().trim();
                    const itemKeys = [itemUid, itemEmail].filter(Boolean);
                    return !itemKeys.some(k => myKeys.includes(k));
                });
            };
            
            // Trial akisi kapatildi: tum kullanicilar icin deneme kisitlari pasif.
            const daysLeft = 9999;
            const finalExpired = false;

            const rawTasks = tasksRes.status === 'fulfilled' ? tasksRes.value : [];
            const rawAudits = auditsRes.status === 'fulfilled' ? auditsRes.value : [];
            const rawCorp = contactsCorpRes.status === 'fulfilled' ? contactsCorpRes.value : [];
            const rawPers = contactsPersRes.status === 'fulfilled' ? contactsPersRes.value : [];
            
            if (profileData) {
                setData({
                    stats: statsRes.status === 'fulfilled' ? statsRes.value : { stats: [], news: [], forum_posts: [] },
                    tasks: sanitizeForUser(rawTasks, isTest),
                    profile: profileData,
                    audits: sanitizeForUser(rawAudits, isTest),
                    contactsCorporate: filterMe(sanitizeForUser(rawCorp, isTest)),
                    contactsPersonal: filterMe(sanitizeForUser(rawPers, isTest)),
                    lastFetched: now,
                    trialDaysLeft: daysLeft,
                    isTrialExpired: finalExpired,
                    trialStarted: true
                });
            } else {
                // Profil yüklenemediyse varsayılan değerler
                setData(prev => ({
                    ...prev,
                    stats: statsRes.status === 'fulfilled' ? statsRes.value : prev.stats,
                    tasks: sanitizeForUser(rawTasks, isTest),
                    audits: sanitizeForUser(rawAudits, isTest),
                }));
            }
            lastFetchedRef.current = now;
            currentUidRef.current = uid;
        } catch (error) {
            console.error("Global data fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, []); 

    // Sync queue processing handled by triggerQueueSync listeners above

    const refreshTasks = useCallback(async (uid: string, force = true) => {
        try {
            const tasks = await tasksApi.fetchTasks(uid, undefined, force);
            const isTest = isTestAccount(uid);
            setData(prev => ({ ...prev, tasks: sanitizeForUser(tasks, isTest) }));
        } catch (error) {
            console.error("Tasks refresh error:", error);
        }
    }, []);

    const refreshAudits = useCallback(async (uid: string, email?: string) => {
        try {
            const audits = await auditsApi.fetchAudits(uid, email, true);
            const isTest = isTestAccount(uid, email);
            setData(prev => ({ ...prev, audits: sanitizeForUser(audits, isTest) }));
        } catch (error) {
            console.error("Audits refresh error:", error);
        }
    }, []);

    const refreshContactsCorporate = useCallback(async () => {
        try {
            const contactsCorporate = await fetchContacts('corporate');
            const isTest = isTestAccount(currentUidRef.current || undefined);
            const sanitized = sanitizeForUser(contactsCorporate, isTest);
            // Current user filter in individual refresh
            const myKeys = [currentUidRef.current].filter(Boolean) as string[];
            const filtered = sanitized.filter((item: any) => {
                const itemUid = item.uid || item.id;
                const itemEmail = (item.email || "").toLowerCase().trim();
                return !myKeys.includes(itemUid) && !myKeys.some(k => itemEmail === k.toLowerCase());
            });
            setData(prev => ({ ...prev, contactsCorporate: filtered }));
        } catch (error) {
            console.error("Corporate contacts refresh error:", error);
        }
    }, []);

    const refreshContactsPersonal = useCallback(async (uid: string, email?: string) => {
        try {
            const contactsPersonal = await fetchContacts('personal', uid, email);
            const isTest = isTestAccount(uid, email);
            const sanitized = sanitizeForUser(contactsPersonal, isTest);
            const myKeys = [uid, email?.toLowerCase()].filter(Boolean) as string[];
            const filtered = sanitized.filter((item: any) => {
                const itemUid = item.uid || item.id;
                const itemEmail = (item.email || "").toLowerCase().trim();
                return !myKeys.includes(itemUid) && !myKeys.includes(itemEmail);
            });
            setData(prev => ({ ...prev, contactsPersonal: filtered }));
        } catch (error) {
            console.error("Personal contacts refresh error:", error);
        }
    }, []);

    const syncInProgressRef = useRef(false);

    const triggerQueueSync = useCallback(async (forceRefresh = true) => {
        if (syncInProgressRef.current || !navigator.onLine) return;
        if (getQueue().length === 0) return;

        syncInProgressRef.current = true;
        try {
            await processQueue(API_MAP);
            if (forceRefresh && currentUidRef.current) {
                refreshAll(currentUidRef.current, undefined, undefined, true);
            }
        } finally {
            syncInProgressRef.current = false;
        }
    }, [refreshAll]);

    React.useEffect(() => {
        const handleQueueUpdated = () => {
            void triggerQueueSync();
        };

        const handleFocus = () => {
            void triggerQueueSync();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                void triggerQueueSync();
            }
        };

        window.addEventListener('mufyard-queue-updated', handleQueueUpdated as EventListener);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        const interval = window.setInterval(() => {
            void triggerQueueSync();
        }, 30000);

        void triggerQueueSync();

        return () => {
            window.removeEventListener('mufyard-queue-updated', handleQueueUpdated as EventListener);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.clearInterval(interval);
        };
    }, [triggerQueueSync]);

    const refreshProfile = useCallback(async (uid: string, email?: string, displayName?: string) => {
        try {
            const profile = await fetchProfile(uid, email, displayName);
            setData(prev => ({ ...prev, profile }));
            return profile;
        } catch (error) {
            console.error("Profile refresh error:", error);
            return null;
        }
    }, []);

    return (
        <GlobalDataContext.Provider value={{ 
            data, 
            loading, 
            isOffline, 
            trialDaysLeft: data.trialDaysLeft,
            isTrialExpired: data.isTrialExpired,
            refreshAll, 
            refreshProfile, 
            refreshTasks, 
            refreshAudits, 
            refreshContactsCorporate, 
            refreshContactsPersonal 
        }}>
            {children}
        </GlobalDataContext.Provider>
    );
};

export const useGlobalData = () => {
    const context = useContext(GlobalDataContext);
    if (context === undefined) {
        // Fallback to default state instead of crashing
        return {
            data: {
                stats: null,
                tasks: [],
                profile: null,
                audits: [],
                contactsCorporate: [],
                contactsPersonal: [],
                lastFetched: null,
                trialDaysLeft: 9999,
                isTrialExpired: false,
                trialStarted: true
            },
            loading: false,
            isOffline: false,
            trialDaysLeft: 9999,
            isTrialExpired: false,
            refreshAll: async () => {},
            refreshProfile: async () => {},
            refreshTasks: async () => {},
            refreshAudits: async () => {},
            refreshContactsCorporate: async () => {},
            refreshContactsPersonal: async () => {}
        } as GlobalDataContextType;
    }
    return context;
};
