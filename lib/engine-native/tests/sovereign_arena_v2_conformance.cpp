#include "../generated/SovereignArena.h"
#include <iostream>
#include <cassert>
#include <cmath>
#include <set>

using namespace Sovereign;

static int passed = 0;
static int failed = 0;

static void check(bool condition, const std::string& name) {
    if (condition) {
        std::cout << "  PASS: " << name << "\n";
        passed++;
    } else {
        std::cout << "  FAIL: " << name << "\n";
        failed++;
    }
}

static FVisualPhenotype makeTestPhenotype(const std::string& hash, PhenotypeClass cls,
                                            float metallic, float roughness, float emission,
                                            float scaleX, float scaleY, float scaleZ,
                                            uint16_t meshIndex) {
    FVisualPhenotype p;
    p.sourceHash = hash;
    p.classification = cls;
    p.material.metallic = metallic;
    p.material.roughness = roughness;
    p.material.emissionIntensity = emission;
    p.material.opacity = 0.9f;
    p.material.subsurfaceScattering = 0.3f;
    p.material.anisotropy = 0.4f;
    p.material.fresnelPower = 2.0f;
    p.material.normalIntensity = 0.7f;
    p.material.displacementHeight = 0.2f;
    p.material.specular = 0.5f;
    p.morphology.baseMeshIndex = meshIndex;
    p.morphology.scaleX = scaleX;
    p.morphology.scaleY = scaleY;
    p.morphology.scaleZ = scaleZ;
    p.morphology.uvTilingU = 1.0f;
    p.morphology.uvTilingV = 1.0f;
    p.morphology.animationFrequency = 2.0f;
    p.primaryColor = {0.8f, 0.2f, 0.1f, 1.0f};
    p.accentColor = {0.1f, 0.5f, 0.9f, 1.0f};
    return p;
}

int main() {
    std::cout << "==================================================" << std::endl;
    std::cout << "  SOVEREIGN ARENA v2 CONFORMANCE" << std::endl;
    std::cout << "==================================================" << std::endl;

    auto phenoA = makeTestPhenotype("aaa111", PhenotypeClass::VOLCANIC, 0.8f, 0.3f, 7.0f, 1.2f, 1.5f, 1.0f, 0);
    auto phenoB = makeTestPhenotype("bbb222", PhenotypeClass::CRYSTALLINE, 0.5f, 0.7f, 3.0f, 0.8f, 1.0f, 0.9f, 1);
    auto phenoC = makeTestPhenotype("ccc333", PhenotypeClass::METALLIC, 0.9f, 0.2f, 1.0f, 2.0f, 2.5f, 1.8f, 2);
    auto phenoD = makeTestPhenotype("ddd444", PhenotypeClass::AQUEOUS, 0.3f, 0.8f, 0.5f, 0.5f, 0.6f, 0.4f, 4);

    // ============================================================
    // FRAME-BY-FRAME REPLAY INSTRUCTION SYSTEM
    // ============================================================
    std::cout << "\n=== Frame-by-Frame Replay ===" << std::endl;

    {
        auto& arena = SovereignArena::Get();
        arena.reset();
        auto result = arena.interact(phenoA, "volcanic-warrior", phenoB, "crystal-defender");

        auto timeline = ReplayGenerator::generateTimeline(result);

        std::cout << "  -- Timeline Structure --" << std::endl;
        check(timeline.sessionId == result.arenaSessionId, "Timeline: session ID matches arena result");
        check(timeline.entityAKey == "volcanic-warrior", "Timeline: entity A key correct");
        check(timeline.entityBKey == "crystal-defender", "Timeline: entity B key correct");
        check(timeline.frameRate == 60, "Timeline: 60fps frame rate");
        check(timeline.totalFrames > 0, "Timeline: total frames > 0");
        check(!timeline.instructions.empty(), "Timeline: instructions generated");
        check(timeline.finalOutcome == result.finalOutcome, "Timeline: outcome matches arena result");

        std::cout << "  -- Instruction Content --" << std::endl;
        bool hasEntrance = false, hasWindUp = false, hasStrike = false, hasRetreat = false;
        bool hasOutcome = false;
        std::set<std::string> actionsSeen;
        for (const auto& inst : timeline.instructions) {
            actionsSeen.insert(replayActionToString(inst.action));
            if (inst.action == ReplayActionType::ENTRANCE) hasEntrance = true;
            if (inst.action == ReplayActionType::ATTACK_WIND_UP) hasWindUp = true;
            if (inst.action == ReplayActionType::ATTACK_STRIKE) hasStrike = true;
            if (inst.action == ReplayActionType::MOVE_BACKWARD) hasRetreat = true;
            if (inst.action == ReplayActionType::VICTORY_POSE || 
                inst.action == ReplayActionType::KO_COLLAPSE ||
                inst.action == ReplayActionType::DRAW_STANDOFF ||
                inst.action == ReplayActionType::TRADE_MUTUAL_KO) hasOutcome = true;
        }
        check(hasEntrance, "Replay: entrance instructions generated");
        check(hasWindUp, "Replay: wind-up instructions generated");
        check(hasStrike, "Replay: strike instructions generated");
        check(hasRetreat, "Replay: retreat instructions generated");
        check(hasOutcome, "Replay: outcome instructions generated");
        check(actionsSeen.size() >= 4, "Replay: at least 4 distinct action types");

        std::cout << "  -- Instruction Fields --" << std::endl;
        auto& firstInst = timeline.instructions[0];
        check(!firstInst.actorKey.empty(), "Instruction: actorKey populated");
        check(!firstInst.animationClip.empty(), "Instruction: animationClip populated");
        check(firstInst.durationFrames > 0.0f, "Instruction: durationFrames > 0");
        check(firstInst.frameIndex >= 0, "Instruction: frameIndex >= 0");

        bool hasVfx = false;
        for (const auto& inst : timeline.instructions) {
            if (!inst.vfxTag.empty()) { hasVfx = true; break; }
        }
        check(hasVfx, "Replay: VFX tags present");

        std::cout << "  -- Hit/Dodge Coverage --" << std::endl;
        bool hasHitReact = actionsSeen.count("HIT_REACT") > 0;
        bool hasDodge = actionsSeen.count("DODGE") > 0;
        check(hasHitReact || hasDodge, "Replay: hit react or dodge present (round outcomes covered)");

        std::cout << "  -- DamageType VFX --" << std::endl;
        bool hasTypeVfx = false;
        for (const auto& inst : timeline.instructions) {
            if (inst.vfxTag.find("THERMAL") != std::string::npos ||
                inst.vfxTag.find("RADIANT") != std::string::npos) {
                hasTypeVfx = true;
                break;
            }
        }
        check(hasTypeVfx, "Replay: damage type VFX tags present (THERMAL/RADIANT)");

        std::cout << "  -- Timeline Integrity --" << std::endl;
        check(!timeline.timelineHash.empty(), "Timeline: hash computed");
        check(timeline.timelineHash.length() == 64, "Timeline: hash is SHA-256 (64 hex)");
        check(timeline.verifyIntegrity(), "Timeline: integrity verification passes");

        FReplayTimeline tampered = timeline;
        tampered.totalFrames = 99999;
        check(!tampered.verifyIntegrity(), "Timeline: tampered timeline fails integrity");

        std::cout << "  -- Replay Determinism --" << std::endl;
        check(ReplayGenerator::verifyTimelineDeterminism(result), "Replay: determinism verified (2 runs identical)");

        auto t2 = ReplayGenerator::generateTimeline(result);
        check(timeline.timelineHash == t2.timelineHash, "Replay: timeline hash identical across runs");
        check(timeline.totalFrames == t2.totalFrames, "Replay: frame count identical");
        check(timeline.instructions.size() == t2.instructions.size(), "Replay: instruction count identical");

        std::cout << "  -- Frame Ordering --" << std::endl;
        bool framesOrdered = true;
        for (size_t i = 1; i < timeline.instructions.size(); i++) {
            if (timeline.instructions[i].frameIndex < timeline.instructions[i-1].frameIndex) {
                if (timeline.instructions[i].frameIndex != timeline.instructions[i-1].frameIndex) {
                    framesOrdered = false;
                    break;
                }
            }
        }
        check(framesOrdered, "Replay: frame indices are non-decreasing");

        std::cout << "  -- Critical Flash --" << std::endl;
        bool hasCritFlash = actionsSeen.count("CRITICAL_FLASH") > 0;
        bool anyCrit = result.critsA > 0 || result.critsB > 0;
        if (anyCrit) {
            check(hasCritFlash, "Replay: critical flash present when crits occurred");
        } else {
            check(!hasCritFlash, "Replay: no critical flash when no crits occurred");
        }

        std::cout << "  -- Approach/Retreat --" << std::endl;
        bool hasApproach = actionsSeen.count("MOVE_FORWARD") > 0;
        check(hasApproach, "Replay: approach (MOVE_FORWARD) before strikes");

        std::cout << "  -- Type Effect --" << std::endl;
        bool hasTypeEffect = actionsSeen.count("TYPE_EFFECT") > 0;
        if (result.hitsA > 0 || result.hitsB > 0) {
            check(hasTypeEffect, "Replay: TYPE_EFFECT generated for hits");
        }

        std::cout << "  -- Frame Constants --" << std::endl;
        check(ReplayGenerator::FRAMES_PER_ROUND == 90, "Replay: FRAMES_PER_ROUND = 90");
        check(ReplayGenerator::ENTRANCE_FRAMES == 60, "Replay: ENTRANCE_FRAMES = 60");
        check(ReplayGenerator::WIND_UP_FRAMES == 15, "Replay: WIND_UP_FRAMES = 15");
        check(ReplayGenerator::STRIKE_FRAMES == 8, "Replay: STRIKE_FRAMES = 8");
        check(ReplayGenerator::KO_FRAMES == 45, "Replay: KO_FRAMES = 45");
        check(ReplayGenerator::VICTORY_FRAMES == 60, "Replay: VICTORY_FRAMES = 60");
    }

    // Different fight — different timeline
    std::cout << "\n=== Replay Different Matchup ===" << std::endl;
    {
        auto& arena = SovereignArena::Get();
        arena.reset();

        auto r1 = arena.interact(phenoA, "v1", phenoB, "c1");
        auto t1 = ReplayGenerator::generateTimeline(r1);

        arena.reset();
        auto r2 = arena.interact(phenoC, "m1", phenoD, "a1");
        auto t2 = ReplayGenerator::generateTimeline(r2);

        check(t1.timelineHash != t2.timelineHash, "DiffMatch: different matchups produce different timelines");
        check(t1.sessionId != t2.sessionId, "DiffMatch: different session IDs");
    }

    // ============================================================
    // HITBOX-GENOME COLLISION MAPPING
    // ============================================================
    std::cout << "\n=== Hitbox-Genome Collision Mapping ===" << std::endl;

    {
        auto hitbox = HitboxGenomeMapper::mapFromPhenotype(phenoA, "volcanic-warrior");

        std::cout << "  -- Hitbox Structure --" << std::endl;
        check(hitbox.entityKey == "volcanic-warrior", "Hitbox: entity key set");
        check(!hitbox.hitboxSetHash.empty(), "Hitbox: set hash computed");
        check(hitbox.hitboxSetHash.length() == 64, "Hitbox: hash is SHA-256");
        check(hitbox.verifyIntegrity(), "Hitbox: integrity verification passes");

        std::cout << "  -- Body Volume --" << std::endl;
        check(hitbox.bodyVolume.volumeType == CollisionVolumeType::SPHERE, "Body: SPHERE for mesh family 0 (Sphere)");
        check(hitbox.bodyVolume.radius > 0.0f, "Body: radius > 0");
        check(hitbox.bodyVolume.volume > 0.0f, "Body: volume > 0");
        check(hitbox.bodyVolume.surfaceArea > 0.0f, "Body: surface area > 0");
        check(!hitbox.bodyVolume.collisionProfile.empty(), "Body: collision profile set");
        check(hitbox.bodyVolume.collisionProfile.find("VOLCANIC") != std::string::npos, "Body: profile includes phenotype class");
        check(hitbox.bodyVolume.verifyIntegrity(), "Body: individual hash integrity");

        std::cout << "  -- Head Volume --" << std::endl;
        check(hitbox.headVolume.volumeType == CollisionVolumeType::SPHERE, "Head: always SPHERE");
        check(hitbox.headVolume.radius > 0.0f, "Head: radius > 0");
        check(hitbox.headVolume.offsetY > 0.0f, "Head: offset Y > 0 (above body)");
        check(hitbox.headVolume.collisionProfile == "Headshot_Critical", "Head: critical profile");
        check(hitbox.headVolume.verifyIntegrity(), "Head: individual hash integrity");

        std::cout << "  -- Strike Volume --" << std::endl;
        check(hitbox.strikeVolume.volumeType == CollisionVolumeType::CAPSULE, "Strike: CAPSULE for reach");
        check(hitbox.strikeVolume.radius > 0.0f, "Strike: radius > 0");
        check(hitbox.strikeVolume.capsuleHalfHeight > 0.0f, "Strike: capsule half height > 0");
        check(hitbox.strikeVolume.offsetX > 0.0f, "Strike: offset X > 0 (forward)");
        check(hitbox.strikeVolume.collisionProfile.find("StrikeZone") != std::string::npos, "Strike: strike zone profile");
        check(hitbox.strikeVolume.verifyIntegrity(), "Strike: individual hash integrity");

        std::cout << "  -- Total Metrics --" << std::endl;
        check(hitbox.totalHitboxVolume > 0.0f, "Hitbox: total volume > 0");
        check(hitbox.totalSurfaceArea > 0.0f, "Hitbox: total surface area > 0");
        float expectedVol = hitbox.bodyVolume.volume + hitbox.headVolume.volume + hitbox.strikeVolume.volume;
        check(std::abs(hitbox.totalHitboxVolume - expectedVol) < 0.01f, "Hitbox: total = body + head + strike");
    }

    // Mesh family → volume type mapping
    std::cout << "\n=== Mesh Family Volume Mapping ===" << std::endl;
    {
        auto makeWithMesh = [&](uint16_t meshIdx, float sx, float sy, float sz) {
            auto p = makeTestPhenotype("test-mesh-" + std::to_string(meshIdx), PhenotypeClass::ORGANIC,
                                        0.5f, 0.5f, 1.0f, sx, sy, sz, meshIdx);
            return HitboxGenomeMapper::mapFromPhenotype(p, "mesh-test-" + std::to_string(meshIdx));
        };

        auto sphereHit = makeWithMesh(0, 1.0f, 1.0f, 1.0f);
        check(sphereHit.bodyVolume.volumeType == CollisionVolumeType::SPHERE, "MeshMap: Sphere(0) → SPHERE");

        auto boxHit = makeWithMesh(1, 1.0f, 1.0f, 1.0f);
        check(boxHit.bodyVolume.volumeType == CollisionVolumeType::BOX, "MeshMap: Cube(1) → BOX");

        auto capsuleHit = makeWithMesh(2, 1.0f, 1.0f, 1.0f);
        check(capsuleHit.bodyVolume.volumeType == CollisionVolumeType::CAPSULE, "MeshMap: Cylinder(2) → CAPSULE");

        auto convexHit = makeWithMesh(10, 1.0f, 1.0f, 1.0f);
        check(convexHit.bodyVolume.volumeType == CollisionVolumeType::CONVEX_HULL, "MeshMap: Klein(10) → CONVEX_HULL");
    }

    // Scale → collision size correlation
    std::cout << "\n=== Scale-Collision Correlation ===" << std::endl;
    {
        auto smallPheno = makeTestPhenotype("small", PhenotypeClass::CRYSTALLINE, 0.5f, 0.5f, 1.0f, 0.5f, 0.5f, 0.5f, 0);
        auto largePheno = makeTestPhenotype("large", PhenotypeClass::CRYSTALLINE, 0.5f, 0.5f, 1.0f, 2.0f, 2.0f, 2.0f, 0);

        auto smallHit = HitboxGenomeMapper::mapFromPhenotype(smallPheno, "small");
        auto largeHit = HitboxGenomeMapper::mapFromPhenotype(largePheno, "large");

        check(largeHit.bodyVolume.radius > smallHit.bodyVolume.radius, "Scale: larger scale → larger body radius");
        check(largeHit.totalHitboxVolume > smallHit.totalHitboxVolume, "Scale: larger scale → larger total volume");
        check(largeHit.headVolume.radius > smallHit.headVolume.radius, "Scale: larger scale → larger head");
        check(largeHit.strikeVolume.capsuleHalfHeight > smallHit.strikeVolume.capsuleHalfHeight, "Scale: larger scale → longer strike reach");
    }

    // Hitbox determinism
    std::cout << "\n=== Hitbox Determinism ===" << std::endl;
    {
        check(HitboxGenomeMapper::verifyDeterminism(phenoA, "det-test"), "HitboxDet: determinism verified");

        auto h1 = HitboxGenomeMapper::mapFromPhenotype(phenoA, "det-1");
        auto h2 = HitboxGenomeMapper::mapFromPhenotype(phenoA, "det-1");
        check(h1.hitboxSetHash == h2.hitboxSetHash, "HitboxDet: identical hash across runs");
        check(h1.bodyVolume.collisionHash == h2.bodyVolume.collisionHash, "HitboxDet: body hash identical");
        check(h1.headVolume.collisionHash == h2.headVolume.collisionHash, "HitboxDet: head hash identical");
        check(h1.strikeVolume.collisionHash == h2.strikeVolume.collisionHash, "HitboxDet: strike hash identical");
    }

    // Hitbox tamper detection
    std::cout << "\n=== Hitbox Tamper Detection ===" << std::endl;
    {
        auto hitbox = HitboxGenomeMapper::mapFromPhenotype(phenoB, "tamper-test");
        check(hitbox.verifyIntegrity(), "HitboxTamper: clean hitbox passes");

        FHitboxSet tampered = hitbox;
        tampered.totalHitboxVolume = 99999.0f;
        check(!tampered.verifyIntegrity(), "HitboxTamper: tampered total volume fails");

        FCollisionVolume tamperedVol = hitbox.bodyVolume;
        tamperedVol.radius = 999.0f;
        check(!tamperedVol.verifyIntegrity(), "HitboxTamper: tampered body radius fails");
    }

    // ============================================================
    // THE SCAR SYSTEM — COMBAT CHRONICLE
    // ============================================================
    std::cout << "\n=== Scar System — Combat Chronicle ===" << std::endl;

    {
        auto& chronicle = CombatChronicleEngine::Get();
        chronicle.reset();

        auto& arena = SovereignArena::Get();
        arena.reset();

        auto result = arena.interact(phenoA, "warrior-A", phenoB, "defender-B");
        chronicle.postCombatFlush(result, phenoA, phenoB);

        std::cout << "  -- Chronicle Created --" << std::endl;
        check(chronicle.hasChronicle("warrior-A"), "Chronicle: entity A chronicle exists");
        check(chronicle.hasChronicle("defender-B"), "Chronicle: entity B chronicle exists");
        check(chronicle.chronicleCount() == 2, "Chronicle: 2 chronicles created");

        const auto* chronA = chronicle.getChronicle("warrior-A");
        const auto* chronB = chronicle.getChronicle("defender-B");
        check(chronA != nullptr, "Chronicle: A retrievable");
        check(chronB != nullptr, "Chronicle: B retrievable");

        std::cout << "  -- Win/Loss Tracking --" << std::endl;
        int totalWins = chronA->wins + chronB->wins;
        int totalLosses = chronA->losses + chronB->losses;
        if (result.finalOutcome == InteractionOutcome::ATTACKER_WINS) {
            check(chronA->wins == 1 && chronB->losses == 1, "WinLoss: attacker won → A=1W, B=1L");
        } else if (result.finalOutcome == InteractionOutcome::DEFENDER_WINS) {
            check(chronA->losses == 1 && chronB->wins == 1, "WinLoss: defender won → A=1L, B=1W");
        } else if (result.finalOutcome == InteractionOutcome::TRADE) {
            check(chronA->trades == 1 && chronB->trades == 1, "WinLoss: trade → both 1T");
        } else {
            check(chronA->draws == 1 && chronB->draws == 1, "WinLoss: draw → both 1D");
        }
        check(chronA->totalFights() == 1, "WinLoss: A total fights = 1");
        check(chronB->totalFights() == 1, "WinLoss: B total fights = 1");

        std::cout << "  -- Scars Created --" << std::endl;
        check(chronA->scars.size() == 1, "Scar: A has 1 scar");
        check(chronB->scars.size() == 1, "Scar: B has 1 scar");
        check(!chronA->scars[0].scarHash.empty(), "Scar: A scar hash computed");
        check(!chronB->scars[0].scarHash.empty(), "Scar: B scar hash computed");
        check(chronA->scars[0].verifyIntegrity(), "Scar: A scar integrity passes");
        check(chronB->scars[0].verifyIntegrity(), "Scar: B scar integrity passes");

        std::cout << "  -- Scar Content --" << std::endl;
        check(chronA->scars[0].opponentHash == "defender-B", "ScarContent: A's opponent = B");
        check(chronB->scars[0].opponentHash == "warrior-A", "ScarContent: B's opponent = A");
        check(chronA->scars[0].opponentClass == PhenotypeClass::CRYSTALLINE, "ScarContent: A saw CRYSTALLINE opponent");
        check(chronB->scars[0].opponentClass == PhenotypeClass::VOLCANIC, "ScarContent: B saw VOLCANIC opponent");
        check(chronA->scars[0].roundCount == result.totalRounds, "ScarContent: A round count matches");
        check(!chronA->scars[0].arenaSessionId.empty(), "ScarContent: session ID recorded");

        std::cout << "  -- Damage Tracking --" << std::endl;
        check(chronA->totalDamageDealt > 0.0f || chronB->totalDamageDealt > 0.0f, "Damage: at least one dealt damage");
        check(std::abs(chronA->totalDamageDealt - result.totalDamageDealtByA) < 0.01f, "Damage: A dealt matches result");
        check(std::abs(chronA->totalDamageTaken - result.totalDamageDealtByB) < 0.01f, "Damage: A taken matches result");
        check(std::abs(chronB->totalDamageDealt - result.totalDamageDealtByB) < 0.01f, "Damage: B dealt matches result");
        check(std::abs(chronB->totalDamageTaken - result.totalDamageDealtByA) < 0.01f, "Damage: B taken matches result");

        std::cout << "  -- Experience Points --" << std::endl;
        check(chronA->experiencePoints > 0, "XP: A earned experience");
        check(chronB->experiencePoints > 0, "XP: B earned experience");
        check(chronA->experiencePoints >= 100, "XP: A at least base XP (100)");

        std::cout << "  -- Veteran Rank --" << std::endl;
        check(chronA->rank == VeteranRank::ROOKIE, "Rank: A is ROOKIE after 1 fight");
        check(chronB->rank == VeteranRank::ROOKIE, "Rank: B is ROOKIE after 1 fight");

        std::cout << "  -- Chronicle Integrity --" << std::endl;
        check(!chronA->chronicleHash.empty(), "ChronInteg: A hash computed");
        check(chronA->verifyIntegrity(), "ChronInteg: A integrity passes");
        check(chronB->verifyIntegrity(), "ChronInteg: B integrity passes");
        check(chronicle.verifyChronicleIntegrity("warrior-A"), "ChronInteg: engine-level verification");
    }

    // Multi-fight veteran progression
    std::cout << "\n=== Veteran Progression ===" << std::endl;
    {
        auto& chronicle = CombatChronicleEngine::Get();
        chronicle.reset();
        auto& arena = SovereignArena::Get();
        arena.reset();

        for (int i = 0; i < 5; i++) {
            auto r = arena.interact(phenoA, "fighter", phenoB, "opponent");
            chronicle.postCombatFlush(r, phenoA, phenoB);
        }

        const auto* chron = chronicle.getChronicle("fighter");
        check(chron->totalFights() == 5, "VetProg: 5 fights recorded");
        check(chron->scars.size() == 5, "VetProg: 5 scars accumulated");
        check(chron->rank == VeteranRank::WARRIOR, "VetProg: WARRIOR rank at 5 fights");

        for (int i = 0; i < 10; i++) {
            auto r = arena.interact(phenoA, "fighter", phenoC, "other");
            chronicle.postCombatFlush(r, phenoA, phenoC);
        }
        chron = chronicle.getChronicle("fighter");
        check(chron->totalFights() == 15, "VetProg: 15 fights recorded");
        check(chron->rank == VeteranRank::VETERAN, "VetProg: VETERAN rank at 15 fights");

        for (int i = 0; i < 15; i++) {
            auto r = arena.interact(phenoA, "fighter", phenoD, "another");
            chronicle.postCombatFlush(r, phenoA, phenoD);
        }
        chron = chronicle.getChronicle("fighter");
        check(chron->totalFights() == 30, "VetProg: 30 fights recorded");
        check(chron->rank == VeteranRank::CHAMPION, "VetProg: CHAMPION rank at 30 fights");

        for (int i = 0; i < 20; i++) {
            auto r = arena.interact(phenoA, "fighter", phenoB, "final");
            chronicle.postCombatFlush(r, phenoA, phenoB);
        }
        chron = chronicle.getChronicle("fighter");
        check(chron->totalFights() == 50, "VetProg: 50 fights recorded");
        check(chron->rank == VeteranRank::LEGEND, "VetProg: LEGEND rank at 50 fights");
        check(chron->scars.size() == 50, "VetProg: 50 scars accumulated");
        check(chron->experiencePoints > 5000, "VetProg: substantial XP accumulated");
    }

    // Win rate tracking
    std::cout << "\n=== Win Rate ===" << std::endl;
    {
        auto& chronicle = CombatChronicleEngine::Get();
        chronicle.reset();
        auto& arena = SovereignArena::Get();
        arena.reset();

        auto r = arena.interact(phenoA, "wr-fighter", phenoB, "wr-opponent");
        chronicle.postCombatFlush(r, phenoA, phenoB);

        const auto* chron = chronicle.getChronicle("wr-fighter");
        float wr = chron->winRate();
        check(wr >= 0.0f && wr <= 1.0f, "WinRate: in valid range [0,1]");
    }

    // Experience configuration
    std::cout << "\n=== Experience Config ===" << std::endl;
    {
        auto& chronicle = CombatChronicleEngine::Get();
        chronicle.reset();

        ExperienceConfig cfg;
        cfg.baseXpPerFight = 200;
        cfg.victoryBonus = 500;
        chronicle.configureExperience(cfg);

        auto retrievedCfg = chronicle.getExperienceConfig();
        check(retrievedCfg.baseXpPerFight == 200, "XPConfig: base XP updated");
        check(retrievedCfg.victoryBonus == 500, "XPConfig: victory bonus updated");

        auto& arena = SovereignArena::Get();
        arena.reset();
        auto r = arena.interact(phenoA, "cfg-fighter", phenoB, "cfg-opp");
        chronicle.postCombatFlush(r, phenoA, phenoB);

        const auto* chron = chronicle.getChronicle("cfg-fighter");
        check(chron->experiencePoints >= 200, "XPConfig: at least custom base XP earned");
    }

    // Chronos flush
    std::cout << "\n=== Chronos Flush ===" << std::endl;
    {
        auto& chronicle = CombatChronicleEngine::Get();
        chronicle.reset();
        auto& arena = SovereignArena::Get();
        arena.reset();

        auto r = arena.interact(phenoA, "flush-A", phenoB, "flush-B");
        chronicle.postCombatFlush(r, phenoA, phenoB);

        auto stats = chronicle.getStats();
        check(stats.totalScarsCreated == 2, "ChronosFlush: 2 scars created");
        check(stats.totalChroniclesUpdated == 2, "ChronosFlush: 2 chronicles updated");
        check(stats.totalChronosFlushed == 2, "ChronosFlush: 2 Chronos flushes");
        check(stats.totalXpAwarded > 0, "ChronosFlush: XP awarded");
    }

    // Scar type enum
    std::cout << "\n=== Scar Type Enum ===" << std::endl;
    {
        check(scarTypeToString(ScarType::VICTORY_MARK) == "VICTORY_MARK", "ScarType: VICTORY_MARK");
        check(scarTypeToString(ScarType::DEFEAT_WOUND) == "DEFEAT_WOUND", "ScarType: DEFEAT_WOUND");
        check(scarTypeToString(ScarType::TRADE_SCAR) == "TRADE_SCAR", "ScarType: TRADE_SCAR");
        check(scarTypeToString(ScarType::DRAW_BADGE) == "DRAW_BADGE", "ScarType: DRAW_BADGE");
        check(scarTypeToString(ScarType::CRITICAL_SURVIVOR) == "CRITICAL_SURVIVOR", "ScarType: CRITICAL_SURVIVOR");
        check(scarTypeToString(ScarType::TYPE_ADVANTAGE_MARK) == "TYPE_ADVANTAGE_MARK", "ScarType: TYPE_ADVANTAGE_MARK");
    }

    // Veteran rank enum
    std::cout << "\n=== Veteran Rank Enum ===" << std::endl;
    {
        check(veteranRankToString(VeteranRank::ROOKIE) == "ROOKIE", "VetRank: ROOKIE");
        check(veteranRankToString(VeteranRank::WARRIOR) == "WARRIOR", "VetRank: WARRIOR");
        check(veteranRankToString(VeteranRank::VETERAN) == "VETERAN", "VetRank: VETERAN");
        check(veteranRankToString(VeteranRank::CHAMPION) == "CHAMPION", "VetRank: CHAMPION");
        check(veteranRankToString(VeteranRank::LEGEND) == "LEGEND", "VetRank: LEGEND");

        check(computeVeteranRank(0) == VeteranRank::ROOKIE, "VetCompute: 0 → ROOKIE");
        check(computeVeteranRank(4) == VeteranRank::ROOKIE, "VetCompute: 4 → ROOKIE");
        check(computeVeteranRank(5) == VeteranRank::WARRIOR, "VetCompute: 5 → WARRIOR");
        check(computeVeteranRank(14) == VeteranRank::WARRIOR, "VetCompute: 14 → WARRIOR");
        check(computeVeteranRank(15) == VeteranRank::VETERAN, "VetCompute: 15 → VETERAN");
        check(computeVeteranRank(29) == VeteranRank::VETERAN, "VetCompute: 29 → VETERAN");
        check(computeVeteranRank(30) == VeteranRank::CHAMPION, "VetCompute: 30 → CHAMPION");
        check(computeVeteranRank(49) == VeteranRank::CHAMPION, "VetCompute: 49 → CHAMPION");
        check(computeVeteranRank(50) == VeteranRank::LEGEND, "VetCompute: 50 → LEGEND");
        check(computeVeteranRank(100) == VeteranRank::LEGEND, "VetCompute: 100 → LEGEND");
    }

    // ReplayActionType enum coverage
    std::cout << "\n=== ReplayAction Enum ===" << std::endl;
    {
        check(replayActionToString(ReplayActionType::IDLE) == "IDLE", "ActionEnum: IDLE");
        check(replayActionToString(ReplayActionType::MOVE_FORWARD) == "MOVE_FORWARD", "ActionEnum: MOVE_FORWARD");
        check(replayActionToString(ReplayActionType::ATTACK_STRIKE) == "ATTACK_STRIKE", "ActionEnum: ATTACK_STRIKE");
        check(replayActionToString(ReplayActionType::HIT_REACT) == "HIT_REACT", "ActionEnum: HIT_REACT");
        check(replayActionToString(ReplayActionType::DODGE) == "DODGE", "ActionEnum: DODGE");
        check(replayActionToString(ReplayActionType::CRITICAL_FLASH) == "CRITICAL_FLASH", "ActionEnum: CRITICAL_FLASH");
        check(replayActionToString(ReplayActionType::KO_COLLAPSE) == "KO_COLLAPSE", "ActionEnum: KO_COLLAPSE");
        check(replayActionToString(ReplayActionType::VICTORY_POSE) == "VICTORY_POSE", "ActionEnum: VICTORY_POSE");
        check(replayActionToString(ReplayActionType::DRAW_STANDOFF) == "DRAW_STANDOFF", "ActionEnum: DRAW_STANDOFF");
        check(replayActionToString(ReplayActionType::TRADE_MUTUAL_KO) == "TRADE_MUTUAL_KO", "ActionEnum: TRADE_MUTUAL_KO");
        check(replayActionToString(ReplayActionType::ENTRANCE) == "ENTRANCE", "ActionEnum: ENTRANCE");
        check(replayActionToString(ReplayActionType::TYPE_EFFECT) == "TYPE_EFFECT", "ActionEnum: TYPE_EFFECT");
    }

    // CollisionVolumeType enum
    std::cout << "\n=== CollisionVolume Enum ===" << std::endl;
    {
        check(collisionVolumeTypeToString(CollisionVolumeType::SPHERE) == "SPHERE", "VolEnum: SPHERE");
        check(collisionVolumeTypeToString(CollisionVolumeType::CAPSULE) == "CAPSULE", "VolEnum: CAPSULE");
        check(collisionVolumeTypeToString(CollisionVolumeType::BOX) == "BOX", "VolEnum: BOX");
        check(collisionVolumeTypeToString(CollisionVolumeType::CONVEX_HULL) == "CONVEX_HULL", "VolEnum: CONVEX_HULL");
    }

    // Delegate test
    std::cout << "\n=== Delegate Test ===" << std::endl;
    {
        auto& chronicle = CombatChronicleEngine::Get();
        chronicle.reset();
        auto& arena = SovereignArena::Get();
        arena.reset();

        int scarCallCount = 0;
        int chronicleCallCount = 0;
        chronicle.onScarAcquired([&](const std::string& hash, const FCombatScar& scar) {
            scarCallCount++;
        });
        chronicle.onChronicleUpdated([&](const std::string& hash, const FCombatChronicle& chron) {
            chronicleCallCount++;
        });

        auto r = arena.interact(phenoA, "del-A", phenoB, "del-B");
        chronicle.postCombatFlush(r, phenoA, phenoB);

        check(scarCallCount == 2, "Delegate: scar acquired fired for both entities");
        check(chronicleCallCount == 2, "Delegate: chronicle updated fired for both entities");
    }

    // RankUp delegate test
    std::cout << "\n=== RankUp Delegate Test ===" << std::endl;
    {
        auto& chronicle = CombatChronicleEngine::Get();
        chronicle.reset();
        auto& arena = SovereignArena::Get();
        arena.reset();

        int rankUpCount = 0;
        std::string rankedUpEntity;
        VeteranRank capturedOldRank = VeteranRank::ROOKIE;
        VeteranRank capturedNewRank = VeteranRank::ROOKIE;
        chronicle.onRankUp([&](const std::string& hash, VeteranRank oldR, VeteranRank newR) {
            rankUpCount++;
            rankedUpEntity = hash;
            capturedOldRank = oldR;
            capturedNewRank = newR;
        });

        for (int i = 0; i < 4; i++) {
            auto r = arena.interact(phenoA, "rankup-fighter", phenoB, "rankup-opp");
            chronicle.postCombatFlush(r, phenoA, phenoB);
        }
        check(rankUpCount == 0, "RankUpDel: no rank up at 4 fights");

        auto r5 = arena.interact(phenoA, "rankup-fighter", phenoB, "rankup-opp");
        chronicle.postCombatFlush(r5, phenoA, phenoB);
        check(rankUpCount >= 1, "RankUpDel: rank up delegate fired at 5 fights");
        check(capturedNewRank == VeteranRank::WARRIOR, "RankUpDel: new rank is WARRIOR");
        check(capturedOldRank == VeteranRank::ROOKIE, "RankUpDel: old rank was ROOKIE");
    }

    // Chronicle tamper detection
    std::cout << "\n=== Chronicle Tamper Detection ===" << std::endl;
    {
        auto& chronicle = CombatChronicleEngine::Get();
        chronicle.reset();
        auto& arena = SovereignArena::Get();
        arena.reset();

        auto r = arena.interact(phenoA, "tamper-fight-A", phenoB, "tamper-fight-B");
        chronicle.postCombatFlush(r, phenoA, phenoB);

        check(chronicle.verifyChronicleIntegrity("tamper-fight-A"), "TamperChron: clean chronicle passes");

        const auto* chron = chronicle.getChronicle("tamper-fight-A");
        FCombatChronicle tampered = *chron;
        tampered.wins = 9999;
        check(!tampered.verifyIntegrity(), "TamperChron: tampered wins fails integrity");

        FCombatChronicle tampered2 = *chron;
        tampered2.experiencePoints = 999999;
        check(!tampered2.verifyIntegrity(), "TamperChron: tampered XP fails integrity");
    }

    // Scar canonicalize
    std::cout << "\n=== Scar Canonicalize ===" << std::endl;
    {
        FCombatScar scar;
        scar.type = ScarType::VICTORY_MARK;
        scar.opponentHash = "opp123";
        scar.opponentClass = PhenotypeClass::METALLIC;
        scar.damageTaken = 25.0f;
        scar.damageDealt = 50.0f;
        scar.roundCount = 10;
        scar.timestamp = 1234567890;
        scar.arenaSessionId = "session-abc";
        scar.computeHash();

        std::string canon = scar.canonicalize();
        check(canon.find("VICTORY_MARK") != std::string::npos, "ScarCanon: type in canonical");
        check(canon.find("opp123") != std::string::npos, "ScarCanon: opponent hash in canonical");
        check(canon.find("METALLIC") != std::string::npos, "ScarCanon: opponent class in canonical");
        check(scar.verifyIntegrity(), "ScarCanon: integrity after compute");
    }

    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "ARENA v2 RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;
    if (failed > 0) return 1;
    return 0;
}
