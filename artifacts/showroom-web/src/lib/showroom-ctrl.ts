import type { CommandAction } from '../types/commands';
export function handleShowroomCommand(cmd: CommandAction) {
  switch (cmd.action) {
    case 'SPAWN_ASSET': console.log('Spawn', cmd.assetId); break;
    case 'DELETE_NODE': console.log('Delete', cmd.nodeId); break;
    case 'TRANSFORM_NODE': console.log('Transform', cmd.nodeId); break;
  
    default: { const _exhaustive: never = command; console.error("Unhandled command:", (_exhaustive as any).action); break; }
}
}