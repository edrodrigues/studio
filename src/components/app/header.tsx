"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, FolderOpen, LogOut, Menu, MessageSquare } from "lucide-react";

import { Logo } from "@/components/app/logo";
import { NotificationsDropdown } from "@/components/app/notifications-dropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import { useProject } from "@/hooks/use-projects";

const navLinks = [
  { href: "/como-usar", label: "Comece Aqui" },
  { href: "/projects", label: "Meus Projetos" },
  { href: "/modelos", label: "Gerenciar Modelos" },
  { href: "/gerar-exportar", label: "Gerar & Revisar" },
];

function useProjectContext() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectIdFromPath = params?.projectId as string | undefined;
  const projectIdFromQuery = searchParams.get("projectId");
  return projectIdFromPath || projectIdFromQuery || undefined;
}

function getFinalHref(href: string, projectId?: string) {
  return projectId && href !== "/" && href !== "/como-usar" && href !== "/projects"
    ? `${href}?projectId=${projectId}`
    : href;
}

function NavLink({
  href,
  label,
  mobile = false,
  onNavigate,
}: {
  href: string;
  label: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const projectId = useProjectContext();

  const isActive =
    (href === "/como-usar" && pathname === "/como-usar") ||
    (href === "/projects" && pathname.startsWith("/projects")) ||
    (href !== "/" && href !== "/como-usar" && href !== "/projects" && pathname.startsWith(href));

  const finalHref = getFinalHref(href, projectId);

  return (
    <Link
      href={finalHref}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
        mobile
          ? isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted/40 text-foreground hover:bg-muted"
          : isActive
            ? "bg-primary/10 text-primary shadow-inner"
            : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
      )}
    >
      {!mobile && isActive ? (
        <motion.div
          layoutId="active-nav"
          className="absolute inset-0 -z-10 rounded-xl bg-primary/5"
          transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
        />
      ) : null}
      {label}
    </Link>
  );
}

function ProjectBreadcrumb({ mobile = false }: { mobile?: boolean }) {
  const projectId = useProjectContext();
  const { project, isLoading } = useProject(projectId ?? null);

  if (!projectId) return null;
  if (isLoading) {
    return <div className={cn("h-4 animate-pulse rounded-full bg-primary/10", mobile ? "w-full" : "ml-3 w-32")} />;
  }
  if (!project?.name) return null;

  if (mobile) {
    return (
      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Projeto Atual</p>
        <Link href={`/projects/${projectId}`} className="mt-2 block text-sm font-semibold text-primary">
          {project.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="ml-3 hidden items-center gap-1.5 text-sm lg:flex">
      <Link href="/projects" className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary">
        <FolderOpen className="h-3.5 w-3.5" />
        Projetos
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
      <Link
        href={`/projects/${projectId}`}
        className="max-w-[220px] truncate font-semibold text-primary transition-colors hover:text-primary/80"
        title={project.name}
      >
        {project.name}
      </Link>
    </div>
  );
}

function UserAccountNav() {
  const { user, logout } = useAuthContext();

  if (!user) return null;

  const initials =
    user.displayName
      ?.split(" ")
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-2xl hover:bg-primary/5"
          aria-label="Abrir menu da conta"
        >
          <Avatar className="h-9 w-9 border-2 border-primary/10">
            <AvatarImage src={user.photoURL || ""} alt={user.displayName || "Usuário"} />
            <AvatarFallback className="bg-primary/5 font-bold text-primary">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(18rem,calc(100vw-1rem))] rounded-2xl border-border/50 p-2 shadow-2xl" align="end">
        <DropdownMenuLabel className="p-4 font-normal">
          <div className="flex flex-col space-y-1">
            <p className="font-serif text-sm font-bold leading-none text-primary">{user.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-3 focus:bg-primary/5 focus:text-primary">
          <Link href="/feedback" className="flex w-full items-center">
            <MessageSquare className="mr-3 h-4 w-4" />
            <span className="font-medium">Feedback</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer rounded-xl p-3 text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="mr-3 h-4 w-4" />
          <span className="font-medium">Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavigation() {
  const projectId = useProjectContext();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-2xl lg:hidden" aria-label="Abrir navegação">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col gap-6">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-3">
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <ProjectBreadcrumb mobile />
        <nav className="flex flex-col gap-3">
          {navLinks.map((link) => (
            <SheetClose asChild key={link.href}>
              <div>
                <NavLink href={link.href} label={link.label} mobile />
              </div>
            </SheetClose>
          ))}
        </nav>
        {projectId ? (
          <div className="mt-auto rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Atalho</p>
            <SheetClose asChild>
              <Link href={`/projects/${projectId}`} className="mt-2 block text-sm font-semibold text-primary">
                Voltar ao projeto
              </Link>
            </SheetClose>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/90 backdrop-blur-xl safe-top">
      <div className="page-shell py-3 sm:py-4">
        <div className="page-width-wide flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <MobileNavigation />
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <Logo />
              <span className="hidden text-sm font-semibold tracking-tight text-primary sm:inline-block lg:text-base">
                Assistente de Contratos V-Lab
              </span>
            </Link>
            <ProjectBreadcrumb />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="hidden items-center gap-2 rounded-2xl border border-border/40 bg-muted/30 p-1.5 lg:flex">
              {navLinks.map((link) => (
                <NavLink key={link.href} href={link.href} label={link.label} />
              ))}
            </nav>
            <NotificationsDropdown />
            <UserAccountNav />
          </div>
        </div>
      </div>
    </header>
  );
}
