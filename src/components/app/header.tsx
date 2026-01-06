
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut, User as UserIcon } from "lucide-react"
import { useAuthContext } from "@/context/auth-context"

const navLinks = [
  { href: "/", label: "Comece Aqui" },
  { href: "/documentos-iniciais", label: "Documentos Iniciais" },
  { href: "/modelos", label: "Gerenciar Modelos" },
  { href: "/gerar-novo", label: "Gerar Documentos" },
  { href: "/gerar-exportar", label: "Revisar Contratos" },
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

function UserAccountNav() {
  const { user, logout } = useAuthContext();

  if (!user) return null;

  const initials = user.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.photoURL || ""} alt={user.displayName || "User"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

        <nav className="ml-auto hidden md:flex items-center gap-4">
          <ul className="flex justify-end gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href} label={link.label} />
              </li>
            ))}
          </ul>
          <div className="border-l pl-4 ml-2">
            <UserAccountNav />
          </div>
        </nav>
      </div>
    </header>
  );
}
