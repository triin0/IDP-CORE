import { useState } from "react";
import { useLocation } from "wouter";
import { PromptForm } from "@/components/PromptForm";
import { DeconstructorWizard } from "@/components/DeconstructorWizard";

export function Home() {
  const [, navigate] = useLocation();
  const [enrichedPrompt, setEnrichedPrompt] = useState<string | null>(null);
  const [designPersona, setDesignPersona] = useState<string | undefined>();
  const [selectedEngine, setSelectedEngine] = useState<"react" | "fastapi" | "mobile-expo">("react");

  return (
    <div className="flex-1 flex items-center justify-center py-12">
      <div className="w-full max-w-3xl mx-auto px-4 space-y-6">
        <PromptForm
          onProjectCreated={(id) => navigate(`/project/${id}`)}
          initialPrompt={enrichedPrompt}
          designPersona={selectedEngine === "react" ? designPersona : undefined}
          onEngineChange={setSelectedEngine}
        />
        {selectedEngine === "react" && (
          <DeconstructorWizard
            onBuildPrompt={(prompt, persona) => {
              setEnrichedPrompt(prompt);
              setDesignPersona(persona);
            }}
          />
        )}
      </div>
    </div>
  );
}
