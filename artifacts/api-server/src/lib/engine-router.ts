import type { EngineInterface } from "@workspace/engine-common";
import {
  generateProjectSpec as reactGenerateSpec,
  generateProjectCode as reactRunPipeline,
  refineProject as reactRefineProject,
} from "@workspace/engine-react";
import {
  generateSpec as fastapiGenerateSpec,
  runPipeline as fastapiRunPipeline,
  refineProject as fastapiRefineProject,
  FASTAPI_GOLDEN_PATH_RULES,
} from "@workspace/engine-fastapi";
import {
  generateSpec as mobileGenerateSpec,
  runPipeline as mobileRunPipeline,
  refineProject as mobileRefineProject,
  MOBILE_GOLDEN_PATH_RULES,
} from "@workspace/engine-mobile";

type EngineId = "react" | "fastapi" | "mobile-expo";

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
  async generateSpec(projectId, prompt, _persona?) {
    await fastapiGenerateSpec(projectId, prompt);
  },
  async runPipeline(projectId, prompt, spec?, _persona?) {
    await fastapiRunPipeline(projectId, prompt, spec);
  },
  async refineProject(projectId, prompt) {
    return fastapiRefineProject(projectId, prompt);
  },
  getSandpackSupport() {
    return false;
  },
  getGoldenPathRules() {
    return FASTAPI_GOLDEN_PATH_RULES;
  },
};

const mobileExpoEngine: EngineInterface = {
  id: "mobile-expo",
  label: "React Native + Expo",
  async generateSpec(projectId, prompt, _persona?) {
    await mobileGenerateSpec(projectId, prompt);
  },
  async runPipeline(projectId, prompt, spec?, _persona?) {
    await mobileRunPipeline(projectId, prompt, spec);
  },
  async refineProject(projectId, prompt) {
    return mobileRefineProject(projectId, prompt);
  },
  getSandpackSupport() {
    return false;
  },
  getGoldenPathRules() {
    return MOBILE_GOLDEN_PATH_RULES;
  },
};

const engines: Record<EngineId, EngineInterface> = {
  react: reactEngine,
  fastapi: fastapiEngine,
  "mobile-expo": mobileExpoEngine,
};

export function getEngine(engineId: EngineId): EngineInterface {
  const engine = engines[engineId];
  if (!engine) {
    throw new Error(`Unknown engine: ${engineId}. Valid engines: ${Object.keys(engines).join(", ")}`);
  }
  return engine;
}

export function isValidEngine(value: string): value is EngineId {
  return value === "react" || value === "fastapi" || value === "mobile-expo";
}

export function getAvailableEngines(): Array<{ id: EngineId; label: string; available: boolean }> {
  return [
    { id: "react", label: "React + Express", available: true },
    { id: "fastapi", label: "FastAPI + SQLAlchemy", available: true },
    { id: "mobile-expo", label: "React Native + Expo", available: true },
  ];
}
