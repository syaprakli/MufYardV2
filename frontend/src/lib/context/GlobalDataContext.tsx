import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchStats } from '../api';
import { fetchTasks } from '../api/tasks';
import { fetchProfile } from '../api/profiles';
import { fetchAudits } from '../api/audit';
import { fetchInspectors } from '../api/inspectors';

import { fetchContacts } from '../api/contacts';

interface GlobalData {
    stats: any;
    tasks: any[];
    profile: any;
    audits: any[];
    contactsCorporate: any[];
    contactsPersonal: any[];
    lastFetched: number | null;
}

interface GlobalDataContextType {
    data: GlobalData;
    loading: boolean;
    refreshAll: (uid: string, email?: string, displayName?: string, force?: boolean) => Promise<void>;
    refreshTasks: (uid: string) => Promise<void>;
    refreshAudits: (uid: string, email?: string) => Promise<void>;
    refreshContactsCorporate: () => Promise<void>;
    refreshContactsPersonal: (uid: string, email?: string) => Promise<void>;
}

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

export const GlobalDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [data, setData] = useState<GlobalData>({
        stats: null,
        tasks: [],
        profile: null,
        audits: [],
        contactsCorporate: [],
        contactsPersonal: [],
        lastFetched: null,
    });
    const [loading, setLoading] = useState(false);

    const refreshAll = useCallback(async (uid: string, email?: string, displayName?: string, force = false) => {
        const CACHE_TIME = 5 * 60 * 1000;
        if (!force && data.lastFetched && Date.now() - data.lastFetched < CACHE_TIME && data.profile?.uid === uid) {
            return;
        }

        setLoading(true);
        try {
            const [statsRes, tasksRes, profileRes, auditsRes, contactsCorpRes, contactsPersRes] = await Promise.allSettled([
                fetchStats(uid),
                fetchTasks(uid),
                fetchProfile(uid, email, displayName),
                fetchAudits(uid, email, true),
                fetchInspectors(),
                fetchContacts('personal', uid, email)
            ]);

            setData({
                stats: statsRes.status === 'fulfilled' ? statsRes.value : { stats: [], news: [], forum_posts: [] },
                tasks: tasksRes.status === 'fulfilled' ? tasksRes.value : [],
                profile: profileRes.status === 'fulfilled' ? profileRes.value : null,
                audits: auditsRes.status === 'fulfilled' ? auditsRes.value : [],
                contactsCorporate: contactsCorpRes.status === 'fulfilled' ? contactsCorpRes.value : [],
                contactsPersonal: contactsPersRes.status === 'fulfilled' ? contactsPersRes.value : [],
                lastFetched: Date.now(),
            });
        } catch (error) {
            console.error("Global data fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [data.lastFetched, data.profile?.uid]);

    const refreshTasks = useCallback(async (uid: string) => {
        try {
            const tasks = await fetchTasks(uid);
            setData(prev => ({ ...prev, tasks }));
        } catch (error) {
            console.error("Tasks refresh error:", error);
        }
    }, []);

    const refreshAudits = useCallback(async (uid: string, email?: string) => {
        try {
            const audits = await fetchAudits(uid, email, true);
            setData(prev => ({ ...prev, audits }));
        } catch (error) {
            console.error("Audits refresh error:", error);
        }
    }, []);

    const refreshContactsCorporate = useCallback(async () => {
        try {
            const contactsCorporate = await fetchInspectors();
            setData(prev => ({ ...prev, contactsCorporate }));
        } catch (error) {
            console.error("Corporate contacts refresh error:", error);
        }
    }, []);

    const refreshContactsPersonal = useCallback(async (uid: string, email?: string) => {
        try {
            const contactsPersonal = await fetchContacts('personal', uid, email);
            setData(prev => ({ ...prev, contactsPersonal }));
        } catch (error) {
            console.error("Personal contacts refresh error:", error);
        }
    }, []);

    return (
        <GlobalDataContext.Provider value={{ data, loading, refreshAll, refreshTasks, refreshAudits, refreshContactsCorporate, refreshContactsPersonal }}>
            {children}
        </GlobalDataContext.Provider>
    );
};

export const useGlobalData = () => {
    const context = useContext(GlobalDataContext);
    if (context === undefined) {
        throw new Error('useGlobalData must be used within a GlobalDataProvider');
    }
    return context;
};
