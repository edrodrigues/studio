"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthContext } from "@/context/auth-context";
import { ComposioConnection } from "@/components/app/composio-connection";
import { GenerateExportExplanation } from "@/components/app/generate-export-explanation";
import { GenerateExportSelectors } from "@/components/app/generate-export-selectors";
import { GenerateExportChat } from "@/components/app/generate-export-chat";
import { GenerateExportHistory } from "@/components/app/generate-export-history";

export default function GerarExportarPage() {
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectIdFromUrl);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [composioConnectPrompt, setComposioConnectPrompt] = useState(0);
  const [refreshHistory, setRefreshHistory] = useState(0);

  const handleGenerationComplete = () => {
    setRefreshHistory((prev) => prev + 1);
  };

  return (
    <div className="page-shell relative">
      <div className="page-width space-y-8">
        <div>
          <h1 className="page-title">Gerar e Revisar</h1>
          <p className="text-muted-foreground mt-2">
            Gere documentos de forma conversacional com o Alex.
          </p>
        </div>

        <ComposioConnection openSignal={composioConnectPrompt} />

        <GenerateExportExplanation />

        <GenerateExportSelectors
          selectedProjectId={selectedProjectId}
          selectedTemplateId={selectedTemplateId}
          onProjectChange={(id) => {
            setSelectedProjectId(id);
            setSelectedTemplateId(null);
          }}
          onTemplateChange={setSelectedTemplateId}
        />

        <GenerateExportChat
          projectId={selectedProjectId}
          templateId={selectedTemplateId}
          onGenerationComplete={handleGenerationComplete}
        />

        <GenerateExportHistory
          key={`${selectedProjectId}-${refreshHistory}`}
          projectId={selectedProjectId}
        />
      </div>
    </div>
  );
}
