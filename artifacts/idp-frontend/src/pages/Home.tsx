import { useState } from "react";
import { useLocation } from "wouter";
import { PromptForm } from "@/components/PromptForm";
import { DeconstructorWizard } from "@/components/DeconstructorWizard";

export function Home() {
  const [, navigate] = useLocation();
  const [enrichedPrompt, setEnrichedPrompt] = useState<string | null>(null);

  return (
    <div className="flex-1 flex items-center justify-center py-12">
      <div className="w-full max-w-3xl mx-auto px-4 space-y-6">
        <PromptForm
          onProjectCreated={(id) => navigate(`/project/${id}`)}
          initialPrompt={enrichedPrompt}
        />
        <DeconstructorWizard onBuildPrompt={setEnrichedPrompt} />
      </div>
    </div>
  );
}
