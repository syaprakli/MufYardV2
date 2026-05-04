import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, sendPasswordResetEmail } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../firebase";
import { setOnline, removeOnline } from "../api/online";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                setLoading(false);
                // Online olarak işaretle
                try {
                    await setOnline(firebaseUser.uid, firebaseUser.displayName || firebaseUser.email || "Kullanıcı");
                } catch (e) {
                    // Sessiz hata
                }
            } else {
                // Çıkışta online'dan kaldır
                if (user) {
                    try {
                        await removeOnline(user.uid);
                    } catch (e) {}
                }
                setUser(null);
                setLoading(false);
            }
        });
        return () => unsubscribe();
        // user dependency ile çıkışta da removeOnline çağrılır
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    return { user, loading, logout, resetPassword };
}
