import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Termos de Serviço | Assistente V-Lab",
}

export default function TermsPage() {
    return (
        <div className="container mx-auto py-10 px-4 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Termos de Serviço</h1>
            <p className="mb-4 text-muted-foreground">Última atualização: 7 de janeiro de 2026</p>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">1. Aceitação dos Termos</h2>
                <p>Ao acessar e usar o Assistente de Contratos V-Lab, você concorda em cumprir e estar vinculado a estes Termos de Serviço.</p>

                <h2 className="text-xl font-semibold">2. Uso do Serviço</h2>
                <p>O Assistente de Contratos é uma ferramenta para auxiliar na criação e gerenciamento de minutas de contratos. O uso desta ferramenta não substitui o aconselhamento jurídico profissional.</p>

                <h2 className="text-xl font-semibold">3. Propriedade Intelectual</h2>
                <p>Todo o conteúdo e tecnologia do sistema são de propriedade do V-Lab / UFPE ou de seus licenciadores.</p>

                <h2 className="text-xl font-semibold">4. Limitação de Responsabilidade</h2>
                <p>O V-Lab não se responsabiliza por quaisquer danos resultantes do uso ou da incapacidade de usar este serviço, ou por quaisquer erros no conteúdo gerado.</p>
            </section>
        </div>
    )
}
