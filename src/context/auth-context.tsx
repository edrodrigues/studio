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
            let msg = "Não foi possível entrar com Google.";
            
            // Map Firebase Auth error codes to user-friendly messages
            const errorMessages: Record<string, string> = {
                'auth/network-request-failed': "Erro de conexão. Verifique sua internet e tente novamente.",
                'auth/popup-closed-by-user': "Login cancelado. Você fechou a janela de login.",
                'auth/popup-blocked': "Pop-up bloqueado. Permitir pop-ups para este site.",
                'auth/cancelled-popup-request': "Login cancelado.",
                'auth/timeout': "Tempo de conexão esgotado. Tente novamente.",
            };
            
            msg = errorMessages[error.code] || msg;
            
            toast({
                variant: "destructive",
                title: "Erro no login",
                description: msg,
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
            
            // Map Firebase Auth error codes to user-friendly messages
            const errorMessages: Record<string, string> = {
                'auth/invalid-credential': "Credenciais inválidas.",
                'auth/user-not-found': "Usuário não encontrado.",
                'auth/wrong-password': "Senha incorreta.",
                'auth/network-request-failed': "Erro de conexão. Verifique sua internet e tente novamente.",
                'auth/too-many-requests': "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
                'auth/invalid-email': "E-mail inválido.",
                'auth/user-disabled': "Esta conta foi desativada.",
                'auth/timeout': "Tempo de conexão esgotado. Tente novamente.",
            };
            
            msg = errorMessages[error.code] || msg;
            
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
            
            // Map Firebase Auth error codes to user-friendly messages
            const errorMessages: Record<string, string> = {
                'auth/email-already-in-use': "Este e-mail já está em uso.",
                'auth/weak-password': "A senha é muito fraca.",
                'auth/network-request-failed': "Erro de conexão. Verifique sua internet e tente novamente.",
                'auth/too-many-requests': "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
                'auth/invalid-email': "E-mail inválido.",
                'auth/timeout': "Tempo de conexão esgotado. Tente novamente.",
            };
            
            msg = errorMessages[error.code] || msg;

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
