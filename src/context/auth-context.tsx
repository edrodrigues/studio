"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    User,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile,
    AuthError
} from "firebase/auth";
import { useFirebase } from "@/firebase/provider";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, pass: string) => Promise<void>;
    signUpWithEmail: (name: string, email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { auth, user, isUserLoading } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    // We use local loading state to handle the action (signin/signup) loading as well
    // But primarily we rely on useFirebase for the initial check
    const [actionLoading, setActionLoading] = useState(false);

    const signInWithGoogle = async () => {
        if (!auth) return;
        setActionLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            toast({
                title: "Login realizado com sucesso",
                description: "Bem-vindo de volta!",
            });
            router.push("/");
        } catch (error: any) {
            console.error("Google Signin Error", error);
            toast({
                variant: "destructive",
                title: "Erro no login",
                description: error.message || "Não foi possível entrar com Google.",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const signInWithEmail = async (email: string, pass: string) => {
        if (!auth) return;
        setActionLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            toast({
                title: "Login realizado com sucesso",
                description: "Bem-vindo de volta!",
            });
            router.push("/");
        } catch (error: any) {
            console.error("Email Login Error", error);
            let msg = "Erro ao fazer login.";
            if (error.code === 'auth/invalid-credential') msg = "Credenciais inválidas.";
            if (error.code === 'auth/user-not-found') msg = "Usuário não encontrado.";
            if (error.code === 'auth/wrong-password') msg = "Senha incorreta.";
            toast({
                variant: "destructive",
                title: "Erro no login",
                description: msg,
            });
            // Re-throw to let form handle it if needed
            throw error;
        } finally {
            setActionLoading(false);
        }
    };

    const signUpWithEmail = async (name: string, email: string, pass: string) => {
        if (!auth) return;
        setActionLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(userCredential.user, {
                displayName: name
            });
            toast({
                title: "Conta criada com sucesso",
                description: `Bem-vindo, ${name}!`,
            });
            router.push("/");
        } catch (error: any) {
            console.error("Signup Error", error);
            let msg = "Erro ao criar conta.";
            if (error.code === 'auth/email-already-in-use') msg = "Este e-mail já está em uso.";
            if (error.code === 'auth/weak-password') msg = "A senha é muito fraca.";

            toast({
                variant: "destructive",
                title: "Erro no cadastro",
                description: msg,
            });
            throw error;
        } finally {
            setActionLoading(false);
        }
    };

    const logout = async () => {
        if (!auth) return;
        try {
            await firebaseSignOut(auth);
            toast({
                title: "Desconectado",
                description: "Você saiu da sua conta.",
            });
            router.push("/auth");
        } catch (error) {
            console.error("Logout Error", error);
        }
    };

    // Combine the loading states
    const loading = isUserLoading || actionLoading;

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            signInWithGoogle,
            signInWithEmail,
            signUpWithEmail,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuthContext must be used within an AuthProvider");
    }
    return context;
};
