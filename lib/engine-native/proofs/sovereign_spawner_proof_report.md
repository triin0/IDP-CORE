# Sovereign Spawner — Module 9 Proof Report
## Volcanic x Crystalline Cross: The Obsidian-Glass Genesis

### Cross Summary
| Field | Value |
|-------|-------|
| Parent A (Volcanic) | `6feb7ca617bf5e0d6f10a06ff25e3ba8f27f674bc381e3aefe1bd9bd51e184b8` |
| Parent A Class | ORGANIC |
| Parent B (Crystalline) | `a4c42d6720292bec39403872589d0c3749d2969f44bcd99c762090238a6d806e` |
| Parent B Class | ORGANIC |
| Sovereign Seed | `obsidian-glass-genesis` |
| Child Hash | `7e05136a6829185fac9ce51cf6e25124266c7859b2ea56d2992ec4535df86335` |
| Child Class | ORGANIC |
| Generation | 1 |
| Total Mutations | 1 |
| Lineage Hash | `c0e6c97e8944fd8ff258056b8185b8095ccce2ca2b6b982f51daf17da02247f3` |
| Lineage Integrity | PASS |
| Child Phenotype Integrity | PASS |

---

## 2. Locus-by-Locus Inheritance (The Ribosome Proof)

| # | Locus | Dominance | Parent A (hex/raw) | Parent B (hex/raw) | Child (raw) | Mode | Mutated |
|---|-------|-----------|---------------------|---------------------|-------------|------|----------|
| 0 | primaryR | CODOMINANT | `6f` (111) | `a4` (164) | 111 | BLEND | no |
| 1 | primaryG | CODOMINANT | `eb` (235) | `c4` (196) | 201 | BLEND | no |
| 2 | primaryB | CODOMINANT | `7c` (124) | `2d` (45) | 45 | PARENT_B | no |
| 3 | accentR | RECESSIVE | `a6` (166) | `67` (103) | 103 | PARENT_B | no |
| 4 | accentG | RECESSIVE | `17` (23) | `20` (32) | 32 | PARENT_B | no |
| 5 | accentB | RECESSIVE | `bf` (191) | `29` (41) | 249 | MUTATION | **YES** |
| 6 | metallic | DOMINANT | `5e` (94) | `2b` (43) | 43 | PARENT_B | no |
| 7 | roughness | CODOMINANT | `0d` (13) | `ec` (236) | 13 | PARENT_A | no |
| 8 | emission | DOMINANT | `6f` (111) | `39` (57) | 111 | PARENT_A | no |
| 9 | opacity | RECESSIVE | `10` (16) | `40` (64) | 16 | PARENT_A | no |
| 10 | meshIndex | DOMINANT | `a06f` (41071) | `3872` (14450) | 41071 | PARENT_A | no |
| 11 | scaleX | CODOMINANT | `f25e` (62046) | `589d` (22685) | 39820 | BLEND | no |
| 12 | scaleY | CODOMINANT | `3ba8` (15272) | `0c37` (3127) | 15272 | PARENT_A | no |
| 13 | scaleZ | CODOMINANT | `f27f` (62079) | `49d2` (18898) | 36882 | BLEND | no |
| 14 | subsurface | RECESSIVE | `e3` (227) | `d9` (217) | 227 | PARENT_A | no |
| 15 | anisotropy | RECESSIVE | `ae` (174) | `9c` (156) | 174 | PARENT_A | no |

### Codominant Blend Analysis (Primary/Accent Colors)

- **primaryR**: BLEND mode. A=111, B=164, Child=111. Formula: `child = A*(1-t) + B*t` where t derived from dominanceRoll
- **primaryG**: BLEND mode. A=235, B=196, Child=201. Formula: `child = A*(1-t) + B*t` where t derived from dominanceRoll
- **primaryB**: PARENT_B (value=45)
- **accentR**: PARENT_B (value=103)
- **accentG**: PARENT_B (value=32)
- **accentB**: MUTATION (value=249)

### Dominant Inheritance: Emission Gene (Locus 8)

- Dominance type: **DOMINANT**
- Parent A emission raw: 111
- Parent B emission raw: 57
- Middle bits A (genome[12]): 242
- Middle bits B (genome[12]): 88
- A stronger (middleBitsA >= middleBitsB): YES
- Inherited from: **PARENT_A**
- Child emission value: 111


### Bitwise Crossover Mask Derivation

```
1. RNG seeded with: SHA256(sovereignSeed + ":crossover")
   Seed = SHA256("obsidian-glass-genesis:crossover")
   = 89da00551c2da5a8c5e5176e7fc1d3bb1538e84a7efbe5a008ead6d83b1ec9fd

2. Per-locus decision chain (16 loci):
   For each locus:
     mutationRoll = rng.next01()
     effectiveRate = min(baseMutationRate * mutationSensitivity * 100, 0.10)
     if mutationRoll < effectiveRate:
       -> MUTATION (wildcard bytes from RNG)
     else:
       dominanceRoll = rng.next01()
       middleBitsA = genome_A[12 + (locusIndex % 8)]
       middleBitsB = genome_B[12 + (locusIndex % 8)]
       aStronger = middleBitsA >= middleBitsB
       DOMINANT:   aStronger ? PARENT_A : PARENT_B
       RECESSIVE:  !aStronger ? PARENT_A : PARENT_B
       CODOMINANT: roll<0.25->A, roll<0.50->B, else->BLEND

3. Child hash = SHA256(bytesToHex(childGenome) + ":" + effectiveSeed)
   effectiveSeed = "obsidian-glass-genesis"
```

---

## 1. Showroom Visualization Data (Module 7)

> **Note:** The Sovereign Showroom is a C++/UE5 USTRUCT pipeline.
> Actual 8K renders require an Unreal Engine 5 runtime with a GPU.
> Below is the complete camera rig, lighting profile, and pedigree
> data that UE5 would consume to produce each frame.

### Auto-Selected Camera Perspective: Cinematic

| Parameter | Value |
|-----------|-------|
| Perspective | Cinematic |
| Spring Arm Length | 318.14 |
| Focal Length | 50.00mm |
| Aperture (f-stop) | f/2.00 |
| Field of View | 45.00 deg |
| Focus Distance | 222.70 |
| Dolly Speed | 0.80 |
| Orbit Speed | 0.70 |
| Min Zoom | 0.30 |
| Max Zoom | 3.00 |

### Four Required Camera Angles (UE5 Rig Parameters)

#### HERO (18mm Wide-Angle)
| Parameter | Value |
|-----------|-------|
| Focal Length | 18mm |
| Field of View | 90 deg |
| Aperture | f/5.6 |
| Spring Arm | 600+ (scaled to entity) |
| Rotation | Yaw=0, Pitch=0 (front facing) |
| Resolution | 7680x4320 (8K UHD) |

#### MACRO (100mm Telephoto — Emission Veins)
| Parameter | Value |
|-----------|-------|
| Focal Length | 100mm |
| Field of View | 25 deg |
| Aperture | f/1.4 (shallow DOF) |
| Spring Arm | 80-140 (close-up) |
| Focus Target | Emission vein surface (byte 8 locus) |
| Child Emission Intensity | 6.75 |
| Resolution | 7680x4320 (8K UHD) |

#### TOP-DOWN
| Parameter | Value |
|-----------|-------|
| Rotation | Yaw=0, Pitch=-90 (directly above) |
| Focal Length | 50.00mm (auto) |
| Spring Arm | 381.77 (elevated) |
| Resolution | 7680x4320 (8K UHD) |

#### SIDE PROFILE
| Parameter | Value |
|-----------|-------|
| Rotation | Yaw=90, Pitch=0 (right side) |
| Focal Length | 50.00mm (auto) |
| Spring Arm | 318.14 (standard distance) |
| Resolution | 7680x4320 (8K UHD) |

### Lighting Profile: Organic
| Parameter | Value |
|-----------|-------|
| Profile Name | Organic |
| Temperature | 6500.00K |
| GI Intensity | 0.70 |
| Bloom Threshold | 0.70 |
| Bloom Intensity | 0.40 |
| Lens Flare | 0.00 |
| SSR Quality | 0.50 |
| Fog Density | 0.02 |
| Vignette | 0.20 |
| Exposure Bias | 0.00 |
| Reflection Samples | 4.00 |
| Chromatic Aberration | 0.00 |
| Refraction Depth | 0.00 |
| Caustics Intensity | 0.00 |
| Saturation | 1.00 |
| Contrast | 1.00 |
| HDRI Skybox | disabled |
| High-Contrast HDRI | disabled |
| Values Clamped | YES (zero drift) |

### Truth Overlay (FSovereignPedigree)
| Field | Value |
|-------|-------|
| Raw Hash | `7e05136a6829185fac9ce51cf6e25124266c7859b2ea56d2992ec4535df86335` |
| Phenotype Class | ORGANIC |
| Mesh Family | Dodecahedron |
| Loci Count | 16 |
| Server Verified | PENDING (no server in test) |
| Verification Status | UNVERIFIED |
| VERIFIED Badge Green | GREY (awaiting server) |

### 16 Gene Loci (Truth Overlay Data)
| # | Locus | Byte Offset | Hex | Normalized |
|---|-------|-------------|-----|------------|
| 0 | primaryR | 0 | `0x7e` | 0.4941 |
| 1 | primaryG | 1 | `0x05` | 0.0196 |
| 2 | primaryB | 2 | `0x13` | 0.0745 |
| 3 | accentR | 3 | `0x6a` | 0.4157 |
| 4 | accentG | 4 | `0x68` | 0.4078 |
| 5 | accentB | 5 | `0x29` | 0.1608 |
| 6 | metallic | 6 | `0x18` | 0.0941 |
| 7 | roughness | 7 | `0x5f` | 0.3725 |
| 8 | emission | 8 | `0xac` | 0.6745 |
| 9 | opacity | 9 | `0x9c` | 0.6118 |
| 10 | meshIndex | 10 | `0xe51c` | 0.8950 |
| 11 | scaleX | 12 | `0xf6e2` | 0.9644 |
| 12 | scaleY | 14 | `0x5124` | 0.3170 |
| 13 | scaleZ | 16 | `0x266c` | 0.1501 |
| 14 | uvTilingU | 18 | `0x7859` | 0.4701 |
| 15 | uvTilingV | 20 | `0xb2ea` | 0.6989 |

---

## 3. Chronos Persistence Log (The Memory Proof)

### FSpawnLineage Record
```
childHash:        7e05136a6829185fac9ce51cf6e25124266c7859b2ea56d2992ec4535df86335
parentAHash:      6feb7ca617bf5e0d6f10a06ff25e3ba8f27f674bc381e3aefe1bd9bd51e184b8
parentBHash:      a4c42d6720292bec39403872589d0c3749d2969f44bcd99c762090238a6d806e
sovereignSeed:    obsidian-glass-genesis
generation:       1
totalMutations:   1
lineageHash:      c0e6c97e8944fd8ff258056b8185b8095ccce2ca2b6b982f51daf17da02247f3
entityKey:        spawn:7e05136a6829185f
birthTimestamp:   1774142206
flushedToChronos: true
integrityVerified: PASS
```

### Canonical JSON (Input to SHA-256)
```json
{"childHash":"7e05136a6829185fac9ce51cf6e25124266c7859b2ea56d2992ec4535df86335","generation":1,"parentAHash":"6feb7ca617bf5e0d6f10a06ff25e3ba8f27f674bc381e3aefe1bd9bd51e184b8","parentBHash":"a4c42d6720292bec39403872589d0c3749d2969f44bcd99c762090238a6d806e","sovereignSeed":"obsidian-glass-genesis","totalMutations":1}
```

### SHA-256 Lineage Hash Verification
| Check | Value |
|-------|-------|
| Stored lineageHash | `c0e6c97e8944fd8ff258056b8185b8095ccce2ca2b6b982f51daf17da02247f3` |
| Recomputed hash | `c0e6c97e8944fd8ff258056b8185b8095ccce2ca2b6b982f51daf17da02247f3` |
| Match | **YES** |

### Hard Crash Simulation -> Recovery
```
[PRE-CRASH]  Chronos pendingCount = 1
[PRE-CRASH]  Persistence path = /tmp/crash_proof_spawner.bin
[PRE-CRASH]  Key = lineage:7e05136a6829185f
[SIMULATING HARD CRASH...]
[POST-CRASH] Chronos pendingCount = 0 (memory wiped)
[RECOVERY]   recoverFromCrash() = true
[RECOVERY]   Chronos pendingCount = 1 (restored from disk)
[INSPECTION] Persisted yaw=45 pitch=-15 roll=0 zoom=1.5
[RESTORED]   recoverInspectionState() yaw=45.0000 pitch=-15.0000 roll=0.0000 zoom=1.5000
[VERIFIED]   Orientation restored: YES
[VERIFIED]   Phenotype active: YES
[VERIFIED]   Classification: ORGANIC
[VERIFIED]   Loci count: 16
[STATS]      totalCrashRecoveries = 1
[STATS]      totalEnqueued = 1
```

---

## Determinism Proof

| Run | Child Hash | Lineage Hash | Mutations | Classification |
|-----|-----------|--------------|-----------|----------------|
| Run 1 | `7e05136a6829185fac9ce51cf6e25124266c7859b2ea56d2992ec4535df86335` | `c0e6c97e8944fd8ff258056b8185b8095ccce2ca2b6b982f51daf17da02247f3` | 1 | ORGANIC |
| Run 2 | `7e05136a6829185fac9ce51cf6e25124266c7859b2ea56d2992ec4535df86335` | `c0e6c97e8944fd8ff258056b8185b8095ccce2ca2b6b982f51daf17da02247f3` | 1 | ORGANIC |
| Match | **YES** | **YES** | **YES** | **YES** |

**Determinism: CONFIRMED**

