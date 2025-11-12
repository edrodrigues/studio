import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex h-24 items-center justify-center">
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
      </div>
    </footer>
  );
}
