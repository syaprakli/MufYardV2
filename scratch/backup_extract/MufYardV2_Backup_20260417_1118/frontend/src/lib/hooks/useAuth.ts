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
                // Demo persistence check (Optional but kept for safety)
                if (firebaseUser.uid === "demo-user-123") {
                    localStorage.setItem("demo_user", JSON.stringify(firebaseUser));
                }
                setLoading(false);
            } else {
                // If NO Firebase user, check for Demo User in localStorage
                const demoUser = localStorage.getItem("demo_user");
                if (demoUser) {
                    try {
                        setUser(JSON.parse(demoUser));
                    } catch (e) {
                        setUser(null);
                        localStorage.removeItem("demo_user");
                    }
                } else {
                    setUser(null);
                }
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
