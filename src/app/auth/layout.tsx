import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Autenticação | Assistente V-Lab",
    description: "Faça login ou crie sua conta.",
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
