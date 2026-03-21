# Project Showroom — Lexus RX300 Vindicator Audit Report

## System Status
- **659/659 tests passing** (verified via `tsx lib/engine-react/src/type-hardener.test.ts`)
- **3 engines compile clean** (React, FastAPI, Mobile — zero TypeScript errors)
- **47 total Vindicator interceptions** on naive showroom code

---

## What You Can Physically Verify Right Now

### 1. IDP Frontend (Observable UI)
The IDP *itself* is the product — it's the platform that generates apps.
You can interact with it at the frontend URL shown in the Replit preview pane.

### 2. The 659-Test Suite
Run this command yourself in the shell:
```bash
./node_modules/.pnpm/node_modules/.bin/tsx lib/engine-react/src/type-hardener.test.ts
```

### 3. What "Project Showroom" Actually Is
The Lexus RX300 Showroom is a **stress-test scenario** — realistic naive code
(3D scene, bidding backend, mobile controller) fed through the three hardener
engines to validate every pass fires. It does NOT produce a running Lexus app.
The outputs are transformed code strings validated by assertions.

To generate an actual running Lexus showroom, you would use the IDP's
generation pipeline (POST /api/projects with a prompt like "Build a Lexus
RX300 3D showroom with bidding").

---

## Vindicator Audit Log (47 Interceptions)

### React Engine — 23 interceptions
| # | Target File | Transformation |
|---|------------|----------------|
| 1 | server/tsconfig.json | Fixed moduleResolution/types cleanup |
| 2 | client/src/lib/visual-sanity.ts | Injected floor constraint + radial boundary guard |
| 3 | client/src/lib/asset-conduit.ts | Injected validation limits (50k verts, 1024px textures) |
| 4 | ShowroomScene.tsx | GPU disposal cleanup for useGLTF |
| 5 | ShowroomScene.tsx | meshBasicMaterial → meshStandardMaterial |
| 6 | client/src/lib/command-bus.ts | Injected undo/redo history stack |
| 7 | showroom-ctrl.ts | Exhaustive default:never guard |
| 8 | nl-command-parser.ts | NL parser with VALID_ACTIONS guard |
| 9 | ai-command.ts | Markdown fence stripping for AI responses |
| 10 | performance-wall.ts | Instance threshold, LOD, adaptive DPR |
| 11 | ShowroomScene.tsx | .map() → Instances (1 draw call) |
| 12 | ShowroomScene.tsx | AdaptiveDpr + AdaptiveEvents |
| 13 | vite-env.d.ts | import.meta.env support |
| 14 | engine-dispatcher.ts | Multi-engine routing + cross-stack hooks |
| 15 | nl-command-parser.ts | parseNaturalLanguageMultiEngine() |
| 16 | presence-system.ts | Zustand store, peer tracking, cursor lerp |
| 17 | PresenceAvatars.tsx | 3D cursor spheres with name labels |
| 18 | use-presence-socket.ts | WebSocket presence, 50ms broadcast |
| 19 | server/index.ts | /api/presence/active endpoint |
| 20 | chronos.ts | ChronosStore, snapshot management, locking |
| 21 | chronos-auto-save.ts | 5s auto-save, API persistence |
| 22 | chronos-world-lock.ts | World/node lock utilities |
| 23 | server/index.ts | /api/snapshots CRUD endpoints |

### FastAPI Engine — 13 interceptions
| # | Target File | Transformation |
|---|------------|----------------|
| 1 | main.py | declarative_base() → DeclarativeBase (SQLAlchemy 2.0) |
| 2 | main.py | Column() → mapped_column() |
| 3 | main.py | class Config → model_config = ConfigDict() (Pydantic V2) |
| 4 | main.py | sync def → async def |
| 5 | main.py | Hardcoded DB URL → os.getenv("DATABASE_URL") |
| 6 | main.py | ConfigDict(extra="forbid") on BidCreate |
| 7 | requirements.txt | Pinned dependency versions |
| 8 | main.py | limit/offset pagination on get_all_vehicles() |
| 9 | main.py | GZipMiddleware(minimum_size=500) |
| 10 | presence_relay.py | PresenceManager, WebSocket relay, conflict resolution |
| 11 | main.py | /ws/presence + /api/presence/active endpoints |
| 12 | snapshot_store.py | SnapshotStore, world locking, diff, eviction |
| 13 | main.py | /api/snapshots CRUD, /api/world/lock|unlock|status |

### Mobile Engine — 11 interceptions
| # | Target File | Transformation |
|---|------------|----------------|
| 1 | showroom.tsx | StyleSheet.create removed (NativeWind) |
| 2 | bid.tsx | localStorage → AsyncStorage |
| 3 | package.json | Removed ^ and ~ version prefixes |
| 4 | asset-limits.ts | 1024px max, format whitelist |
| 5 | showroom.tsx | resizeMode="cover" + loading="lazy" |
| 6 | showroom.tsx | Animated → react-native-reanimated |
| 7 | performance-wall.ts | MOBILE_PERF_LIMITS constants |
| 8 | haptic-presence.ts | 6 event types, throttled haptics |
| 9 | package.json | Added expo-haptics |
| 10 | chronos-mobile.ts | Offline queue, auto-reconnect, haptic save |
| 11 | package.json | Added @react-native-community/netinfo |
