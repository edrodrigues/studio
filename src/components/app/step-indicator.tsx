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
  index,
  activeIndex,
}: {
  icon: React.ElementType;
  label: string;
  index: number;
  activeIndex: number;
}) {
  const isCompleted = index < activeIndex;
  const isActive = index === activeIndex;

  return (
    <div className="relative z-10 flex flex-col items-center w-20 gap-2">
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

  const activeIndex = steps.findIndex(
    (step) =>
      (step.href !== "/" && pathname.startsWith(step.href)) ||
      (step.href === "/" && pathname === "/")
  );
  
  const finalIndex = pathname.startsWith("/preencher") ? 3 : activeIndex;

  if (!isMounted) {
    return (
      <div className="border-b bg-background/80 glass">
        <div className="container py-4">
          <div className="relative mx-auto flex max-w-4xl items-start justify-between">
            {steps.map((step, index) => (
              <Step
                key={step.href}
                icon={step.icon}
                label={step.label}
                index={index}
                activeIndex={-1} // Render with no active state on server
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
           {/* Lines */}
          <div className="absolute top-5 left-0 right-0 h-0.5 flex justify-between mx-auto w-[calc(100%-80px)] max-w-4xl px-[calc((100%_/_3)_/_2_-_10px)]">
            {Array.from({ length: steps.length - 1 }).map((_, index) => (
              <div
                key={`line-${index}`}
                className="h-full w-full flex-1"
              >
                 <div className={cn("h-full w-full transition-colors duration-500", index < finalIndex ? 'bg-primary' : 'bg-border' )}></div>
              </div>
            ))}
          </div>

          {steps.map((step, index) => (
            <Step
              key={step.href}
              icon={step.icon}
              label={step.label}
              index={index}
              activeIndex={finalIndex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
