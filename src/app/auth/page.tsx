"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm, SignUpForm } from "@/components/auth/auth-forms";
import { useAuthContext } from "@/context/auth-context";

export default function AuthenticationPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/projects");
    }
  }, [user, loading, router]);

  if (loading || user) return null;

  return (
    <main id="main" className="page-shell flex min-h-screen items-center">
      <div className="page-width-wide grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,28rem)] lg:items-stretch">
        <section className="surface-panel flex flex-col justify-between p-6 sm:p-8 lg:min-h-[42rem]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Área segura
            </div>
            <div className="space-y-4">
              <h1 className="max-w-xl text-3xl font-serif font-bold leading-tight tracking-tight text-primary sm:text-4xl lg:text-5xl">
                Entre para continuar o trabalho com projetos, modelos e revisão em um único fluxo.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                A experiência foi reorganizada para leitura mais confortável, melhor navegação móvel e acesso mais rápido às etapas principais do processo.
              </p>
            </div>
          </div>

          <div className="grid gap-4 pt-8 sm:grid-cols-3">
            <div className="surface-muted p-4">
              <p className="text-sm font-semibold text-foreground">Projetos centralizados</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Acompanhe documentos, contratos e equipe no mesmo contexto.</p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-sm font-semibold text-foreground">Geração com contexto</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Aproveite dados extraídos e modelos oficiais com mais clareza.</p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-sm font-semibold text-foreground">Experiência responsiva</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Navegue e revise também em telas menores, sem perder usabilidade.</p>
            </div>
          </div>
        </section>

        <section className="surface-panel p-5 sm:p-6 lg:p-8">
          <div className="mx-auto flex w-full max-w-md flex-col gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="text-2xl font-semibold tracking-tight">Acesso ao sistema</h2>
              <p className="text-sm leading-6 text-muted-foreground">Entre com sua conta ou crie um novo acesso para começar.</p>
            </div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Cadastrar</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="mt-4">
                <LoginForm />
              </TabsContent>
              <TabsContent value="register" className="mt-4">
                <SignUpForm />
              </TabsContent>
            </Tabs>

            <p className="text-center text-sm leading-6 text-muted-foreground">
              Ao continuar, você concorda com nossos{" "}
              <Link href="/terms" className="underline underline-offset-4 transition-colors hover:text-primary">
                Termos de Serviço
              </Link>{" "}
              e{" "}
              <Link href="/privacy" className="underline underline-offset-4 transition-colors hover:text-primary">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
