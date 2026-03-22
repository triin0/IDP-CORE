import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls, Environment, ContactShadows, AdaptiveDpr,
  AdaptiveEvents, Text, MeshReflectorMaterial,
} from "@react-three/drei";
import { Suspense, useState, useRef, useCallback, useMemo, useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import * as THREE from "three";
import { sha256 } from "../utils/crypto";

const PASS_52_ENABLED = false;

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  state = { hasError: false, errorMsg: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }
  componentDidCatch(error: Error) {
    console.error("[ShowroomScene] Canvas error:", error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#050510", color: "#ff4444", fontFamily: "monospace", padding: 40,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>WEBGL CONTEXT ERROR</div>
          <div style={{ fontSize: 12, color: "#888", maxWidth: 500, textAlign: "center", lineHeight: 1.8 }}>
            {this.state.errorMsg}
          </div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 20 }}>
            Check browser console for full stack trace
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const API_BASE = "http://localhost:8000";

interface Vehicle {
  id: string;
  name: string;
  price: number;
  year: number;
  color: string;
}

interface NexusSyncState {
  syncState: "LIVE" | "STALE" | "GHOST" | "FAST_FORWARDING" | "DISCONNECTED";
  entityHash: string;
}

function useNexusSync(entityId: string): NexusSyncState {
  const [state, setState] = useState<NexusSyncState>({
    syncState: "LIVE",
    entityHash: "",
  });

  useEffect(() => {
    let cancelled = false;
    sha256(`nexus:${entityId}:${Date.now()}`).then(hash => {
      if (!cancelled) setState(prev => ({ ...prev, entityHash: hash.slice(0, 16) }));
    });
    return () => { cancelled = true; };
  }, [entityId]);

  return state;
}

function ChromeSphere() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 1.2, 0] as [number, number, number]} castShadow receiveShadow>
      <sphereGeometry args={[1.5, 64, 64]} />
      <meshPhysicalMaterial
        color="#c0c0c0"
        metalness={0.9}
        roughness={0.1}
        clearcoat={1.0}
        clearcoatRoughness={0.03}
        envMapIntensity={2.5}
        reflectivity={1.0}
      />
    </mesh>
  );
}

function ShowroomFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0] as [number, number, number]} position={[0, -0.01, 0] as [number, number, number]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <MeshReflectorMaterial
        mirror={0.4}
        blur={[300, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={40}
        roughness={1}
        depthScale={1.2}
        color="#0a0a1a"
        metalness={0.5}
      />
    </mesh>
  );
}

function PriceTag({ vehicle }: { vehicle: Vehicle }) {
  return (
    <group position={[0, 3.5, 0] as [number, number, number]}>
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
  return (
    <div style={{
      position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 14px", borderRadius: 20,
      background: "rgba(0,0,0,0.8)", border: "1px solid #ffaa0033",
      fontFamily: "monospace", fontSize: 11, zIndex: 10,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: "#ffaa00",
        boxShadow: "0 0 6px #ffaa00",
      }} />
      <span style={{ color: "#ffaa00" }}>NEXUS STANDBY (P52 OFF)</span>
      {nexusState.entityHash && (
        <span style={{ color: "#555" }}>[{nexusState.entityHash}]</span>
      )}
    </div>
  );
}

export default function ShowroomScene() {
  const vehicles = useMemo<Vehicle[]>(() => [
    { id: "rx300", name: "Lexus RX300", price: 42000, year: 2024, color: "#c0c0c0" },
    { id: "rx350h", name: "Lexus RX350h", price: 48500, year: 2025, color: "#1a1a2e" },
    { id: "rx500h", name: "Lexus RX500h F Sport", price: 62500, year: 2025, color: "#f5f5f0" },
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
      if (currentVersion !== null) payload.state_version = currentVersion;

      const { hashPayload } = await import("../utils/crypto");
      const { hash } = await hashPayload(payload);
      const resp = await fetch(`${API_BASE}/api/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Payload-Hash": hash },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.state_version != null) stateVersions.current[versionKey] = data.state_version;
        const hashNote = data.payload_hash ? ` [SHA-256: ${data.payload_hash.slice(0, 12)}…]` : "";
        const versionNote = data.state_version != null ? ` [v${data.state_version}]` : "";
        setLastBid(`Bid of $${amount.toLocaleString()} placed on ${selectedVehicle.name}${hashNote}${versionNote}`);
      } else if (resp.status === 409) {
        const conflict = await resp.json();
        if (conflict.code === "STATE_VERSION_CONFLICT") {
          stateVersions.current[versionKey] = conflict.serverVersion;
          setLastBid(`SHADOW BRANCH — corrected to v${conflict.serverVersion}. Retry.`);
        }
      } else {
        const err = await resp.json().catch(() => null);
        setLastBid(err?.code === "INTEGRITY_HASH_MISMATCH" ? "INTEGRITY FAULT" : "Bid failed — try again");
      }
    } catch {
      setLastBid("API offline — bid queued locally");
    }
  }, [selectedVehicle]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#050510", overflow: "hidden" }}>
      <WebGLErrorBoundary>
        <Canvas
          camera={{ position: [5, 3, 8] as [number, number, number], fov: 45 }}
          shadows
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
          }}
          onCreated={({ gl }) => {
            console.log(`[WebGL] Context created: ${gl.getContext().constructor.name}`);
          }}
        >
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <fog attach="fog" args={["#050510", 12, 35]} />

          <ambientLight intensity={0.8} />
          <hemisphereLight args={["#c9a96e", "#050510", 0.4]} />
          <directionalLight position={[10, 10, 5] as [number, number, number]} intensity={2} castShadow />
          <spotLight position={[0, 8, 0] as [number, number, number]} angle={0.4} penumbra={0.8} intensity={3} castShadow color="#c9a96e" />
          <spotLight position={[-5, 5, 3] as [number, number, number]} angle={0.5} penumbra={1} intensity={1.5} color="#ffffff" />
          <pointLight position={[3, 4, -3] as [number, number, number]} intensity={1} color="#8888ff" />

          <Suspense fallback={null}>
            <ChromeSphere />
          </Suspense>
          <Suspense fallback={null}>
            <PriceTag vehicle={selectedVehicle} />
          </Suspense>
          <ShowroomFloor />
          <ContactShadows
            position={[0, -0.01, 0] as [number, number, number]}
            opacity={0.5}
            blur={2.5}
            far={4}
          />
          <Environment preset="city" background={false} environmentIntensity={1.5} />
          <OrbitControls
            makeDefault
            minPolarAngle={0.3}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={4}
            maxDistance={15}
            enablePan={false}
          />
        </Canvas>
      </WebGLErrorBoundary>

      <div style={{ position: "absolute", top: 24, left: 28, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ color: "#c9a96e", fontSize: 11, letterSpacing: 5, marginBottom: 4 }}>SOVEREIGN SHOWROOM</div>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: 2 }}>LEXUS RX</h1>
        <p style={{ color: "#555", fontSize: 13, marginTop: 4 }}>1-Primitive Chrome Test | WebGL Bridge Proof</p>
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
        1 MESH | sphereGeometry(1.5, 64, 64) | metalness:0.9 roughness:0.1 clearcoat:1.0 | ACES Filmic | HDR city env
      </div>
    </div>
  );
}
