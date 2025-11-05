import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background/80 glass">
      <div className="container flex h-24 items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-sm">Um produto da</span>
          <Link
            href="https://viitra.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-foreground hover:underline"
          >
            Viitra Inovações
          </Link>
        </div>
      </div>
    </footer>
  );
}
