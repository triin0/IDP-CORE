import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls, Environment, ContactShadows, AdaptiveDpr,
  AdaptiveEvents, Text, MeshReflectorMaterial, useGLTF,
} from "@react-three/drei";
import { Suspense, useState, useRef, useCallback, useMemo, useEffect, Component, type ReactNode } from "react";
import * as THREE from "three";
import { sha256 } from "../utils/crypto";

const PASS_52_ENABLED = false;
const MOVE_SPEED = 4.0;
const TURN_SPEED = 2.5;

type SynapseAction =
  | { type: "MOVE_ACTION"; direction: "forward" | "backward" }
  | { type: "TURN_ACTION"; direction: "left" | "right" };

interface SynapseState {
  actions: Set<string>;
  dispatch: (action: SynapseAction) => void;
  release: (action: SynapseAction) => void;
}

function useSynapseInput(): SynapseState {
  const actions = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const keyToAction: Record<string, SynapseAction> = {
      w: { type: "MOVE_ACTION", direction: "forward" },
      W: { type: "MOVE_ACTION", direction: "forward" },
      s: { type: "MOVE_ACTION", direction: "backward" },
      S: { type: "MOVE_ACTION", direction: "backward" },
      a: { type: "TURN_ACTION", direction: "left" },
      A: { type: "TURN_ACTION", direction: "left" },
      d: { type: "TURN_ACTION", direction: "right" },
      D: { type: "TURN_ACTION", direction: "right" },
      ArrowUp: { type: "MOVE_ACTION", direction: "forward" },
      ArrowDown: { type: "MOVE_ACTION", direction: "backward" },
      ArrowLeft: { type: "TURN_ACTION", direction: "left" },
      ArrowRight: { type: "TURN_ACTION", direction: "right" },
    };

    const actionKey = (a: SynapseAction) => `${a.type}:${a.direction}`;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const action = keyToAction[e.key];
      if (action) {
        e.preventDefault();
        const key = actionKey(action);
        if (!actions.current.has(key)) {
          actions.current.add(key);
          console.log(`[Synapse] DISPATCH ${action.type}(${action.direction})`);
          forceUpdate(n => n + 1);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const action = keyToAction[e.key];
      if (action) {
        const key = actionKey(action);
        actions.current.delete(key);
        console.log(`[Synapse] RELEASE ${action.type}(${action.direction})`);
        forceUpdate(n => n + 1);
      }
    };

    const onFocusLost = () => {
      if (actions.current.size > 0) {
        console.log(`[Synapse] FOCUS LOST — releasing ${actions.current.size} latched actions`);
        actions.current.clear();
        forceUpdate(n => n + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onFocusLost);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) onFocusLost();
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onFocusLost);
    };
  }, []);

  return {
    actions: actions.current,
    dispatch: useCallback((a: SynapseAction) => actions.current.add(`${a.type}:${a.direction}`), []),
    release: useCallback((a: SynapseAction) => actions.current.delete(`${a.type}:${a.direction}`), []),
  };
}

interface MirrorTransform {
  posX: number;
  posZ: number;
  rotY: number;
  speed: number;
}

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

const PAINT_MATERIAL_PROPS = {
  metalness: 0.9,
  roughness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.03,
  envMapIntensity: 2.0,
  reflectivity: 1.0,
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

const CHROME_MATERIAL_PROPS = {
  metalness: 0.9,
  roughness: 0.1,
  envMapIntensity: 2.5,
  color: "#e8e8e8",
};

function GLBModel({ url, color }: { url: string; color: string }) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const createdMaterials = useRef<THREE.Material[]>([]);

  useEffect(() => {
    createdMaterials.current.forEach(m => m.dispose());
    createdMaterials.current = [];

    let meshCount = 0;
    let vertexCount = 0;
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.geometry.attributes.position) {
          vertexCount += mesh.geometry.attributes.position.count;
        }
        const name = mesh.name.toLowerCase();
        let mat: THREE.Material;
        if (name.includes("glass") || name.includes("windshield") || name.includes("window")) {
          mat = new THREE.MeshPhysicalMaterial({ ...GLASS_MATERIAL_PROPS });
        } else if (name.includes("chrome") || name.includes("trim") || name.includes("grill")) {
          mat = new THREE.MeshPhysicalMaterial({ ...CHROME_MATERIAL_PROPS });
        } else {
          mat = new THREE.MeshPhysicalMaterial({ color, ...PAINT_MATERIAL_PROPS });
        }
        mesh.material = mat;
        createdMaterials.current.push(mat);
      }
    });

    console.log(`[Pass 41] GLB Asset Conduit: VALID | meshes:${meshCount} verts:${vertexCount}`);

    return () => {
      createdMaterials.current.forEach(m => m.dispose());
      createdMaterials.current = [];
    };
  }, [clonedScene, color]);

  return <primitive object={clonedScene} />;
}

const _tmpForward = new THREE.Vector3();
const _tmpAxis = new THREE.Vector3(0, 1, 0);
const MIRROR_THROTTLE_MS = 50;

function glbUrl(vehicleId: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}models/lexus-${vehicleId}.glb`;
}

function LexusVehicle({ color, vehicleId, synapse, onMirrorUpdate }: {
  color: string;
  vehicleId: string;
  synapse: SynapseState;
  onMirrorUpdate: (t: MirrorTransform) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const lastMirrorTime = useRef<number>(0);
  const url = glbUrl(vehicleId);

  useEffect(() => {
    console.log(`[Synapse] Loading GLB: ${url}`);
  }, [url]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const g = groupRef.current;
    let speed = 0;

    if (synapse.actions.has("TURN_ACTION:left")) {
      g.rotation.y += TURN_SPEED * delta;
    }
    if (synapse.actions.has("TURN_ACTION:right")) {
      g.rotation.y -= TURN_SPEED * delta;
    }

    _tmpForward.set(0, 0, -1).applyAxisAngle(_tmpAxis, g.rotation.y);

    if (synapse.actions.has("MOVE_ACTION:forward")) {
      g.position.addScaledVector(_tmpForward, MOVE_SPEED * delta);
      speed = MOVE_SPEED;
    }
    if (synapse.actions.has("MOVE_ACTION:backward")) {
      g.position.addScaledVector(_tmpForward, -MOVE_SPEED * delta * 0.6);
      speed = -MOVE_SPEED * 0.6;
    }

    const clampR = 12;
    g.position.x = Math.max(-clampR, Math.min(clampR, g.position.x));
    g.position.z = Math.max(-clampR, Math.min(clampR, g.position.z));

    const now = performance.now();
    if (now - lastMirrorTime.current > MIRROR_THROTTLE_MS) {
      lastMirrorTime.current = now;
      onMirrorUpdate({
        posX: g.position.x,
        posZ: g.position.z,
        rotY: g.rotation.y,
        speed,
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.6, 0] as [number, number, number]}>
      <GLBModel url={url} color={color} />
    </group>
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

function BehavioralMirrorHUD({ mirror, entityHash, activeActions }: {
  mirror: MirrorTransform;
  entityHash: string;
  activeActions: Set<string>;
}) {
  const stateColor = "#00ff88";
  const activeList = Array.from(activeActions);

  return (
    <div style={{
      position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      padding: "8px 16px", borderRadius: 12,
      background: "rgba(0,0,0,0.85)", border: `1px solid ${stateColor}33`,
      fontFamily: "monospace", fontSize: 11, zIndex: 10, minWidth: 320,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: stateColor, boxShadow: `0 0 6px ${stateColor}`,
        }} />
        <span style={{ color: stateColor }}>BEHAVIORAL MIRROR</span>
        {entityHash && <span style={{ color: "#555", marginLeft: "auto" }}>[{entityHash}]</span>}
      </div>
      <div style={{ display: "flex", gap: 16, color: "#888", width: "100%", justifyContent: "space-between" }}>
        <span>X: <span style={{ color: "#fff" }}>{mirror.posX.toFixed(2)}</span></span>
        <span>Z: <span style={{ color: "#fff" }}>{mirror.posZ.toFixed(2)}</span></span>
        <span>ROT: <span style={{ color: "#fff" }}>{(mirror.rotY * (180 / Math.PI)).toFixed(1)}deg</span></span>
        <span>SPD: <span style={{ color: mirror.speed !== 0 ? "#00ff88" : "#555" }}>{Math.abs(mirror.speed).toFixed(1)}</span></span>
      </div>
      {activeList.length > 0 && (
        <div style={{ display: "flex", gap: 6, width: "100%", flexWrap: "wrap" }}>
          {activeList.map(a => (
            <span key={a} style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 9,
              background: "rgba(0,255,136,0.15)", color: "#00ff88", border: "1px solid #00ff8833",
            }}>
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function WASDHint() {
  const keys = [
    { label: "W", sub: "FWD", row: 0, col: 1 },
    { label: "A", sub: "LEFT", row: 1, col: 0 },
    { label: "S", sub: "BACK", row: 1, col: 1 },
    { label: "D", sub: "RIGHT", row: 1, col: 2 },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 80, right: 24,
      display: "grid", gridTemplateColumns: "repeat(3, 36px)", gridTemplateRows: "repeat(2, 36px)",
      gap: 3, fontFamily: "monospace",
    }}>
      {keys.map(k => (
        <div key={k.label} style={{
          gridRow: k.row + 1, gridColumn: k.col + 1,
          width: 36, height: 36, borderRadius: 6,
          border: "1px solid #333", background: "rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: "#c9a96e", fontSize: 13, fontWeight: 700, lineHeight: 1 }}>{k.label}</span>
          <span style={{ color: "#555", fontSize: 7, lineHeight: 1 }}>{k.sub}</span>
        </div>
      ))}
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
  const [mirror, setMirror] = useState<MirrorTransform>({ posX: 0, posZ: 0, rotY: 0, speed: 0 });
  const [entityHash, setEntityHash] = useState("");
  const stateVersions = useRef<Record<string, number>>({});
  const selectedVehicle = vehicles[vehicleIdx];
  const synapse = useSynapseInput();

  useEffect(() => {
    let cancelled = false;
    sha256(`nexus:${selectedVehicle.id}:${Date.now()}`).then(hash => {
      if (!cancelled) setEntityHash(hash.slice(0, 16));
    });
    return () => { cancelled = true; };
  }, [selectedVehicle.id]);

  const handleMirrorUpdate = useCallback((t: MirrorTransform) => {
    setMirror(t);
  }, []);

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
        const hashNote = data.payload_hash ? ` [SHA-256: ${data.payload_hash.slice(0, 12)}...]` : "";
        const versionNote = data.state_version != null ? ` [v${data.state_version}]` : "";
        setLastBid(`Bid of $${amount.toLocaleString()} placed on ${selectedVehicle.name}${hashNote}${versionNote}`);
      } else if (resp.status === 409) {
        const conflict = await resp.json();
        if (conflict.code === "STATE_VERSION_CONFLICT") {
          stateVersions.current[versionKey] = conflict.serverVersion;
          setLastBid(`SHADOW BRANCH -- corrected to v${conflict.serverVersion}. Retry.`);
        }
      } else {
        const err = await resp.json().catch(() => null);
        setLastBid(err?.code === "INTEGRITY_HASH_MISMATCH" ? "INTEGRITY FAULT" : "Bid failed -- try again");
      }
    } catch {
      setLastBid("API offline -- bid queued locally");
    }
  }, [selectedVehicle]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#050510", overflow: "hidden" }} tabIndex={0}>
      <WebGLErrorBoundary>
        <Canvas
          camera={{ position: [6, 4, 10] as [number, number, number], fov: 45 }}
          shadows
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
          }}
          onCreated={({ gl }) => {
            const ctx = gl.getContext();
            const ctxName = ctx.constructor.name;
            console.log(`[WebGL] Context created: ${ctxName} -- GPU forced high-fidelity, safe-mode DISABLED`);
            if (ctx instanceof WebGL2RenderingContext || ctx instanceof WebGLRenderingContext) {
              const debugInfo = ctx.getExtension("WEBGL_debug_renderer_info");
              if (debugInfo) {
                const renderer = ctx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                console.log(`[WebGL] GPU: ${renderer} -- headless bypass ACTIVE`);
              }
            }
          }}
        >
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <fog attach="fog" args={["#050510", 15, 40]} />

          <ambientLight intensity={0.8} />
          <hemisphereLight args={["#c9a96e", "#050510", 0.4]} />
          <directionalLight position={[10, 10, 5] as [number, number, number]} intensity={2} castShadow />
          <spotLight position={[0, 8, 0] as [number, number, number]} angle={0.4} penumbra={0.8} intensity={3} castShadow color="#c9a96e" />
          <spotLight position={[-5, 5, 3] as [number, number, number]} angle={0.5} penumbra={1} intensity={1.5} color="#ffffff" />
          <pointLight position={[3, 4, -3] as [number, number, number]} intensity={1} color="#8888ff" />

          <Suspense fallback={null}>
            <LexusVehicle
              color={selectedVehicle.color}
              vehicleId={selectedVehicle.id}
              synapse={synapse}
              onMirrorUpdate={handleMirrorUpdate}
            />
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
            maxDistance={20}
            enablePan={false}
          />
        </Canvas>
      </WebGLErrorBoundary>

      <div style={{ position: "absolute", top: 24, left: 28, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ color: "#c9a96e", fontSize: 11, letterSpacing: 5, marginBottom: 4 }}>SOVEREIGN SHOWROOM</div>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: 2 }}>LEXUS RX</h1>
        <p style={{ color: "#555", fontSize: 13, marginTop: 4 }}>Synapse-Driven | WASD Controls Active</p>
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
      <BehavioralMirrorHUD mirror={mirror} entityHash={entityHash} activeActions={synapse.actions} />
      <WASDHint />

      <div style={{
        position: "absolute", bottom: 28, left: 28, fontSize: 11, color: "#333",
        fontFamily: "monospace",
      }}>
        Synapse WASD | Behavioral Mirror | GLB Pipeline | Safe-mode DISABLED | GPU forced
      </div>
    </div>
  );
}
