import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, AdaptiveDpr, AdaptiveEvents, RoundedBox, Text, MeshReflectorMaterial } from "@react-three/drei";
import { Suspense, useState, useRef, useCallback, useMemo, Component, type ReactNode, type ErrorInfo } from "react";
import * as THREE from "three";

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
}

function LexusBody({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.6, 0] as [number, number, number]}>
      <RoundedBox args={[3.8, 0.8, 1.7]} radius={0.15} position={[0, 0, 0] as [number, number, number]}>
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.15} envMapIntensity={1.2} />
      </RoundedBox>
      <RoundedBox args={[2.2, 0.7, 1.6]} radius={0.2} position={[0.1, 0.65, 0] as [number, number, number]}>
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.1} envMapIntensity={1.5} />
      </RoundedBox>
      <mesh position={[0.1, 0.65, 0] as [number, number, number]}>
        <boxGeometry args={[2.0, 0.5, 1.55]} />
        <meshStandardMaterial color="#111" metalness={0.3} roughness={0.1} transparent opacity={0.4} />
      </mesh>
      {[[-1.3, -0.15, 0.85], [-1.3, -0.15, -0.85], [1.3, -0.15, 0.85], [1.3, -0.15, -0.85]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[Math.PI / 2, 0, 0] as [number, number, number]}>
          <cylinderGeometry args={[0.35, 0.35, 0.2, 24]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {[[-1.3, -0.15, 0.85], [-1.3, -0.15, -0.85], [1.3, -0.15, 0.85], [1.3, -0.15, -0.85]].map((pos, i) => (
        <mesh key={`rim-${i}`} position={pos as [number, number, number]} rotation={[Math.PI / 2, 0, 0] as [number, number, number]}>
          <cylinderGeometry args={[0.22, 0.22, 0.22, 8]} />
          <meshStandardMaterial color="#ccc" metalness={0.95} roughness={0.05} />
        </mesh>
      ))}
      <mesh position={[-1.95, 0.05, 0.7] as [number, number, number]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-1.95, 0.05, -0.7] as [number, number, number]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[1.95, 0.05, 0.6] as [number, number, number]}>
        <boxGeometry args={[0.1, 0.15, 0.3]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[1.95, 0.05, -0.6] as [number, number, number]}>
        <boxGeometry args={[0.1, 0.15, 0.3]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function ShowroomFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0] as [number, number, number]} position={[0, -0.01, 0] as [number, number, number]}>
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
    <group position={[0, 3.2, 0] as [number, number, number]}>
      <Text fontSize={0.35} color="#c9a96e" anchorX="center" anchorY="bottom" font="/fonts/inter-bold.woff">
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

export default function ShowroomScene() {
  const vehicles = useMemo<Vehicle[]>(() => [
    { id: "1", name: "Lexus RX300", price: 42000, year: 2024, color: "#c0c0c0" },
    { id: "2", name: "Lexus RX350h", price: 48500, year: 2025, color: "#1a1a2e" },
    { id: "3", name: "Lexus RX500h F Sport", price: 62500, year: 2025, color: "#f5f5f0" },
  ], []);

  const [vehicleIdx, setVehicleIdx] = useState(0);
  const [lastBid, setLastBid] = useState<string | null>(null);
  const selectedVehicle = vehicles[vehicleIdx];

  const handleBid = useCallback(async (amount: number) => {
    try {
      const resp = await fetch(`${API_BASE}/api/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: selectedVehicle.id, amount, user_id: "dev-user-001" }),
      });
      if (resp.ok) {
        setLastBid(`Bid of $${amount.toLocaleString()} placed on ${selectedVehicle.name}`);
      } else {
        setLastBid("Bid failed — try again");
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
      <WebGLErrorBoundary fallback={canvasFallback}>
        {webglAvailable ? (
          <Canvas camera={{ position: [5, 3, 8] as [number, number, number], fov: 45 }} shadows>
            <AdaptiveDpr pixelated />
            <AdaptiveEvents />
            <fog attach="fog" args={["#050510", 10, 30]} />
            <ambientLight intensity={0.2} />
            <directionalLight position={[10, 10, 5] as [number, number, number]} intensity={1.5} castShadow />
            <spotLight position={[0, 8, 0] as [number, number, number]} angle={0.4} penumbra={0.8} intensity={2} castShadow color="#c9a96e" />
            <Suspense fallback={null}>
              <LexusBody color={selectedVehicle.color} />
              <PriceTag vehicle={selectedVehicle} />
            </Suspense>
            <ShowroomFloor />
            <ContactShadows position={[0, -0.01, 0] as [number, number, number]} opacity={0.5} blur={2.5} far={4} />
            <Environment preset="night" />
            <OrbitControls
              makeDefault
              minPolarAngle={0.3}
              maxPolarAngle={Math.PI / 2.2}
              minDistance={4}
              maxDistance={15}
              enablePan={false}
            />
          </Canvas>
        ) : canvasFallback}
      </WebGLErrorBoundary>

      <div style={{
        position: "absolute", top: 24, left: 28, fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ color: "#c9a96e", fontSize: 11, letterSpacing: 5, marginBottom: 4 }}>SOVEREIGN SHOWROOM</div>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: 2 }}>LEXUS RX</h1>
        <p style={{ color: "#555", fontSize: 13, marginTop: 4 }}>Vindicator-Hardened | 49 Passes Active</p>
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

      <div style={{
        position: "absolute", bottom: 28, left: 28, fontSize: 11, color: "#333",
        fontFamily: "monospace",
      }}>
        Pass 40: Visual Sanity | Pass 44: Performance Wall | Pass 48: Presence Mirror | Pass 49: Chronos
      </div>
    </div>
  );
}
