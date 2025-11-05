
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
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-300",
          isActive
            ? "border-primary bg-primary text-primary-foreground"
            : isCompleted
            ? "border-primary bg-primary/10 text-primary"
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

  if (!isMounted) {
    return (
      <div className="border-b bg-card">
        <div className="container py-4">
          <div className="relative mx-auto flex max-w-4xl items-start justify-between">
            <div className="absolute left-1/2 top-5 h-0.5 w-[calc(100%-80px)] -translate-x-1/2 bg-border" />
            <div
              className="absolute left-1/2 top-5 h-0.5 w-[calc(100%-80px)] origin-left -translate-x-1/2 bg-primary transition-transform duration-500 ease-in-out"
              style={{ transform: `scaleX(0)` }}
            />
            {steps.map((step) => (
              <div key={step.href} className="relative z-10 flex w-20 justify-center">
                <Step
                  icon={step.icon}
                  label={step.label}
                  isActive={false}
                  isCompleted={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Find the index of the current active step
  let activeIndex = steps.findIndex(
    (step) =>
      (step.href !== "/" && pathname.startsWith(step.href)) ||
      (step.href === "/" && pathname === "/")
  );

  // Special case for dynamic preencher routes, which are part of the last step now
  if (pathname.startsWith("/preencher")) {
    activeIndex = 3;
  }

  const progressScale = activeIndex === -1 ? 0 : activeIndex / (steps.length - 1);


  return (
    <div className="border-b bg-card">
      <div className="container py-4">
        <div className="relative mx-auto flex max-w-4xl items-start justify-between">
          <div className="absolute left-1/2 top-5 h-0.5 w-[calc(100%-80px)] -translate-x-1/2 bg-border" />
          <div
            className="absolute left-1/2 top-5 h-0.5 w-[calc(100%-80px)] origin-left -translate-x-1/2 bg-primary transition-transform duration-500 ease-in-out"
            style={{ transform: `scaleX(${progressScale})` }}
          />
          {steps.map((step, index) => (
            <div key={step.href} className="relative z-10 flex w-20 justify-center">
              <Step
                icon={step.icon}
                label={step.label}
                isActive={index === activeIndex}
                isCompleted={index < activeIndex}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
