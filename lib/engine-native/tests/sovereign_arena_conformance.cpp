#include "../generated/SovereignArena.h"
#include <iostream>
#include <cassert>
#include <cmath>
#include <set>

static int passed = 0;
static int failed = 0;

#define ASSERT(cond, msg) do { \
    if (cond) { std::cout << "  PASS: " << msg << std::endl; passed++; } \
    else { std::cout << "  FAIL: " << msg << std::endl; failed++; } \
} while(0)

static Sovereign::FVisualPhenotype forgeEntity(const std::string& seed) {
    auto& forge = Sovereign::BiologicalForge::Get();
    std::string hash = Sovereign::SovereignSHA256::hash(seed);
    return forge.forge(hash, seed);
}

static void resetAll() {
    Sovereign::SovereignArena::Get().reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testArenaSingleton() {
    std::cout << "\n=== Sovereign Arena Singleton ===" << std::endl;
    auto& a1 = Sovereign::SovereignArena::Get();
    auto& a2 = Sovereign::SovereignArena::Get();
    ASSERT(&a1 == &a2, "Singleton — same instance");
    a1.reset();
}

void testStatMapping() {
    std::cout << "\n=== Phenotype → Combat Stats Mapping ===" << std::endl;
    resetAll();

    auto phenotype = forgeEntity("warrior-entity-alpha");
    auto stats = Sovereign::PhenotypeStatMapper::mapToStats(phenotype, "warrior-alpha");

    ASSERT(stats.entityKey == "warrior-alpha", "StatMap — entity key preserved");
    ASSERT(stats.attackPower >= 0.0f && stats.attackPower <= 100.0f, "StatMap — attackPower in [0,100]");
    ASSERT(stats.defense >= 0.0f && stats.defense <= 100.0f, "StatMap — defense in [0,100]");
    ASSERT(stats.speed >= 0.0f && stats.speed <= 100.0f, "StatMap — speed in [0,100]");
    ASSERT(stats.accuracy >= 0.0f && stats.accuracy <= 1.0f, "StatMap — accuracy in [0,1]");
    ASSERT(stats.evasion >= 0.0f && stats.evasion <= 1.0f, "StatMap — evasion in [0,1]");
    ASSERT(stats.criticalChance >= 0.0f && stats.criticalChance <= 1.0f, "StatMap — critChance in [0,1]");
    ASSERT(stats.criticalMultiplier >= 1.0f && stats.criticalMultiplier <= 3.0f, "StatMap — critMult in [1,3]");
    ASSERT(stats.resilience >= 0.0f && stats.resilience <= 1.0f, "StatMap — resilience in [0,1]");
    ASSERT(stats.reach >= 0.5f && stats.reach <= 5.0f, "StatMap — reach in [0.5,5]");
    ASSERT(stats.mass >= 0.1f && stats.mass <= 10.0f, "StatMap — mass in [0.1,10]");
    ASSERT(stats.totalPower() > 0.0f, "StatMap — total power > 0");

    std::string canonical = stats.canonicalize();
    ASSERT(canonical.find("\"attackPower\"") != std::string::npos, "StatMap — canonical has attackPower");
    ASSERT(canonical.find("\"damageType\"") != std::string::npos, "StatMap — canonical has damageType");
    ASSERT(canonical.find("\"entityKey\"") != std::string::npos, "StatMap — canonical has entityKey");

    resetAll();
}

void testDifferentEntitiesDifferentStats() {
    std::cout << "\n=== Different Entities → Different Stats ===" << std::endl;
    resetAll();

    auto pA = forgeEntity("creature-alpha");
    auto pB = forgeEntity("creature-beta");

    auto sA = Sovereign::PhenotypeStatMapper::mapToStats(pA, "alpha");
    auto sB = Sovereign::PhenotypeStatMapper::mapToStats(pB, "beta");

    bool anyDifferent = sA.attackPower != sB.attackPower ||
                        sA.defense != sB.defense ||
                        sA.speed != sB.speed;
    ASSERT(anyDifferent, "DiffStats — different phenotypes produce different combat stats");

    resetAll();
}

void testDamageTypeClassification() {
    std::cout << "\n=== Damage Type Classification ===" << std::endl;
    resetAll();

    std::set<std::string> seenTypes;
    for (int i = 0; i < 100; i++) {
        auto p = forgeEntity("dmg-type-" + std::to_string(i));
        auto s = Sovereign::PhenotypeStatMapper::mapToStats(p, "entity-" + std::to_string(i));
        seenTypes.insert(Sovereign::damageTypeToString(s.primaryDamageType));
    }
    ASSERT(seenTypes.size() >= 3, "DmgType — at least 3 different damage types from 100 entities");

    ASSERT(Sovereign::damageTypeToString(Sovereign::DamageType::KINETIC) == "KINETIC", "DmgType — KINETIC string");
    ASSERT(Sovereign::damageTypeToString(Sovereign::DamageType::THERMAL) == "THERMAL", "DmgType — THERMAL string");
    ASSERT(Sovereign::damageTypeToString(Sovereign::DamageType::CORROSIVE) == "CORROSIVE", "DmgType — CORROSIVE string");
    ASSERT(Sovereign::damageTypeToString(Sovereign::DamageType::RADIANT) == "RADIANT", "DmgType — RADIANT string");
    ASSERT(Sovereign::damageTypeToString(Sovereign::DamageType::VOID) == "VOID", "DmgType — VOID string");

    resetAll();
}

void testDamageMatrix() {
    std::cout << "\n=== Damage Type Matrix ===" << std::endl;

    float selfMult = Sovereign::FDamageMatrix::getMultiplier(Sovereign::DamageType::KINETIC, Sovereign::DamageType::KINETIC);
    ASSERT(selfMult == 1.0f, "Matrix — same type = 1.0x");

    float thermalVsKinetic = Sovereign::FDamageMatrix::getMultiplier(Sovereign::DamageType::THERMAL, Sovereign::DamageType::KINETIC);
    ASSERT(thermalVsKinetic > 1.0f, "Matrix — THERMAL strong vs KINETIC");

    float corrosiveVsVoid = Sovereign::FDamageMatrix::getMultiplier(Sovereign::DamageType::CORROSIVE, Sovereign::DamageType::VOID);
    ASSERT(corrosiveVsVoid > 1.0f, "Matrix — CORROSIVE strong vs VOID");

    float kineticVsCorrosive = Sovereign::FDamageMatrix::getMultiplier(Sovereign::DamageType::KINETIC, Sovereign::DamageType::CORROSIVE);
    ASSERT(kineticVsCorrosive > 1.0f, "Matrix — KINETIC strong vs CORROSIVE");

    ASSERT(Sovereign::FDamageMatrix::getEffectivenessLabel(1.3f) == "SUPER_EFFECTIVE", "Matrix — 1.3x = SUPER_EFFECTIVE");
    ASSERT(Sovereign::FDamageMatrix::getEffectivenessLabel(0.7f) == "NOT_VERY_EFFECTIVE", "Matrix — 0.7x = NOT_VERY_EFFECTIVE");
    ASSERT(Sovereign::FDamageMatrix::getEffectivenessLabel(1.0f) == "NORMAL", "Matrix — 1.0x = NORMAL");
}

void testDeterministicRNG() {
    std::cout << "\n=== Deterministic RNG ===" << std::endl;

    Sovereign::DeterministicRNG rng1("test-seed-12345");
    Sovereign::DeterministicRNG rng2("test-seed-12345");

    std::vector<float> seq1, seq2;
    for (int i = 0; i < 20; i++) {
        seq1.push_back(rng1.next01());
        seq2.push_back(rng2.next01());
    }

    bool allMatch = true;
    for (int i = 0; i < 20; i++) {
        if (seq1[i] != seq2[i]) { allMatch = false; break; }
    }
    ASSERT(allMatch, "RNG — same seed produces identical sequence");

    bool allInRange = true;
    for (float v : seq1) {
        if (v < 0.0f || v > 1.0f) { allInRange = false; break; }
    }
    ASSERT(allInRange, "RNG — all values in [0,1]");

    std::set<float> unique(seq1.begin(), seq1.end());
    ASSERT(unique.size() >= 15, "RNG — sufficient variance (15+ unique from 20)");

    Sovereign::DeterministicRNG rng3("different-seed-99999");
    float v3 = rng3.next01();
    ASSERT(v3 != seq1[0], "RNG — different seed = different first value");
}

void testBasicInteraction() {
    std::cout << "\n=== Basic Interaction ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_test.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto entityA = forgeEntity("dragon-fire");
    auto entityB = forgeEntity("golem-stone");

    auto& arena = Sovereign::SovereignArena::Get();
    auto result = arena.interact(entityA, "dragon", entityB, "golem");

    ASSERT(!result.arenaSessionId.empty(), "Interact — session ID generated");
    ASSERT(result.arenaSessionId.size() == 64, "Interact — session ID is SHA-256");
    ASSERT(result.entityAKey == "dragon", "Interact — entity A key preserved");
    ASSERT(result.entityBKey == "golem", "Interact — entity B key preserved");
    ASSERT(result.totalRounds > 0, "Interact — at least 1 round played");
    ASSERT(result.rounds.size() > 0, "Interact — round data recorded");
    ASSERT(result.entityAHealthRemaining >= 0.0f, "Interact — health A >= 0");
    ASSERT(result.entityBHealthRemaining >= 0.0f, "Interact — health B >= 0");

    std::set<std::string> validOutcomes = {"ATTACKER_WINS", "DEFENDER_WINS", "TRADE", "DRAW", "MISS"};
    ASSERT(validOutcomes.count(result.finalOutcomeName) > 0, "Interact — valid outcome name");

    ASSERT(!result.resultHash.empty(), "Interact — result hash computed");
    ASSERT(result.resultHash.size() == 64, "Interact — result hash is SHA-256");
    ASSERT(result.verifyIntegrity(), "Interact — result integrity verified");

    ASSERT(result.timestamp > 0, "Interact — timestamp recorded");

    resetAll();
}

void testInteractionDeterminism() {
    std::cout << "\n=== Interaction Determinism ===" << std::endl;
    resetAll();

    auto entityA = forgeEntity("samurai-blade");
    auto entityB = forgeEntity("knight-shield");

    auto& arena = Sovereign::SovereignArena::Get();
    auto r1 = arena.interact(entityA, "samurai", entityB, "knight");

    resetAll();
    auto entityA2 = forgeEntity("samurai-blade");
    auto entityB2 = forgeEntity("knight-shield");

    auto r2 = arena.interact(entityA2, "samurai", entityB2, "knight");

    ASSERT(r1.resultHash == r2.resultHash, "Determinism — identical result hash");
    ASSERT(r1.finalOutcome == r2.finalOutcome, "Determinism — identical outcome");
    ASSERT(r1.totalRounds == r2.totalRounds, "Determinism — identical round count");
    ASSERT(r1.entityAHealthRemaining == r2.entityAHealthRemaining, "Determinism — identical health A");
    ASSERT(r1.entityBHealthRemaining == r2.entityBHealthRemaining, "Determinism — identical health B");
    ASSERT(r1.totalDamageDealtByA == r2.totalDamageDealtByA, "Determinism — identical damage by A");
    ASSERT(r1.totalDamageDealtByB == r2.totalDamageDealtByB, "Determinism — identical damage by B");
    ASSERT(r1.arenaSessionId == r2.arenaSessionId, "Determinism — identical session ID");

    ASSERT(r1.rounds.size() == r2.rounds.size(), "Determinism — identical round count in log");
    if (r1.rounds.size() == r2.rounds.size()) {
        for (size_t i = 0; i < r1.rounds.size(); i++) {
            ASSERT(r1.rounds[i].roundHash == r2.rounds[i].roundHash,
                   "Determinism — round " + std::to_string(i) + " hash matches");
        }
    }

    resetAll();
}

void testRoundHashing() {
    std::cout << "\n=== Round-Level Hashing ===" << std::endl;
    resetAll();

    auto eA = forgeEntity("round-hash-entity-a");
    auto eB = forgeEntity("round-hash-entity-b");

    auto& arena = Sovereign::SovereignArena::Get();
    auto result = arena.interact(eA, "rh-a", eB, "rh-b");

    for (size_t i = 0; i < result.rounds.size(); i++) {
        ASSERT(!result.rounds[i].roundHash.empty(),
               "RoundHash — round " + std::to_string(i) + " has hash");
        ASSERT(result.rounds[i].roundHash.size() == 64,
               "RoundHash — round " + std::to_string(i) + " hash is SHA-256");
    }

    if (result.rounds.size() >= 2) {
        ASSERT(result.rounds[0].roundHash != result.rounds[1].roundHash, "RoundHash — different rounds have different hashes");
    }

    ASSERT(!result.rounds.empty(), "RoundHash — at least 1 round recorded");

    std::string canonical = result.rounds[0].canonicalize();
    ASSERT(canonical.find("\"attackerKey\"") != std::string::npos, "RoundHash — canonical has attackerKey");
    ASSERT(canonical.find("\"defenderKey\"") != std::string::npos, "RoundHash — canonical has defenderKey");
    ASSERT(canonical.find("\"damageDealt\"") != std::string::npos, "RoundHash — canonical has damageDealt");
    ASSERT(canonical.find("\"roundOutcome\"") != std::string::npos, "RoundHash — canonical has roundOutcome");

    resetAll();
}

void testResultIntegrity() {
    std::cout << "\n=== Result Integrity (Tamper-Proof) ===" << std::endl;
    resetAll();

    auto eA = forgeEntity("integrity-alpha");
    auto eB = forgeEntity("integrity-beta");

    auto& arena = Sovereign::SovereignArena::Get();
    auto result = arena.interact(eA, "int-a", eB, "int-b");

    ASSERT(result.verifyIntegrity(), "Integrity — clean result verifies");
    ASSERT(arena.verifyResult(result), "Integrity — verifyResult agrees");

    auto tampered = result;
    tampered.entityAHealthRemaining = 999.0f;
    ASSERT(!tampered.verifyIntegrity(), "Integrity — tampered health A FAILS verification");

    auto tampered2 = result;
    tampered2.finalOutcomeName = "ATTACKER_WINS";
    if (result.finalOutcomeName != "ATTACKER_WINS") {
        ASSERT(!tampered2.verifyIntegrity(), "Integrity — tampered outcome FAILS verification");
    } else {
        passed++;
        std::cout << "  PASS: Integrity — tampered outcome skip (already ATTACKER_WINS)" << std::endl;
    }

    auto tampered3 = result;
    tampered3.totalDamageDealtByA += 50.0f;
    ASSERT(!tampered3.verifyIntegrity(), "Integrity — tampered damage FAILS verification");

    resetAll();
}

void testChronosFlush() {
    std::cout << "\n=== Arena → Chronos Flush ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_chronos.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& arena = Sovereign::SovereignArena::Get();

    int flushFired = 0;
    arena.onFlush([&](const Sovereign::FInteractionResult& r, bool success) {
        flushFired++;
    });

    auto eA = forgeEntity("flush-alpha");
    auto eB = forgeEntity("flush-beta");

    auto result = arena.interact(eA, "fl-a", eB, "fl-b");

    ASSERT(result.flushedToArbiter, "Flush — result marked as flushed");
    ASSERT(flushFired == 1, "Flush — flush delegate fired");
    ASSERT(Sovereign::ChronosEngine::Get().pendingCount() > 0, "Flush — Chronos has pending entry");
    ASSERT(arena.stats().totalFlushed == 1, "Flush — totalFlushed = 1");

    resetAll();
}

void testInteractionDelegate() {
    std::cout << "\n=== Interaction Complete Delegate ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_delegate.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& arena = Sovereign::SovereignArena::Get();

    int completeFired = 0;
    std::string lastOutcome;
    arena.onInteractionComplete([&](const Sovereign::FInteractionResult& r) {
        completeFired++;
        lastOutcome = r.finalOutcomeName;
    });

    int roundFired = 0;
    arena.onRoundResolved([&](const Sovereign::FInteractionRound& r, int num, int total) {
        roundFired++;
    });

    auto eA = forgeEntity("delegate-alpha");
    auto eB = forgeEntity("delegate-beta");
    arena.interact(eA, "dl-a", eB, "dl-b");

    ASSERT(completeFired == 1, "Delegate — interaction complete fired");
    ASSERT(!lastOutcome.empty(), "Delegate — outcome received");
    ASSERT(roundFired > 0, "Delegate — round resolved fired for each round");

    resetAll();
}

void testArenaStats() {
    std::cout << "\n=== Arena Statistics ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_stats.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& arena = Sovereign::SovereignArena::Get();

    ASSERT(arena.stats().totalInteractions == 0, "Stats — initial interactions = 0");

    for (int i = 0; i < 5; i++) {
        auto eA = forgeEntity("stats-a-" + std::to_string(i));
        auto eB = forgeEntity("stats-b-" + std::to_string(i));
        arena.interact(eA, "sa-" + std::to_string(i), eB, "sb-" + std::to_string(i));
    }

    ASSERT(arena.stats().totalInteractions == 5, "Stats — 5 interactions recorded");
    ASSERT(arena.stats().totalRoundsPlayed > 0, "Stats — rounds played > 0");
    ASSERT(arena.stats().lastInteractionTimestamp > 0, "Stats — last timestamp set");

    int outcomeSum = arena.stats().attackerWins + arena.stats().defenderWins +
                     arena.stats().trades + arena.stats().draws;
    ASSERT(outcomeSum == 5, "Stats — outcome distribution sums to 5");

    ASSERT(!arena.stats().damageTypeDistribution.empty(), "Stats — damage type distribution recorded");

    ASSERT(arena.history().size() == 5, "Stats — history has 5 entries");

    resetAll();
}

void testVerifyDeterminism() {
    std::cout << "\n=== Verify Determinism API ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_verifdet.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& arena = Sovereign::SovereignArena::Get();
    auto eA = forgeEntity("det-verify-a");
    auto eB = forgeEntity("det-verify-b");

    ASSERT(arena.verifyDeterminism(eA, "dv-a", eB, "dv-b"), "VerifyDet — same inputs = same output");

    resetAll();
}

void testOutcomeEnum() {
    std::cout << "\n=== Outcome Enum ===" << std::endl;
    ASSERT(Sovereign::outcomeToString(Sovereign::InteractionOutcome::ATTACKER_WINS) == "ATTACKER_WINS", "Outcome — ATTACKER_WINS");
    ASSERT(Sovereign::outcomeToString(Sovereign::InteractionOutcome::DEFENDER_WINS) == "DEFENDER_WINS", "Outcome — DEFENDER_WINS");
    ASSERT(Sovereign::outcomeToString(Sovereign::InteractionOutcome::TRADE) == "TRADE", "Outcome — TRADE");
    ASSERT(Sovereign::outcomeToString(Sovereign::InteractionOutcome::MISS) == "MISS", "Outcome — MISS");
    ASSERT(Sovereign::outcomeToString(Sovereign::InteractionOutcome::DRAW) == "DRAW", "Outcome — DRAW");
}

void testResultCanonical() {
    std::cout << "\n=== Result Canonical Form ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_canon.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto eA = forgeEntity("canon-a");
    auto eB = forgeEntity("canon-b");

    auto& arena = Sovereign::SovereignArena::Get();
    auto result = arena.interact(eA, "ca", eB, "cb");

    std::string canonical = result.canonicalize();
    ASSERT(canonical.find("\"sessionId\"") != std::string::npos, "Canonical — has sessionId");
    ASSERT(canonical.find("\"entityAKey\"") != std::string::npos, "Canonical — has entityAKey");
    ASSERT(canonical.find("\"entityBKey\"") != std::string::npos, "Canonical — has entityBKey");
    ASSERT(canonical.find("\"finalOutcome\"") != std::string::npos, "Canonical — has finalOutcome");
    ASSERT(canonical.find("\"statsA\"") != std::string::npos, "Canonical — has statsA");
    ASSERT(canonical.find("\"statsB\"") != std::string::npos, "Canonical — has statsB");
    ASSERT(canonical.find("\"rounds\"") != std::string::npos, "Canonical — has rounds array");
    ASSERT(canonical.find("\"totalRounds\"") != std::string::npos, "Canonical — has totalRounds");
    ASSERT(canonical.find("\"totalDamageByA\"") != std::string::npos, "Canonical — has totalDamageByA");

    resetAll();
}

void testCrossModuleIntegration() {
    std::cout << "\n=== Cross-Module Integration (Forge → Arena → Chronos) ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_crossmod.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    Sovereign::JsonValue payloadA(std::map<std::string, Sovereign::JsonValue>{
        {"name", Sovereign::JsonValue("Dragon")},
        {"element", Sovereign::JsonValue("fire")},
        {"level", Sovereign::JsonValue(50)}
    });
    Sovereign::JsonValue payloadB(std::map<std::string, Sovereign::JsonValue>{
        {"name", Sovereign::JsonValue("Golem")},
        {"element", Sovereign::JsonValue("earth")},
        {"level", Sovereign::JsonValue(48)}
    });

    auto phenoA = Sovereign::BiologicalForge::Get().forgeFromPayload(payloadA, "dragon-fire");
    auto phenoB = Sovereign::BiologicalForge::Get().forgeFromPayload(payloadB, "golem-earth");

    ASSERT(phenoA.verifyIntegrity(), "CrossMod — Forge integrity A");
    ASSERT(phenoB.verifyIntegrity(), "CrossMod — Forge integrity B");

    auto& arena = Sovereign::SovereignArena::Get();
    auto result = arena.interact(phenoA, "dragon-fire", phenoB, "golem-earth");

    ASSERT(result.verifyIntegrity(), "CrossMod — Arena result integrity");
    ASSERT(result.flushedToArbiter, "CrossMod — flushed to Chronos");
    ASSERT(Sovereign::ChronosEngine::Get().pendingCount() > 0, "CrossMod — Chronos has entry");

    auto& showroom = Sovereign::ASovereignShowroom::Get();
    auto scene = showroom.loadEntity("dragon-fire", phenoA);
    ASSERT(scene.active, "CrossMod — Showroom scene active for winner");
    ASSERT(scene.lighting.allValuesClamped(), "CrossMod — Showroom lighting clamped");
    ASSERT(scene.pedigree.loci.size() == 16, "CrossMod — Pedigree has 16 loci");

    resetAll();
}

void testResetClearsAll() {
    std::cout << "\n=== Reset Clears Everything ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_reset.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto eA = forgeEntity("reset-a");
    auto eB = forgeEntity("reset-b");
    auto& arena = Sovereign::SovereignArena::Get();
    arena.interact(eA, "ra", eB, "rb");

    arena.reset();

    ASSERT(arena.stats().totalInteractions == 0, "Reset — interactions cleared");
    ASSERT(arena.history().empty(), "Reset — history cleared");
    ASSERT(arena.stats().totalFlushed == 0, "Reset — flushed cleared");
    ASSERT(arena.stats().totalRoundsPlayed == 0, "Reset — rounds cleared");

    resetAll();
}

void testArenaConfig() {
    std::cout << "\n=== Arena Configuration ===" << std::endl;
    auto& arena = Sovereign::SovereignArena::Get();
    arena.reset();

    Sovereign::SovereignArena::ArenaConfig cfg;
    cfg.maxRounds = 5;
    cfg.startingHealth = 50.0f;
    cfg.tradeThreshold = 3.0f;
    cfg.autoFlushToChronos = false;
    cfg.missFloor = 0.2f;
    arena.configure(cfg);

    auto config = arena.getConfig();
    ASSERT(config.maxRounds == 5, "Config — maxRounds = 5");
    ASSERT(config.startingHealth == 50.0f, "Config — startingHealth = 50");
    ASSERT(config.tradeThreshold == 3.0f, "Config — tradeThreshold = 3");
    ASSERT(config.autoFlushToChronos == false, "Config — autoFlush disabled");
    ASSERT(config.missFloor == 0.2f, "Config — missFloor = 0.2");

    resetAll();
}

void testHealthBoundary() {
    std::cout << "\n=== Health Boundary Conditions ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig ccfg;
    ccfg.persistencePath = "/tmp/arena_health.bin";
    Sovereign::ChronosEngine::Get().configure(ccfg);

    auto& arena = Sovereign::SovereignArena::Get();
    auto eA = forgeEntity("health-a");
    auto eB = forgeEntity("health-b");

    auto result = arena.interact(eA, "ha", eB, "hb");

    ASSERT(result.entityAHealthRemaining >= 0.0f, "HealthBound — A health >= 0 (no negative)");
    ASSERT(result.entityBHealthRemaining >= 0.0f, "HealthBound — B health >= 0 (no negative)");
    ASSERT(result.totalDamageDealtByA >= 0.0f, "HealthBound — damage by A >= 0");
    ASSERT(result.totalDamageDealtByB >= 0.0f, "HealthBound — damage by B >= 0");

    resetAll();
}

void testAsymmetricOrder() {
    std::cout << "\n=== Asymmetric Order (A vs B != B vs A) ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/arena_asym.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& arena = Sovereign::SovereignArena::Get();
    auto eA = forgeEntity("order-alpha");
    auto eB = forgeEntity("order-beta");

    auto r1 = arena.interact(eA, "alpha", eB, "beta");
    resetAll();
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto eA2 = forgeEntity("order-alpha");
    auto eB2 = forgeEntity("order-beta");
    auto r2 = arena.interact(eB2, "beta", eA2, "alpha");

    ASSERT(r1.arenaSessionId != r2.arenaSessionId, "Asymmetric — different session IDs");

    resetAll();
}

int main() {
    std::cout << "=== The Sovereign Arena: Deterministic Interaction Layer ===" << std::endl;

    testArenaSingleton();
    testStatMapping();
    testDifferentEntitiesDifferentStats();
    testDamageTypeClassification();
    testDamageMatrix();
    testDeterministicRNG();
    testBasicInteraction();
    testInteractionDeterminism();
    testRoundHashing();
    testResultIntegrity();
    testChronosFlush();
    testInteractionDelegate();
    testArenaStats();
    testVerifyDeterminism();
    testOutcomeEnum();
    testResultCanonical();
    testCrossModuleIntegration();
    testResetClearsAll();
    testArenaConfig();
    testHealthBoundary();
    testAsymmetricOrder();

    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "ARENA RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;

    return failed > 0 ? 1 : 0;
}
