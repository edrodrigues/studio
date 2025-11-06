
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Comece Aqui" },
  { href: "/documentos-iniciais", label: "Documentos Iniciais" },
  { href: "/modelos", label: "Gerenciar Modelos" },
  { href: "/gerar-exportar", label: "Contratos Gerados" },
];

function NavLink({ href, label }: { href: string; label: string }) {
    const pathname = usePathname();
    const isActive = (href === "/" && pathname === "/") || 
                     (href !== "/" && pathname.startsWith(href));


    return (
        <Link
            href={href}
            className={cn(
                "transition-colors hover:text-foreground text-sm px-3 py-2 rounded-md",
                isActive ? "text-primary font-semibold bg-primary/10" : "text-muted-foreground"
            )}
        >
            {label}
        </Link>
    );
}

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
            <span className="hidden font-bold sm:inline-block">Assistente de Contratos V-Lab</span>
          </Link>
        </div>

        <nav className="ml-auto hidden md:flex">
          <ul className="flex justify-end gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href} label={link.label} />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
