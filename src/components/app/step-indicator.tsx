"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, FileUp, CheckCircle, DraftingCompass } from "lucide-react";
import { useEffect, useState } from "react";

const steps = [
  { href: "/", label: "Comece Aqui", icon: Home },
  { href: "/documentos-iniciais", label: "Documentos Iniciais", icon: FileUp },
  { href: "/modelos", label: "Modelos", icon: DraftingCompass },
  { href: "/gerar-exportar", label: "Revisar e Exportar", icon: CheckCircle },
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
    <div className="relative z-10 flex w-20 flex-col items-center gap-2">
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
          "mt-1 text-center text-xs font-medium transition-colors duration-300 sm:text-sm",
          isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
        )}
      >
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

  const activeIndex = isMounted ? steps.findIndex((step) =>
        (step.href !== "/" && pathname.startsWith(step.href)) ||
        (step.href === "/" && pathname === "/") ||
        (step.href === "/gerar-exportar" && pathname.startsWith("/preencher"))
      ) : -1;
  
  if (!isMounted) {
    return (
      <div className="border-b bg-background/80 glass">
        <div className="container py-4">
          <div className="relative mx-auto flex max-w-4xl items-start justify-between">
            <div className="absolute left-1/2 top-5 h-0.5 w-[calc(100%-80px)] -translate-x-1/2">
                <div className="h-full w-full bg-border" />
            </div>
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

  return (
    <div className="border-b bg-background/80 glass">
      <div className="container py-4">
        <div className="relative mx-auto flex max-w-4xl items-start justify-between">
          <div className="absolute left-1/2 top-5 flex h-0.5 w-[calc(100%-80px)] -translate-x-1/2">
            {Array.from({ length: steps.length - 1 }).map((_, index) => (
              <div key={`line-bg-${index}`} className="relative h-full flex-1 bg-border">
                <div
                    className={cn(
                        "absolute h-full w-full origin-left bg-primary transition-transform duration-500",
                        index < activeIndex ? "scale-x-100" : "scale-x-0"
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
              isActive={index === activeIndex}
              isCompleted={index < activeIndex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
