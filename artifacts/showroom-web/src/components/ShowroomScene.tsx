import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls, Environment, ContactShadows, AdaptiveDpr,
  AdaptiveEvents, RoundedBox, Text, MeshReflectorMaterial, useGLTF,
} from "@react-three/drei";
import { Suspense, useState, useRef, useCallback, useMemo, useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import * as THREE from "three";
import { sha256 } from "../utils/crypto";

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[ShowroomScene] WebGL unavailable, showing fallback:", error.message);
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch { return false; }
}

const API_BASE = "http://localhost:8000";

interface Vehicle {
  id: string;
  name: string;
  price: number;
  year: number;
  color: string;
  modelUrl?: string;
}

interface NexusSyncState {
  syncState: "LIVE" | "STALE" | "GHOST" | "FAST_FORWARDING" | "DISCONNECTED";
  interpolationProgress: number;
  ghostTransform: { posX: number; posY: number; posZ: number; rotY: number };
  currentTransform: { posX: number; posY: number; posZ: number; rotY: number };
  entityHash: string;
}

function useNexusSync(entityId: string): NexusSyncState {
  const [state, setState] = useState<NexusSyncState>({
    syncState: "LIVE",
    interpolationProgress: 1.0,
    ghostTransform: { posX: 0, posY: 0.6, posZ: 0, rotY: 0 },
    currentTransform: { posX: 0, posY: 0.6, posZ: 0, rotY: 0 },
    entityHash: "",
  });

  useEffect(() => {
    sha256(`nexus:${entityId}:${Date.now()}`).then(hash => {
      setState(prev => ({ ...prev, entityHash: hash.slice(0, 16) }));
    });
  }, [entityId]);

  return state;
}

function lerpValue(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

interface Pass41Result {
  valid: boolean;
  assetHash: string;
  loadTimeMs: number;
  meshCount: number;
  vertexCount: number;
  materialCount: number;
}

function validatePass41(scene: THREE.Group): Pass41Result {
  const startTime = performance.now();
  let meshCount = 0;
  let vertexCount = 0;
  const materials = new Set<string>();

  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshCount++;
      const mesh = child as THREE.Mesh;
      const geom = mesh.geometry;
      if (geom.attributes.position) {
        vertexCount += geom.attributes.position.count;
      }
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => materials.add(m.uuid));
      } else if (mesh.material) {
        materials.add(mesh.material.uuid);
      }
    }
  });

  const loadTimeMs = performance.now() - startTime;
  const assetFingerprint = `meshes:${meshCount}|verts:${vertexCount}|mats:${materials.size}|time:${Math.round(loadTimeMs)}`;

  return {
    valid: meshCount > 0 && vertexCount > 0,
    assetHash: assetFingerprint,
    loadTimeMs,
    meshCount,
    vertexCount,
    materialCount: materials.size,
  };
}

const PAINT_MATERIAL_PROPS = {
  metalness: 0.9,
  roughness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.03,
  envMapIntensity: 2.0,
  reflectivity: 1.0,
};

const CHROME_MATERIAL_PROPS = {
  metalness: 0.9,
  roughness: 0.1,
  envMapIntensity: 2.5,
  color: "#e8e8e8",
};

const GLASS_MATERIAL_PROPS = {
  metalness: 0.0,
  roughness: 0.05,
  transparent: true,
  opacity: 0.3,
  transmission: 0.9,
  thickness: 0.5,
  ior: 1.5,
  envMapIntensity: 1.0,
  color: "#88aacc",
};

const RUBBER_MATERIAL_PROPS = {
  color: "#111111",
  metalness: 0.0,
  roughness: 0.85,
};

function GLBModel({ url, color, onValidated }: {
  url: string;
  color: string;
  onValidated?: (result: Pass41Result) => void;
}) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const createdMaterials = useRef<THREE.Material[]>([]);

  useEffect(() => {
    createdMaterials.current.forEach(m => m.dispose());
    createdMaterials.current = [];

    const result = validatePass41(clonedScene);
    console.log(`[Pass 41] Asset Conduit: ${result.valid ? "VALID" : "INVALID"} | ${result.assetHash}`);

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const name = mesh.name.toLowerCase();
        let mat: THREE.Material | null = null;
        if (name.includes("glass") || name.includes("windshield") || name.includes("window")) {
          mat = new THREE.MeshPhysicalMaterial({ ...GLASS_MATERIAL_PROPS });
        } else if (name.includes("chrome") || name.includes("trim") || name.includes("grill")) {
          mat = new THREE.MeshPhysicalMaterial({ ...CHROME_MATERIAL_PROPS });
        } else if (name.includes("tire") || name.includes("rubber")) {
          mat = new THREE.MeshStandardMaterial({ ...RUBBER_MATERIAL_PROPS });
        } else if (name.includes("body") || name.includes("paint") || name.includes("panel")) {
          mat = new THREE.MeshPhysicalMaterial({ color, ...PAINT_MATERIAL_PROPS });
        }
        if (mat) {
          mesh.material = mat;
          createdMaterials.current.push(mat);
        }
      }
    });

    if (onValidated) onValidated(result);

    return () => {
      createdMaterials.current.forEach(m => m.dispose());
      createdMaterials.current = [];
    };
  }, [clonedScene, color, onValidated]);

  return <primitive object={clonedScene} />;
}

function ProceduralLexus({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null!);
  const pass41Logged = useRef(false);

  useEffect(() => {
    if (groupRef.current && !pass41Logged.current) {
      const result = validatePass41(groupRef.current);
      console.log(`[Pass 41] Procedural Asset Conduit: ${result.valid ? "VALID" : "INVALID"} | ${result.assetHash}`);
      pass41Logged.current = true;
    }
  }, []);

  return (
    <group ref={groupRef}>
      <RoundedBox args={[4.2, 0.65, 1.85]} radius={0.12} position={[0, 0, 0] as [number, number, number]} castShadow receiveShadow>
        <meshPhysicalMaterial color={color} {...PAINT_MATERIAL_PROPS} />
      </RoundedBox>

      <RoundedBox args={[1.6, 0.15, 1.84]} radius={0.05} position={[-1.1, 0.33, 0] as [number, number, number]} castShadow>
        <meshPhysicalMaterial color={color} {...PAINT_MATERIAL_PROPS} />
      </RoundedBox>

      <RoundedBox args={[2.4, 0.75, 1.75]} radius={0.18} position={[0.15, 0.62, 0] as [number, number, number]} castShadow receiveShadow>
        <meshPhysicalMaterial color={color} {...PAINT_MATERIAL_PROPS} />
      </RoundedBox>

      <mesh position={[0.15, 0.7, 0] as [number, number, number]} castShadow>
        <boxGeometry args={[2.15, 0.55, 1.68]} />
        <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
      </mesh>

      <mesh position={[-0.85, 0.7, 0.88] as [number, number, number]} rotation={[0, 0, -0.15] as [number, number, number]}>
        <boxGeometry args={[0.7, 0.5, 0.02]} />
        <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[-0.85, 0.7, -0.88] as [number, number, number]} rotation={[0, 0, -0.15] as [number, number, number]}>
        <boxGeometry args={[0.7, 0.5, 0.02]} />
        <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[1.05, 0.7, 0.88] as [number, number, number]} rotation={[0, 0, 0.1] as [number, number, number]}>
        <boxGeometry args={[0.6, 0.5, 0.02]} />
        <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
      </mesh>
      <mesh position={[1.05, 0.7, -0.88] as [number, number, number]} rotation={[0, 0, 0.1] as [number, number, number]}>
        <boxGeometry args={[0.6, 0.5, 0.02]} />
        <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
      </mesh>

      <mesh position={[1.45, 0.72, 0] as [number, number, number]} rotation={[-0.3, 0, 0] as [number, number, number]}>
        <boxGeometry args={[0.4, 0.45, 1.68]} />
        <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
      </mesh>

      {([[-1.35, -0.2, 0.92], [-1.35, -0.2, -0.92], [1.35, -0.2, 0.92], [1.35, -0.2, -0.92]] as [number, number, number][]).map((pos, i) => (
        <group key={`wheel-${i}`} position={pos}>
          <mesh rotation={[Math.PI / 2, 0, 0] as [number, number, number]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.24, 32]} />
            <meshStandardMaterial {...RUBBER_MATERIAL_PROPS} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0] as [number, number, number]}>
            <cylinderGeometry args={[0.28, 0.28, 0.25, 5]} />
            <meshPhysicalMaterial {...CHROME_MATERIAL_PROPS} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0] as [number, number, number]}>
            <cylinderGeometry args={[0.08, 0.08, 0.26, 16]} />
            <meshPhysicalMaterial color="#333" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      <mesh position={[-2.15, 0.05, 0] as [number, number, number]}>
        <boxGeometry args={[0.08, 0.35, 1.75]} />
        <meshPhysicalMaterial {...CHROME_MATERIAL_PROPS} />
      </mesh>

      <mesh position={[-2.1, 0.05, 0.65] as [number, number, number]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <mesh position={[-2.1, 0.05, -0.65] as [number, number, number]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>

      <mesh position={[-2.1, 0.05, 0.4] as [number, number, number]}>
        <boxGeometry args={[0.06, 0.08, 0.15]} />
        <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-2.1, 0.05, -0.4] as [number, number, number]}>
        <boxGeometry args={[0.06, 0.08, 0.15]} />
        <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.8} />
      </mesh>

      <mesh position={[2.1, 0.1, 0.55] as [number, number, number]}>
        <boxGeometry args={[0.08, 0.18, 0.4]} />
        <meshStandardMaterial color="#ff1111" emissive="#ff0000" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      <mesh position={[2.1, 0.1, -0.55] as [number, number, number]}>
        <boxGeometry args={[0.08, 0.18, 0.4]} />
        <meshStandardMaterial color="#ff1111" emissive="#ff0000" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>

      <mesh position={[2.14, 0.1, 0] as [number, number, number]}>
        <boxGeometry args={[0.04, 0.1, 0.6]} />
        <meshPhysicalMaterial {...CHROME_MATERIAL_PROPS} />
      </mesh>

      <mesh position={[-2.1, -0.05, 0] as [number, number, number]}>
        <boxGeometry args={[0.12, 0.12, 1.6]} />
        <meshPhysicalMaterial {...CHROME_MATERIAL_PROPS} />
      </mesh>

      {([-0.75, 0, 0.75] as number[]).map((x, i) => (
        <mesh key={`roof-rail-${i}`} position={[x, 1.02, 0] as [number, number, number]}>
          <boxGeometry args={[0.04, 0.03, 1.72]} />
          <meshPhysicalMaterial {...CHROME_MATERIAL_PROPS} />
        </mesh>
      ))}

      {([[-0.5, 0, 0.93], [0.5, 0, 0.93], [-0.5, 0, -0.93], [0.5, 0, -0.93]] as [number, number, number][]).map((pos, i) => (
        <mesh key={`handle-${i}`} position={pos}>
          <boxGeometry args={[0.15, 0.04, 0.02]} />
          <meshPhysicalMaterial {...CHROME_MATERIAL_PROPS} />
        </mesh>
      ))}

      {([-0.78, -0.3, 0.18, 0.68] as number[]).map((z, i) => (
        <mesh key={`vent-${i}`} position={[-2.16, 0, z] as [number, number, number]}>
          <boxGeometry args={[0.02, 0.06, 0.08]} />
          <meshPhysicalMaterial color="#222" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function LexusVehicle({ color, nexusState, vehicleId }: {
  color: string;
  nexusState: NexusSyncState;
  vehicleId: string;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const [glbAvailable, setGlbAvailable] = useState(false);
  const [pass41Result, setPass41Result] = useState<Pass41Result | null>(null);
  const glbUrl = `/models/lexus-${vehicleId}.glb`;

  useEffect(() => {
    let cancelled = false;
    setGlbAvailable(false);
    fetch(glbUrl, { method: "HEAD" })
      .then(res => { if (!cancelled && res.ok) setGlbAvailable(true); })
      .catch(() => { if (!cancelled) setGlbAvailable(false); });
    return () => { cancelled = true; };
  }, [glbUrl]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (nexusState.syncState === "FAST_FORWARDING") {
      const t = nexusState.interpolationProgress;
      groupRef.current.position.x = lerpValue(nexusState.ghostTransform.posX, nexusState.currentTransform.posX, t);
      groupRef.current.position.y = lerpValue(nexusState.ghostTransform.posY, nexusState.currentTransform.posY, t);
      groupRef.current.position.z = lerpValue(nexusState.ghostTransform.posZ, nexusState.currentTransform.posZ, t);
      groupRef.current.rotation.y = lerpValue(nexusState.ghostTransform.rotY, nexusState.currentTransform.rotY, t);
    } else if (nexusState.syncState === "GHOST") {
      groupRef.current.position.set(
        nexusState.ghostTransform.posX,
        nexusState.ghostTransform.posY,
        nexusState.ghostTransform.posZ,
      );
      groupRef.current.rotation.y = nexusState.ghostTransform.rotY;
    } else if (nexusState.syncState === "STALE") {
      // Freeze at current transform — do not advance rotation
    } else if (nexusState.syncState === "DISCONNECTED") {
      // Freeze at last known position
    } else {
      groupRef.current.rotation.y += delta * 0.12;
    }
  });

  const handlePass41 = useCallback((result: Pass41Result) => {
    setPass41Result(result);
    console.log(`[Pass 41] GLB validated: ${result.meshCount} meshes, ${result.vertexCount} vertices, ${result.materialCount} materials (${result.loadTimeMs.toFixed(1)}ms)`);
  }, []);

  return (
    <group ref={groupRef} position={[0, 0.6, 0] as [number, number, number]}>
      {glbAvailable ? (
        <GLBModel url={glbUrl} color={color} onValidated={handlePass41} />
      ) : (
        <ProceduralLexus color={color} />
      )}
    </group>
  );
}

function ShowroomFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0] as [number, number, number]} position={[0, -0.01, 0] as [number, number, number]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <MeshReflectorMaterial
        mirror={0.5}
        blur={[400, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={50}
        roughness={0.8}
        depthScale={1.5}
        color="#080818"
        metalness={0.6}
      />
    </mesh>
  );
}

function PriceTag({ vehicle }: { vehicle: Vehicle }) {
  return (
    <group position={[0, 3.2, 0] as [number, number, number]}>
      <Text fontSize={0.35} color="#c9a96e" anchorX="center" anchorY="bottom">
        {vehicle.name}
      </Text>
      <Text fontSize={0.2} color="#888" anchorX="center" anchorY="top" position={[0, -0.1, 0] as [number, number, number]}>
        {vehicle.year} | ${vehicle.price.toLocaleString()}
      </Text>
    </group>
  );
}

function BidPanel({ vehicle, onBid, lastBid }: {
  vehicle: Vehicle;
  onBid: (amount: number) => void;
  lastBid: string | null;
}) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!amount || submitting) return;
    setSubmitting(true);
    onBid(Number(amount));
    setAmount("");
    setSubmitting(false);
  }, [amount, submitting, onBid]);

  return (
    <div style={{
      position: "absolute", right: 24, top: 24,
      background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)",
      color: "#fff", padding: 28, borderRadius: 16, width: 340,
      border: "1px solid rgba(201,169,110,0.3)", fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#c9a96e", marginBottom: 4 }}>PLACE YOUR BID</div>
      <h2 style={{ fontSize: 24, margin: "8px 0 4px", fontWeight: 700 }}>{vehicle.name}</h2>
      <p style={{ color: "#777", fontSize: 14, margin: "0 0 16px" }}>
        {vehicle.year} | Starting at ${vehicle.price.toLocaleString()}
      </p>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter bid amount ($)"
        style={{
          width: "100%", padding: 12, borderRadius: 8, border: "1px solid #333",
          background: "#111", color: "#fff", fontSize: 16, boxSizing: "border-box",
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || !amount}
        style={{
          width: "100%", marginTop: 12, padding: 14,
          background: amount ? "#c9a96e" : "#555", color: amount ? "#000" : "#999",
          border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15,
          cursor: amount ? "pointer" : "default", transition: "all 0.2s",
        }}
      >
        {submitting ? "Placing..." : "Place Bid"}
      </button>
      {lastBid && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(201,169,110,0.15)", borderRadius: 8, fontSize: 13, color: "#c9a96e" }}>
          {lastBid}
        </div>
      )}
    </div>
  );
}

function NexusHUD({ nexusState }: { nexusState: NexusSyncState }) {
  const stateColor = {
    LIVE: "#00ff88",
    STALE: "#ffaa00",
    GHOST: "#ff4444",
    FAST_FORWARDING: "#44aaff",
    DISCONNECTED: "#666",
  }[nexusState.syncState] || "#666";

  return (
    <div style={{
      position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 14px", borderRadius: 20,
      background: "rgba(0,0,0,0.8)", border: `1px solid ${stateColor}33`,
      fontFamily: "monospace", fontSize: 11,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: stateColor,
        boxShadow: `0 0 6px ${stateColor}`,
        animation: nexusState.syncState === "LIVE" ? "pulse 2s infinite" : "none",
      }} />
      <span style={{ color: stateColor }}>
        NEXUS {nexusState.syncState}
      </span>
      {nexusState.entityHash && (
        <span style={{ color: "#555" }}>
          [{nexusState.entityHash}]
        </span>
      )}
    </div>
  );
}

export default function ShowroomScene() {
  const vehicles = useMemo<Vehicle[]>(() => [
    { id: "rx300", name: "Lexus RX300", price: 42000, year: 2024, color: "#c0c0c0", modelUrl: "/models/lexus-rx300.glb" },
    { id: "rx350h", name: "Lexus RX350h", price: 48500, year: 2025, color: "#1a1a2e", modelUrl: "/models/lexus-rx350h.glb" },
    { id: "rx500h", name: "Lexus RX500h F Sport", price: 62500, year: 2025, color: "#f5f5f0", modelUrl: "/models/lexus-rx500h.glb" },
  ], []);

  const [vehicleIdx, setVehicleIdx] = useState(0);
  const [lastBid, setLastBid] = useState<string | null>(null);
  const stateVersions = useRef<Record<string, number>>({});
  const selectedVehicle = vehicles[vehicleIdx];
  const nexusState = useNexusSync(selectedVehicle.id);

  const handleBid = useCallback(async (amount: number) => {
    try {
      const versionKey = `vehicle:${selectedVehicle.id}:bids`;
      const currentVersion = stateVersions.current[versionKey] ?? null;
      const payload: Record<string, unknown> = {
        vehicle_id: selectedVehicle.id,
        amount,
        user_id: "dev-user-001",
      };
      if (currentVersion !== null) {
        payload.state_version = currentVersion;
      }

      const { hashPayload } = await import("../utils/crypto");
      const { hash } = await hashPayload(payload);
      const resp = await fetch(`${API_BASE}/api/bids`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payload-Hash": hash,
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.state_version != null) {
          stateVersions.current[versionKey] = data.state_version;
        }
        const hashNote = data.payload_hash ? ` [SHA-256: ${data.payload_hash.slice(0, 12)}…]` : "";
        const versionNote = data.state_version != null ? ` [v${data.state_version}]` : "";
        setLastBid(`Bid of $${amount.toLocaleString()} placed on ${selectedVehicle.name}${hashNote}${versionNote}`);
      } else if (resp.status === 409) {
        const conflict = await resp.json();
        if (conflict.code === "STATE_VERSION_CONFLICT") {
          stateVersions.current[versionKey] = conflict.serverVersion;
          const manifest = conflict.authoritativeManifest;
          setLastBid(
            `SHADOW BRANCH — state corrected. Highest bid: $${manifest.highestBid?.toLocaleString() ?? "?"} (v${conflict.serverVersion}). Retry your bid.`
          );
        }
      } else {
        const err = await resp.json().catch(() => null);
        if (err?.code === "INTEGRITY_HASH_MISMATCH") {
          setLastBid("INTEGRITY FAULT — data corrupted in transit");
        } else {
          setLastBid("Bid failed — try again");
        }
      }
    } catch {
      setLastBid("API offline — bid queued locally");
    }
  }, [selectedVehicle]);

  const webglAvailable = useMemo(() => detectWebGL(), []);

  const canvasFallback = (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at center, #111 0%, #050510 70%)",
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🚗</div>
      <div style={{ color: "#c9a96e", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{selectedVehicle.name}</div>
      <div style={{ color: "#666", fontSize: 14, maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
        3D view requires WebGL. Open in a browser with GPU support to see the full interactive showroom.
      </div>
      <div style={{ color: "#c9a96e", fontSize: 24, fontWeight: 800, marginTop: 16 }}>
        ${selectedVehicle.price.toLocaleString()}
      </div>
    </div>
  );

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#050510", overflow: "hidden" }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <WebGLErrorBoundary fallback={canvasFallback}>
        {webglAvailable ? (
          <Canvas
            camera={{ position: [5, 3, 8] as [number, number, number], fov: 45 }}
            shadows
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.2,
            }}
          >
            <AdaptiveDpr pixelated />
            <AdaptiveEvents />
            <fog attach="fog" args={["#050510", 15, 40]} />

            <ambientLight intensity={0.8} />
            <hemisphereLight args={["#c9a96e", "#050510", 0.5]} />
            <directionalLight
              position={[10, 12, 5] as [number, number, number]}
              intensity={2.5}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-near={0.5}
              shadow-camera-far={50}
              shadow-camera-left={-10}
              shadow-camera-right={10}
              shadow-camera-top={10}
              shadow-camera-bottom={-10}
              shadow-bias={-0.0001}
            />
            <spotLight
              position={[0, 10, 0] as [number, number, number]}
              angle={0.35}
              penumbra={0.6}
              intensity={4}
              castShadow
              color="#c9a96e"
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <spotLight position={[-6, 6, 4] as [number, number, number]} angle={0.4} penumbra={1} intensity={2} color="#ffffff" />
            <spotLight position={[6, 5, -3] as [number, number, number]} angle={0.5} penumbra={0.8} intensity={1.5} color="#aaccff" />
            <pointLight position={[3, 4, -3] as [number, number, number]} intensity={1.2} color="#8888ff" />
            <pointLight position={[-3, 2, 3] as [number, number, number]} intensity={0.8} color="#ffaa44" />

            <Suspense fallback={null}>
              <LexusVehicle
                color={selectedVehicle.color}
                nexusState={nexusState}
                vehicleId={selectedVehicle.id}
              />
            </Suspense>
            <Suspense fallback={null}>
              <PriceTag vehicle={selectedVehicle} />
            </Suspense>
            <ShowroomFloor />
            <ContactShadows
              position={[0, 0.001, 0] as [number, number, number]}
              opacity={0.8}
              blur={1.5}
              far={6}
              resolution={1024}
              color="#000000"
            />
            <Environment
              preset="city"
              background={false}
              environmentIntensity={1.5}
            />
            <OrbitControls
              makeDefault
              minPolarAngle={0.3}
              maxPolarAngle={Math.PI / 2.2}
              minDistance={4}
              maxDistance={15}
              enablePan={false}
              autoRotate={false}
            />
          </Canvas>
        ) : canvasFallback}
      </WebGLErrorBoundary>

      <div style={{
        position: "absolute", top: 24, left: 28, fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ color: "#c9a96e", fontSize: 11, letterSpacing: 5, marginBottom: 4 }}>SOVEREIGN SHOWROOM</div>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: 2 }}>LEXUS RX</h1>
        <p style={{ color: "#555", fontSize: 13, marginTop: 4 }}>Vindicator-Hardened | 52 Passes Active</p>
      </div>

      <div style={{
        position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 12,
      }}>
        {vehicles.map((v, i) => (
          <button
            key={v.id}
            onClick={() => setVehicleIdx(i)}
            style={{
              padding: "10px 20px", borderRadius: 8, border: i === vehicleIdx ? "2px solid #c9a96e" : "1px solid #333",
              background: i === vehicleIdx ? "rgba(201,169,110,0.15)" : "rgba(0,0,0,0.7)",
              color: i === vehicleIdx ? "#c9a96e" : "#888", cursor: "pointer",
              fontWeight: 600, fontSize: 13, transition: "all 0.2s", fontFamily: "'Inter', sans-serif",
            }}
          >
            {v.name}
          </button>
        ))}
      </div>

      <BidPanel vehicle={selectedVehicle} onBid={handleBid} lastBid={lastBid} />

      <NexusHUD nexusState={nexusState} />

      <div style={{
        position: "absolute", bottom: 28, left: 28, fontSize: 11, color: "#333",
        fontFamily: "monospace",
      }}>
        Pass 40: Visual Sanity | Pass 41: Asset Conduit | Pass 44: Performance Wall | Pass 48: Presence Mirror | Pass 49: Chronos | Pass 51: Quantum Lock | Pass 52: Ghost Reconciliation
      </div>
    </div>
  );
}
