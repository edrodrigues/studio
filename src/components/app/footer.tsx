import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-background/95">
      <div className="page-shell py-6 sm:py-8">
        <div className="page-width flex flex-col gap-4 text-center sm:text-left lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-center gap-2 text-muted-foreground lg:justify-start">
            <span className="text-sm">Um produto</span>
            <Link
              href="https://www.cin.ufpe.br/~v-lab/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              V-Lab
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Termos de Serviço
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Política de Privacidade
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">© 2026 V-Lab UFPE</p>
        </div>
      </div>
    </footer>
  );
}
