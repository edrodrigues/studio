"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, FilePlus, FolderOpen, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { href: "/como-usar", label: "Comece Aqui", icon: Home },
  { href: "/projects", label: "Documentos", icon: FolderOpen },
  { href: "/gerar-exportar", label: "Gerar & Revisar", icon: FilePlus },
];

function Step({
  icon: Icon,
  label,
  isActive,
  isCompleted,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  isCompleted: boolean;
}) {
  return (
    <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border transition-colors sm:h-10 sm:w-10",
          isActive
            ? "border-primary bg-primary text-primary-foreground"
            : isCompleted
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground"
        )}
      >
        {isCompleted && !isActive ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </div>
      <p className={cn("text-[11px] font-medium leading-4 sm:text-xs", isActive || isCompleted ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </p>
    </div>
  );
}

export function StepIndicator() {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentActiveIndex = useMemo(() => {
    if (pathname.startsWith("/projects") || pathname.startsWith("/documentos-iniciais")) return 1;
    if (pathname.startsWith("/preencher")) return steps.length - 1;
    const currentIndex = steps.findIndex((step) => pathname.startsWith(step.href));
    return currentIndex > -1 ? currentIndex : 0;
  }, [pathname]);

  if (!isMounted || pathname.startsWith("/modelos") || pathname.startsWith("/feedback")) {
    return null;
  }

  const currentStep = steps[currentActiveIndex];

  return (
    <div className="border-b bg-background/95">
      <div className="page-shell py-3">
        <div className="page-width">
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-3 sm:px-4">
            <div className="mb-3 flex items-center justify-between gap-3 sm:hidden">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fluxo Atual</p>
                <p className="text-sm font-semibold text-foreground">{currentStep.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Etapa {currentActiveIndex + 1} de {steps.length}
              </p>
            </div>

            <div className="relative mx-auto flex max-w-4xl items-start justify-between gap-3">
              <div className="absolute left-0 right-0 top-4 hidden h-px bg-border sm:block" />
              <div
                className="absolute left-0 top-4 hidden h-px bg-primary transition-all duration-500 sm:block"
                style={{ width: `${(currentActiveIndex / (steps.length - 1)) * 100}%` }}
              />
              {steps.map((step, index) => (
                <Step
                  key={step.href}
                  icon={step.icon}
                  label={step.label}
                  isActive={index === currentActiveIndex}
                  isCompleted={index < currentActiveIndex}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
