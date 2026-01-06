import { Metadata } from "next"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoginForm, SignUpForm } from "@/components/auth/auth-forms"

export const metadata: Metadata = {
    title: "Autenticação | Assistente V-Lab",
    description: "Faça login ou crie sua conta.",
}

export default function AuthenticationPage() {
    return (
        <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            <div className="relative hidden h-full flex-col bg-[#1A1A1A] text-white lg:flex dark:border-r">
                <div className="absolute inset-0 bg-[#1A1A1A]" />

                <div className="relative z-20 flex h-full flex-col items-center justify-center">
                    <div className="flex flex-col items-center">
                        <div className="flex items-end leading-none">
                            <span className="text-8xl font-bold tracking-tighter text-white">V-Lab</span>
                        </div>
                        <div className="mt-2 rounded-sm bg-[#86EFAC] px-3 py-0.5">
                            <span className="text-xl font-bold uppercase tracking-widest text-[#1A1A1A]">UFPE</span>
                        </div>
                    </div>
                </div>

                <div className="relative z-20 flex flex-col items-center gap-1 pb-16">
                    <p className="text-2xl font-bold tracking-tight">@vlabufpe</p>
                    <p className="flex items-center gap-1 text-lg text-gray-400">
                        <span className="text-xl">*</span>
                        <span>/vlabufpe</span>
                    </p>
                </div>
            </div>
            <div className="lg:p-8">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Acesso ao Sistema
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Entre com sua conta ou crie uma nova.
                        </p>
                    </div>

                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="login">Entrar</TabsTrigger>
                            <TabsTrigger value="register">Cadastrar</TabsTrigger>
                        </TabsList>
                        <TabsContent value="login">
                            <LoginForm />
                        </TabsContent>
                        <TabsContent value="register">
                            <SignUpForm />
                        </TabsContent>
                    </Tabs>

                    <p className="px-8 text-center text-sm text-muted-foreground">
                        Ao clicar em continuar, você concorda com nossos{" "}
                        <Link
                            href="/terms"
                            className="underline underline-offset-4 hover:text-primary"
                        >
                            Termos de Serviço
                        </Link>{" "}
                        e{" "}
                        <Link
                            href="/privacy"
                            className="underline underline-offset-4 hover:text-primary"
                        >
                            Política de Privacidade
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </div>
    )
}
