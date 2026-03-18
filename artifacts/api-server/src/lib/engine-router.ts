import type { EngineInterface } from "@workspace/engine-common";
import {
  generateProjectSpec as reactGenerateSpec,
  generateProjectCode as reactRunPipeline,
  refineProject as reactRefineProject,
} from "@workspace/engine-react";

type EngineId = "react" | "fastapi";

const reactEngine: EngineInterface = {
  id: "react",
  label: "React + Express",
  async generateSpec(projectId, prompt, persona?) {
    await reactGenerateSpec(projectId, prompt, persona);
  },
  async runPipeline(projectId, prompt, spec?, persona?) {
    await reactRunPipeline(projectId, prompt, spec, persona);
  },
  async refineProject(projectId, prompt) {
    return reactRefineProject(projectId, prompt);
  },
  getSandpackSupport() {
    return true;
  },
  getGoldenPathRules() {
    return [];
  },
};

const fastapiEngine: EngineInterface = {
  id: "fastapi",
  label: "FastAPI + SQLAlchemy",
  async generateSpec(_projectId, _prompt, _persona?) {
    throw new Error("FastAPI engine is not yet implemented. Coming in Phase 2C.");
  },
  async runPipeline(_projectId, _prompt, _spec?, _persona?) {
    throw new Error("FastAPI engine is not yet implemented. Coming in Phase 2C.");
  },
  async refineProject(_projectId, _prompt) {
    throw new Error("FastAPI engine is not yet implemented. Coming in Phase 2C.");
  },
  getSandpackSupport() {
    return false;
  },
  getGoldenPathRules() {
    return [];
  },
};

const engines: Record<EngineId, EngineInterface> = {
  react: reactEngine,
  fastapi: fastapiEngine,
};

export function getEngine(engineId: EngineId): EngineInterface {
  const engine = engines[engineId];
  if (!engine) {
    throw new Error(`Unknown engine: ${engineId}. Valid engines: ${Object.keys(engines).join(", ")}`);
  }
  return engine;
}

export function isValidEngine(value: string): value is EngineId {
  return value === "react" || value === "fastapi";
}

export function getAvailableEngines(): Array<{ id: EngineId; label: string; available: boolean }> {
  return [
    { id: "react", label: "React + Express", available: true },
    { id: "fastapi", label: "FastAPI + SQLAlchemy", available: false },
  ];
}
