
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
import { LogOut, MessageSquare, User as UserIcon, Sparkles } from "lucide-react"
import { useAuthContext } from "@/context/auth-context"

const navLinks = [
  { href: "/", label: "Comece Aqui" },
  { href: "/documentos-iniciais", label: "Documentos Iniciais" },
  { href: "/modelos", label: "Gerenciar Modelos" },
  { href: "/gerar-novo", label: "Gerar Documentos" },
  { href: "/gerar-exportar", label: "Revisar Documentos" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = (href === "/" && pathname === "/") ||
    (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "relative transition-all duration-300 px-4 py-2 rounded-xl text-sm font-outfit font-medium flex items-center gap-2",
        isActive
          ? "text-primary bg-primary/10 shadow-inner"
          : "text-muted-foreground hover:text-primary hover:bg-primary/5"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="active-nav"
          className="absolute inset-0 bg-primary/5 rounded-xl -z-10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
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
        <Button variant="ghost" className="relative h-10 w-10 rounded-2xl hover:bg-primary/5 transition-colors">
          <Avatar className="h-9 w-9 border-2 border-primary/10">
            <AvatarImage src={user.photoURL || ""} alt={user.displayName || "User"} />
            <AvatarFallback className="bg-primary/5 text-primary font-bold">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 rounded-2xl p-2 glass dark:glass-dark border-border/50 shadow-2xl" align="end">
        <DropdownMenuLabel className="font-normal p-4">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-bold font-serif text-primary leading-none">{user.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground mt-1">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/5 focus:text-primary p-3">
          <Link href="/feedback" className="flex items-center w-full cursor-pointer">
            <MessageSquare className="mr-3 h-4 w-4" />
            <span className="font-outfit font-medium">Feedback</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem onClick={() => logout()} className="rounded-xl text-red-600 focus:text-red-700 focus:bg-red-50 p-3 cursor-pointer">
          <LogOut className="mr-3 h-4 w-4" />
          <span className="font-outfit font-medium">Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-3 group">
            <Logo />
            <span className="hidden font-serif font-bold text-lg text-primary tracking-tight leading-none group-hover:text-foreground transition-colors sm:inline-block">Assistente de Contratos V-Lab</span>
          </Link>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden lg:flex items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/40">
            {navLinks.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </nav>
          <div className="h-8 w-[1px] bg-border/40 mx-2 hidden lg:block" />
          <div className="flex items-center gap-3">
            <UserAccountNav />
          </div>
        </div>
      </div>
    </header>
  );
}
