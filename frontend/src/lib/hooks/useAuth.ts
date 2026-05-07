import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, sendPasswordResetEmail } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../firebase";
import { setOnline, removeOnline, removeOnlineBeacon } from "../api/online";

function resolveUserName(user: User | null, profile?: Profile | null) {
    if (profile?.full_name) return profile.full_name;
    if (!user) return "Kullanıcı";
    const displayName = (user.displayName || "").trim();
    if (displayName && displayName !== "Müfettiş" && displayName !== "Kullanıcı") {
        return displayName;
    }
    const emailPrefix = (user.email || "").split("@")[0]?.trim();
    return emailPrefix || user.email || "Kullanıcı";
}

import { fetchProfile, type Profile } from "../api/profiles";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    const prof = await fetchProfile(firebaseUser.uid, firebaseUser.email || undefined, firebaseUser.displayName || undefined);
                    setProfile(prof);
                } catch (e) {
                    console.error("Profile fetch error in useAuth:", e);
                }
            } else {
                setProfile(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user?.uid) return;

        const name = resolveUserName(user, profile);

        // İlk girişte online yaz
        setOnline(user.uid, name).catch(() => undefined);

        // Periyodik heartbeat: stale kayıt birikmesini engeller
        const heartbeat = setInterval(() => {
            setOnline(user.uid, resolveUserName(user, profile)).catch(() => undefined);
        }, 30000);

        // Sekme kapanmasında mümkünse beacon ile sil
        const handleBeforeUnload = () => {
            removeOnlineBeacon(user.uid);
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            clearInterval(heartbeat);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            removeOnline(user.uid).catch(() => undefined);
        };
    }, [user, profile]);

    const logout = async () => {
        try {
            // Önce online'dan kaldır
            if (user) {
                try {
                    await removeOnline(user.uid);
                } catch (e) {}
            }
            // Önce localStorage'ı temizle, sonra Firebase signOut yap
            localStorage.removeItem("demo_user");
            localStorage.removeItem("mufyard_assistant_messages");
            setUser(null);
            await firebaseSignOut(auth);
        } catch (error) {
            console.error("Çıkış yapılırken hata oluştu:", error);
        }
    };

    const resetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return { status: "success" };
        } catch (error: any) {
            console.error("Şifre sıfırlama hatası:", error);
            throw new Error(error.message || "Şifre sıfırlama e-postası gönderilemedi.");
        }
    };

    return { user, profile, loading, logout, resetPassword };
}
