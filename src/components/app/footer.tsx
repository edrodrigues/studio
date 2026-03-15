import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container py-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm">Um produto</span>
            <Link
              href="https://www.cin.ufpe.br/~v-lab/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground hover:underline"
            >
              V-Lab
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Termos de Serviço
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Política de Privacidade
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">
            © 2026 V-Lab UFPE
          </p>
        </div>
      </div>
    </footer>
  );
}
