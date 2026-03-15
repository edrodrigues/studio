import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Shield, FileText, Lock, Eye, Trash2, Mail } from "lucide-react"

export const metadata: Metadata = {
    title: "Política de Privacidade | Assistente V-Lab",
}

export default function PrivacyPage() {
    return (
        <main id="main" className="min-h-screen bg-background">
            <div className="container mx-auto py-10 px-4 max-w-4xl">
                <div className="mb-8">
                    <Button variant="ghost" size="sm" asChild className="mb-4">
                        <Link href="/" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Voltar
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className="h-8 w-8 text-primary" />
                        <h1 className="text-3xl font-bold">Política de Privacidade</h1>
                    </div>
                    <p className="text-muted-foreground">Última atualização: 15 de março de 2026</p>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none">
                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">1. Informações que Coletamos</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p><strong>Informações de conta:</strong> Nome, e-mail e dados de autenticação quando você cria uma conta.</p>
                            <p><strong>Documentos:</strong> Arquivos e conteúdos que você envia ou cria em nossa plataforma.</p>
                            <p><strong>Dados de uso:</strong> Informações sobre como você interage com o sistema, como funcionalidades acessadas e tempo de uso.</p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Lock className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">2. Como Usamos suas Informações</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Fornecer e manter nossos serviços de assistência em contratos.</p>
                            <p>Processar e analisar documentos utilizando nossa tecnologia de IA.</p>
                            <p>Autenticar seu acesso e garantir a segurança da sua conta.</p>
                            <p>Melhorar continuamente nossos algoritmos e funcionalidades.</p>
                            <p>Comunicar atualizações importantes sobre o serviço.</p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Eye className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">3. Compartilhamento de Dados</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros para fins de marketing.</p>
                            <p>Podemos compartilhar dados com:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Prestadores de serviços que nos auxiliam na operação (ex: armazenamento em nuvem)</li>
                                <li>Autoridades legais, quando exigido por lei ou ordem judicial</li>
                                <li>Parceiros de pesquisa acadêmica (dados anonimizados apenas)</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Lock className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">4. Segurança dos Dados</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Implementamos medidas técnicas e organizacionais robustas para proteger suas informações:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Criptografia de dados em trânsito e em repouso</li>
                                <li>Autenticação segura via Firebase</li>
                                <li>Controles de acesso rigorosos</li>
                                <li>Monitoramento contínuo de segurança</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Trash2 className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">5. Retenção e Exclusão</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Mantemos seus dados apenas pelo tempo necessário para fornecer os serviços ou cumprir obrigações legais.</p>
                            <p>Você pode solicitar a exclusão de sua conta e dados a qualquer momento através das configurações do perfil ou entrando em contato conosco.</p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Mail className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">6. Contato</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Para questões sobre privacidade ou exercer seus direitos:</p>
                            <p>Email: <a href="mailto:vlab@cin.ufpe.br" className="text-primary hover:underline">vlab@cin.ufpe.br</a></p>
                            <p>Endereço: Centro de Informática - UFPE, Recife, PE, Brasil</p>
                        </div>
                    </section>
                </div>

                <div className="mt-12 pt-8 border-t">
                    <p className="text-sm text-muted-foreground text-center">
                        Ao utilizar o Assistente de Contratos V-Lab, você concorda com esta Política de Privacidade.
                    </p>
                </div>
            </div>
        </main>
    )
}
