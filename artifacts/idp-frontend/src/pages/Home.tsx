import { useLocation } from "wouter";
import { PromptForm } from "@/components/PromptForm";

export function Home() {
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 flex items-center justify-center py-12">
      <PromptForm onProjectCreated={(id) => navigate(`/project/${id}`)} />
    </div>
  );
}
