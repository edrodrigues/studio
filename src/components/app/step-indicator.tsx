
"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, FileUp, FileText, CheckCircle, DraftingCompass } from "lucide-react";

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
    <div className="flex flex-col items-center">
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
          "mt-2 text-center text-xs font-medium transition-colors duration-300 sm:text-sm",
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


  return (
    <div className="border-b bg-card">
      <div className="container py-4">
        <div className="relative flex items-start justify-between">
          <div className="absolute left-0 top-5 h-0.5 w-full bg-border" />
          <div
            className="absolute left-0 top-5 h-0.5 bg-primary transition-all duration-500 ease-in-out"
            style={{ width: `calc(${Math.max(0, activeIndex) * (100 / (steps.length-1))}% - 2rem)` }}
          />
          {steps.map((step, index) => (
            <div key={step.href} className="relative z-10 w-20">
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
