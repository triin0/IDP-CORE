import type { CommandAction, CommandEnvelope } from "../types/commands";

let history: CommandEnvelope[] = [];
let future: CommandEnvelope[] = [];

export const commandBus = {
  dispatch(command: CommandAction, source: "editor" | "ai" = "editor"): CommandEnvelope {
    const envelope: CommandEnvelope = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source,
      command,
    };
    history.push(envelope);
    future = [];
    return envelope;
  },
  undo(): CommandEnvelope | undefined {
    const last = history.pop();
    if (last) { future.push(last); }
    return last;
  },
  redo(): CommandEnvelope | undefined {
    const next = future.pop();
    if (next) { history.push(next); }
    return next;
  },
  getHistory(): CommandEnvelope[] { return [...history]; },
  clear() { history = []; future = []; },
};
