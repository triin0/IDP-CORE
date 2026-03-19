import { EventEmitter } from "events";

export type PipelineEventType =
  | "stage:start"
  | "stage:complete"
  | "stage:fail"
  | "pipeline:log"
  | "verification:start"
  | "verification:gate"
  | "verification:complete"
  | "self-healing:attempt"
  | "self-healing:success"
  | "self-healing:exhausted"
  | "build:output"
  | "version-enforcement"
  | "type-hardening"
  | "pipeline:complete"
  | "pipeline:error";

export interface PipelineEvent {
  type: PipelineEventType;
  projectId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

class PipelineEventBus extends EventEmitter {
  emitPipeline(payload: PipelineEvent): boolean {
    return super.emit("pipeline-event", payload);
  }

  onPipeline(listener: (payload: PipelineEvent) => void): this {
    return super.on("pipeline-event", listener);
  }

  offPipeline(listener: (payload: PipelineEvent) => void): this {
    return super.off("pipeline-event", listener);
  }
}

export const pipelineEvents = new PipelineEventBus();
pipelineEvents.setMaxListeners(100);

export function emitPipelineEvent(
  projectId: string,
  type: PipelineEventType,
  data: Record<string, unknown> = {},
): void {
  const event: PipelineEvent = {
    type,
    projectId,
    timestamp: new Date().toISOString(),
    data,
  };
  pipelineEvents.emitPipeline(event);
}
