export type CommandAction =
  | { action: 'SPAWN_ASSET'; assetId: string }
  | { action: 'DELETE_NODE'; nodeId: string }
  | { action: 'TRANSFORM_NODE'; nodeId: string; transform: { position?: [number,number,number]; rotation?: [number,number,number]; scale?: [number,number,number] } }
  | { action: 'UPDATE_MATERIAL'; nodeId: string; materialProps: Record<string, unknown> }
  | { action: 'SET_ENVIRONMENT'; preset: string }
  | { action: 'SNAPSHOT_STATE'; name: string }
  | { action: 'CAMERA_MOVE'; position: [number,number,number]; target: [number,number,number] }
  | { action: 'UNDO' }
  | { action: 'REDO' };
export interface CommandEnvelope { id: string; timestamp: number; source: 'editor' | 'ai' | 'user'; command: CommandAction; }