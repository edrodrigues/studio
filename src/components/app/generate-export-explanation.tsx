"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "generate-export-explanation-dismissed";

export function GenerateExportExplanation() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (dismissed) return null;

  return (
    <div className="relative rounded-2xl border border-blue-200 bg-blue-50/60 p-6 dark:border-blue-800 dark:bg-blue-950/30">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        aria-label="Fechar explicação"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            Como funciona esta página
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Selecione um projeto e um modelo de documento abaixo. O Alex irá guiá-lo passo a passo para copiar, personalizar e abrir o documento no Google Drive.
          </p>

          <div className="flex items-center gap-3 pt-1">
            {["Copiar", "Personalizar", "Abrir"].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-700 dark:bg-blue-800 dark:text-blue-300">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {step}
                </span>
                {i < 2 && (
                  <span className="text-blue-400 dark:text-blue-600">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
