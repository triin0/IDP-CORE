import { useState } from "react";
import { useGetProject } from "@workspace/api-client-react";
import { PromptForm } from "@/components/PromptForm";
import { Workspace } from "@/components/Workspace";

export function Home() {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const { data: project } = useGetProject(
    activeProjectId || "",
    {
      query: {
        queryKey: [`/api/projects/${activeProjectId}`],
        enabled: !!activeProjectId,
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          return (status === "pending" || status === "generating") ? 2000 : false;
        }
      }
    }
  );

  if (activeProjectId && project) {
    return (
      <div className="flex-1 flex flex-col">
        <Workspace project={project} onReset={() => setActiveProjectId(null)} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center py-12">
      <PromptForm onProjectCreated={setActiveProjectId} />
    </div>
  );
}
