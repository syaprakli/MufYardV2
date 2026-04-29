import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, sendPasswordResetEmail } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../firebase";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                setLoading(false);
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            // Önce localStorage'ı temizle, sonra Firebase signOut yap
            // Bu sıra önemli: App.tsx'teki onAuthStateChanged callback'i
            // demo_user'ı bulamasın diye önce siliyoruz
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
