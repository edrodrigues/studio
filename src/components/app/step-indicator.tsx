
"use client";

import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, FolderOpen, FilePlus, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

const steps = [
  { href: "/como-usar", label: "Comece Aqui", icon: Home },
  { href: "/projects", label: "Documentos do Projeto", icon: FolderOpen },
  { href: "/gerar-exportar", label: "Gerar e Revisar", icon: FilePlus },
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
    <div className="relative z-10 flex w-28 flex-col items-center gap-2 text-center">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-300",
          isActive
            ? "border-primary bg-primary text-primary-foreground"
            : isCompleted
              ? "border-primary bg-primary/20 text-primary"
              : "border-border bg-card text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p
        className={cn(
          "mt-1 text-xs font-medium transition-colors duration-300",
          isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
    </div>
  );
}

function StepIndicatorSkeleton() {
  return (
    <div className="border-b bg-background">
      <div className="container py-4">
        <div className="relative mx-auto flex max-w-4xl items-start justify-between">
          <div className="absolute left-1/2 top-5 h-0.5 w-[calc(100%-112px)] -translate-x-1/2 bg-border" />
          {steps.map((step) => (
            <Step
              key={step.href}
              icon={step.icon}
              label={step.label}
              isActive={false}
              isCompleted={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StepIndicator() {
  const pathname = usePathname();
  const params = useParams();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <StepIndicatorSkeleton />;
  }

  // Modelos and feedback are not part of the main flow
  if (pathname.startsWith('/modelos') || pathname.startsWith('/feedback')) {
    return null;
  }

  const getActiveIndex = () => {
    // Project detail pages (documents upload/manage) → step 2 (Documentos do Projeto)
    if (pathname.startsWith("/projects")) return 1;

    // Legacy: the old /documentos-iniciais route also maps to step 2
    if (pathname.startsWith("/documentos-iniciais")) return 1;

    // Filling a contract (/preencher) is part of the last step
    if (pathname.startsWith("/preencher")) return steps.length - 1;

    const currentIndex = steps.findIndex((step) =>
      (step.href !== "/" && pathname.startsWith(step.href)) ||
      (step.href === "/" && pathname === "/")
    );
    return currentIndex > -1 ? currentIndex : 0;
  };

  const currentActiveIndex = getActiveIndex();

  return (
    <div className="border-b bg-background">
      <div className="container py-4">
        <div className="relative mx-auto flex max-w-4xl items-start justify-between">
          <div className="absolute left-1/2 top-5 flex h-0.5 w-[calc(100%-112px)] -translate-x-1/2">
            {Array.from({ length: steps.length - 1 }).map((_, index) => (
              <div key={`line-bg-${index}`} className="relative h-full flex-1 bg-border">
                <div
                  className={cn(
                    "absolute h-full w-full origin-left bg-primary transition-transform duration-500",
                    index < currentActiveIndex ? "scale-x-100" : "scale-x-0"
                  )}
                />
              </div>
            ))}
          </div>

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
  );
}
