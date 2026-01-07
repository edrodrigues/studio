import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Política de Privacidade | Assistente V-Lab",
}

export default function PrivacyPage() {
    return (
        <div className="container mx-auto py-10 px-4 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Política de Privacidade</h1>
            <p className="mb-4 text-muted-foreground">Última atualização: 7 de janeiro de 2026</p>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">1. Coleta de Informações</h2>
                <p>Coletamos informações básicas de conta, como nome e e-mail, e os documentos que você cria no sistema.</p>

                <h2 className="text-xl font-semibold">2. Uso das Informações</h2>
                <p>Suas informações são utilizadas para fornecer e melhorar o serviço, autenticar seu acesso e gerenciar seus documentos.</p>

                <h2 className="text-xl font-semibold">3. Segurança dos Dados</h2>
                <p>Empregamos medidas de segurança para proteger suas informações contra acesso não autorizado.</p>

                <h2 className="text-xl font-semibold">4. Compartilhamento de Dados</h2>
                <p>Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins de marketing.</p>
            </section>
        </div>
    )
}
