"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Comece Aqui" },
  { href: "/documentos-iniciais", label: "Documentos Iniciais" },
  { href: "/modelos", label: "Gerenciar Modelos" },
  { href: "/gerar-exportar", label: "Gerar e Exportar" },
];

function NavLink({ href, label }: { href: string; label: string }) {
    const pathname = usePathname();
    const isActive = (href === "/" && pathname === "/") || (href !== "/" && pathname.startsWith(href));

    return (
        <Link
            href={href}
            className={cn(
                "transition-colors hover:text-secondary",
                isActive ? "text-secondary font-semibold" : "text-muted-foreground"
            )}
        >
            {label}
        </Link>
    );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
            <span className="hidden font-bold sm:inline-block">Assistente de Contratos</span>
          </Link>
        </div>

        <nav className="flex-1">
          <ul className="flex justify-center gap-4 lg:gap-6">
            {navLinks.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href} label={link.label} />
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="flex items-center justify-end" style={{ flexBasis: '200px' }}>
          {/* Placeholder for potential user avatar or actions */}
        </div>
      </div>
    </header>
  );
}
