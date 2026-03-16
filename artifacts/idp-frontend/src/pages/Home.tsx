import { useLocation } from "wouter";
import { PromptForm } from "@/components/PromptForm";

export function Home() {
  const [, navigate] = useLocation();

  const handleProjectCreated = (id: string) => {
    navigate(`/project/${id}`);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center py-12">
        <PromptForm onProjectCreated={handleProjectCreated} />
      </div>
    </div>
  );
}
