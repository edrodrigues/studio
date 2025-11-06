
"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, FileUp, CheckCircle, DraftingCompass } from "lucide-react";
import { useEffect, useState } from "react";

const steps = [
  { href: "/", label: "Comece Aqui", icon: Home },
  { href: "/documentos-iniciais", label: "Documentos Iniciais", icon: FileUp },
  { href: "/modelos", label: "Modelos", icon: DraftingCompass },
  { href: "/gerar-exportar", label: "Contratos Gerados", icon: CheckCircle },
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
    <div className="relative z-10 flex w-24 flex-col items-center gap-2 text-center">
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
            <div className="absolute left-1/2 top-5 h-0.5 w-[calc(100%-96px)] -translate-x-1/2 bg-border" />
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <StepIndicatorSkeleton />;
  }
  
  const modifiedSteps = steps.map(step => {
      if (step.href === "/gerar-exportar") {
          return { ...step, label: "Contratos Gerados"}
      }
      return step;
  });

  const activeIndex = modifiedSteps.findIndex((step) =>
        (step.href !== "/" && pathname.startsWith(step.href)) ||
        (step.href === "/" && pathname === "/") ||
        (pathname.startsWith("/preencher")) || // Treat preencher as part of the last step
        (pathname.startsWith("/gerar-novo")) // Treat gerar-novo as part of the last step
      );
      
   const getActiveIndex = () => {
      if(pathname.startsWith("/preencher")) return steps.length -1;
      if(pathname.startsWith("/gerar-novo")) return steps.length -1;

      const currentIndex = steps.findIndex((step) =>
          (step.href !== "/" && pathname.startsWith(step.href)) ||
          (step.href === "/" && pathname === "/")
        );
      return currentIndex > -1 ? currentIndex : 0;
   }
   
   const currentActiveIndex = getActiveIndex();

  return (
    <div className="border-b bg-background">
      <div className="container py-4">
        <div className="relative mx-auto flex max-w-4xl items-start justify-between">
          <div className="absolute left-1/2 top-5 flex h-0.5 w-[calc(100%-96px)] -translate-x-1/2">
            {Array.from({ length: modifiedSteps.length - 1 }).map((_, index) => (
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

          {modifiedSteps.map((step, index) => (
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

