import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Scale, FileCheck, Users, Lock, AlertTriangle, Mail } from "lucide-react"

export const metadata: Metadata = {
    title: "Termos de Serviço | Assistente V-Lab",
}

export default function TermsPage() {
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
                        <Scale className="h-8 w-8 text-primary" />
                        <h1 className="text-3xl font-bold">Termos de Serviço</h1>
                    </div>
                    <p className="text-muted-foreground">Última atualização: 15 de março de 2026</p>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none">
                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <FileCheck className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">1. Aceitação dos Termos</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Ao acessar ou usar o Assistente de Contratos V-Lab, você concorda em cumprir estes Termos de Serviço e todas as leis e regulamentos aplicáveis. Se você não concordar com qualquer parte destes termos, não poderá usar o serviço.</p>
                            <p>Estes termos constituem um acordo legal entre você e o V-Lab/UFPE.</p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">2. Elegibilidade</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Você deve ter pelo menos 18 anos de idade para usar este serviço. Ao criar uma conta, você declara e garante que:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Tem capacidade legal para celebrar contratos</li>
                                <li>Fornecerá informações verdadeiras, precisas e completas</li>
                                <li>Manterá a confidencialidade de suas credenciais de acesso</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Scale className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">3. Natureza do Serviço</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>O Assistente de Contratos V-Lab é uma ferramenta de suporte baseada em inteligência artificial para auxiliar na elaboração e gestão de documentos contratuais.</p>
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 my-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">Aviso Importante</p>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                            Este serviço não constitui aconselhamento jurídico profissional. Os documentos gerados devem ser revisados por advogados qualificados antes de sua utilização. O V-Lab não se responsabiliza pela adequação ou validade jurídica dos contratos criados.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Lock className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">4. Conta e Segurança</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Você é responsável por:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Manter a confidencialidade de sua senha e credenciais</li>
                                <li>Todas as atividades que ocorram em sua conta</li>
                                <li>Notificar imediatamente qualquer uso não autorizado</li>
                                <li>Garantir que suas informações de conta estejam atualizadas</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <FileCheck className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">5. Propriedade Intelectual</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Todo o conteúdo, software, tecnologia e materiais disponíveis no Assistente de Contratos são de propriedade exclusiva do V-Lab/UFPE ou de seus licenciadores, protegidos por leis de direitos autorais e propriedade intelectual.</p>
                            <p>Você mantém todos os direitos sobre os documentos que cria usando nossa plataforma. Concedemos a você uma licença limitada para usar o serviço de acordo com estes termos.</p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">6. Limitação de Responsabilidade</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>O V-Lab não será responsável por:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Danos diretos, indiretos, incidentais ou consequenciais</li>
                                <li>Perda de dados, lucros ou oportunidades de negócio</li>
                                <li>Erros ou omissões no conteúdo gerado pela IA</li>
                                <li>Interrupções ou indisponibilidade do serviço</li>
                                <li>Decisões tomadas com base nos documentos gerados</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <FileCheck className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">7. Modificações</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas serão notificadas através do serviço ou por e-mail. O uso continuado após as alterações constitui aceitação dos novos termos.</p>
                        </div>
                    </section>

                    <section className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Mail className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold m-0">8. Contato</h2>
                        </div>
                        <div className="pl-7 space-y-3 text-muted-foreground">
                            <p>Para dúvidas sobre estes termos:</p>
                            <p>Email: <a href="mailto:vlab@cin.ufpe.br" className="text-primary hover:underline">vlab@cin.ufpe.br</a></p>
                            <p>Endereço: Centro de Informática - UFPE, Recife, PE, Brasil</p>
                        </div>
                    </section>
                </div>

                <div className="mt-12 pt-8 border-t">
                    <p className="text-sm text-muted-foreground text-center">
                        Ao utilizar o Assistente de Contratos V-Lab, você confirma que leu, entendeu e concorda com estes Termos de Serviço.
                    </p>
                </div>
            </div>
        </main>
    )
}
