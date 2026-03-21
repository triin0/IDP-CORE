import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Mesh } from "three";
import { usePresenceStore, lerpCursor3D } from "./presence-system";
import type { PresenceUser } from "./presence-system";

function PresenceCursor({ peer }: { peer: PresenceUser }) {
  const meshRef = useRef<Mesh>(null);
  const currentPos = useRef<[number, number, number]>([...peer.cursor3D]);

  useFrame(() => {
    if (!meshRef.current) return;
    currentPos.current = lerpCursor3D(currentPos.current, peer.cursor3D);
    meshRef.current.position.set(...currentPos.current);
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={peer.color} transparent opacity={0.7} />
      </mesh>
      <Html position={peer.cursor3D} center distanceFactor={10}>
        <div style={{
          background: peer.color,
          color: "white",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}>
          {peer.displayName}
        </div>
      </Html>
    </group>
  );
}

export function PresenceAvatars() {
  const activePeers = usePresenceStore((s) => s.getActivePeers());
  return (
    <>
      {activePeers.map((peer) => (
        <PresenceCursor key={peer.userId} peer={peer} />
      ))}
    </>
  );
}
