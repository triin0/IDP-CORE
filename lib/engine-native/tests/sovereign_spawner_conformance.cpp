#include "../generated/SovereignSpawner.h"
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

static void resetAll() {
    Sovereign::SovereignSpawner::Get().reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
    Sovereign::SovereignArena::Get().reset();
}

static std::string hashSeed(const std::string& s) {
    return Sovereign::SovereignSHA256::hash(s);
}

void testSpawnerSingleton() {
    std::cout << "\n=== Sovereign Spawner Singleton ===" << std::endl;
    auto& s1 = Sovereign::SovereignSpawner::Get();
    auto& s2 = Sovereign::SovereignSpawner::Get();
    ASSERT(&s1 == &s2, "Singleton — same instance");
    s1.reset();
}

void testDominanceTable() {
    std::cout << "\n=== Genetic Dominance Table ===" << std::endl;

    const auto& table = Sovereign::GeneticDominanceTable::table();
    ASSERT(table.size() == 16, "DomTable — 16 entries");

    ASSERT(table[0].locusName == "primaryR", "DomTable — locus 0 = primaryR");
    ASSERT(table[0].byteOffset == 0, "DomTable — primaryR at byte 0");
    ASSERT(table[0].dominance == Sovereign::GeneDominance::CODOMINANT, "DomTable — primaryR is CODOMINANT");

    ASSERT(table[6].locusName == "metallic", "DomTable — locus 6 = metallic");
    ASSERT(table[6].byteOffset == 6, "DomTable — metallic at byte 6");
    ASSERT(table[6].dominance == Sovereign::GeneDominance::DOMINANT, "DomTable — metallic is DOMINANT");

    ASSERT(table[14].locusName == "subsurface", "DomTable — locus 14 = subsurface");
    ASSERT(table[14].dominance == Sovereign::GeneDominance::RECESSIVE, "DomTable — subsurface is RECESSIVE");

    auto* entry = Sovereign::GeneticDominanceTable::findByName("emission");
    ASSERT(entry != nullptr, "DomTable — findByName emission found");
    ASSERT(entry->byteOffset == 8, "DomTable — emission at byte 8");
    ASSERT(entry->dominance == Sovereign::GeneDominance::DOMINANT, "DomTable — emission is DOMINANT");

    auto* missing = Sovereign::GeneticDominanceTable::findByName("nonexistent");
    ASSERT(missing == nullptr, "DomTable — findByName nonexistent returns null");

    for (size_t i = 0; i < table.size(); i++) {
        ASSERT(table[i].mutationSensitivity > 0.0f && table[i].mutationSensitivity <= 0.1f,
               "DomTable — locus " + std::to_string(i) + " mutation sensitivity in (0,0.1]");
    }

    ASSERT(Sovereign::dominanceToString(Sovereign::GeneDominance::DOMINANT) == "DOMINANT", "DomTable — DOMINANT string");
    ASSERT(Sovereign::dominanceToString(Sovereign::GeneDominance::RECESSIVE) == "RECESSIVE", "DomTable — RECESSIVE string");
    ASSERT(Sovereign::dominanceToString(Sovereign::GeneDominance::CODOMINANT) == "CODOMINANT", "DomTable — CODOMINANT string");

    resetAll();
}

void testInheritanceModeEnum() {
    std::cout << "\n=== InheritanceMode Enum ===" << std::endl;
    ASSERT(Sovereign::inheritanceModeToString(Sovereign::InheritanceMode::PARENT_A) == "PARENT_A", "InhMode — PARENT_A");
    ASSERT(Sovereign::inheritanceModeToString(Sovereign::InheritanceMode::PARENT_B) == "PARENT_B", "InhMode — PARENT_B");
    ASSERT(Sovereign::inheritanceModeToString(Sovereign::InheritanceMode::BLEND) == "BLEND", "InhMode — BLEND");
    ASSERT(Sovereign::inheritanceModeToString(Sovereign::InheritanceMode::MUTATION) == "MUTATION", "InhMode — MUTATION");
}

void testBasicSpawn() {
    std::cout << "\n=== Basic Spawn ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_basic.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    std::string parentA = hashSeed("volcanic-dragon");
    std::string parentB = hashSeed("crystalline-golem");

    auto result = spawner.spawn(parentA, parentB, "seed-alpha");

    ASSERT(!result.lineage.childHash.empty(), "Spawn — child hash generated");
    ASSERT(result.lineage.childHash.size() == 64, "Spawn — child hash is SHA-256");
    ASSERT(result.lineage.parentAHash == parentA, "Spawn — parent A preserved");
    ASSERT(result.lineage.parentBHash == parentB, "Spawn — parent B preserved");
    ASSERT(result.lineage.sovereignSeed == "seed-alpha", "Spawn — seed preserved");
    ASSERT(result.lineage.generation == 1, "Spawn — generation = 1");
    ASSERT(result.lineage.inheritanceMap.size() == 16, "Spawn — 16 loci in inheritance map");
    ASSERT(result.lineage.birthTimestamp > 0, "Spawn — birth timestamp set");
    ASSERT(!result.lineage.lineageHash.empty(), "Spawn — lineage hash computed");
    ASSERT(result.lineage.lineageHash.size() == 64, "Spawn — lineage hash is SHA-256");
    ASSERT(result.lineage.verifyIntegrity(), "Spawn — lineage integrity verified");

    ASSERT(result.forgeSucceeded, "Spawn — auto-forge succeeded");
    ASSERT(result.integrityVerified, "Spawn — child phenotype integrity verified");
    ASSERT(!result.childPhenotype.sourceHash.empty(), "Spawn — child has source hash");
    ASSERT(!result.childPhenotype.classificationName.empty(), "Spawn — child has classification");

    ASSERT(result.lineage.childHash != parentA, "Spawn — child hash differs from parent A");
    ASSERT(result.lineage.childHash != parentB, "Spawn — child hash differs from parent B");

    resetAll();
}

void testSpawnDeterminism() {
    std::cout << "\n=== Spawn Determinism ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_det.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    std::string pA = hashSeed("det-parent-alpha");
    std::string pB = hashSeed("det-parent-beta");
    std::string seed = "determinism-test-seed";

    auto r1 = spawner.spawn(pA, pB, seed);

    resetAll();
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto r2 = spawner.spawn(pA, pB, seed);

    ASSERT(r1.lineage.childHash == r2.lineage.childHash, "Determinism — identical child hash");
    ASSERT(r1.lineage.lineageHash == r2.lineage.lineageHash, "Determinism — identical lineage hash");
    ASSERT(r1.lineage.totalMutations == r2.lineage.totalMutations, "Determinism — identical mutation count");
    ASSERT(r1.lineage.generation == r2.lineage.generation, "Determinism — identical generation");

    ASSERT(r1.lineage.inheritanceMap.size() == r2.lineage.inheritanceMap.size(), "Determinism — same inheritance map size");
    for (size_t i = 0; i < r1.lineage.inheritanceMap.size(); i++) {
        ASSERT(r1.lineage.inheritanceMap[i].childValue == r2.lineage.inheritanceMap[i].childValue,
               "Determinism — locus " + std::to_string(i) + " same child value");
        ASSERT(r1.lineage.inheritanceMap[i].mode == r2.lineage.inheritanceMap[i].mode,
               "Determinism — locus " + std::to_string(i) + " same inheritance mode");
    }

    ASSERT(r1.childPhenotype.classification == r2.childPhenotype.classification, "Determinism — identical classification");
    ASSERT(r1.childPhenotype.phenotypeHash == r2.childPhenotype.phenotypeHash, "Determinism — identical phenotype hash");

    resetAll();
}

void testVerifyDeterminismAPI() {
    std::cout << "\n=== Verify Determinism API ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_verdet.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();
    std::string pA = hashSeed("verdet-a");
    std::string pB = hashSeed("verdet-b");

    ASSERT(spawner.verifyDeterminism(pA, pB, "vd-seed"), "VerifyDet — same inputs produce same child");

    resetAll();
}

void testInheritanceMapDetail() {
    std::cout << "\n=== Inheritance Map Detail ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_inhmap.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();
    auto result = spawner.spawn(hashSeed("map-a"), hashSeed("map-b"), "map-seed");

    std::set<std::string> seenModes;
    for (const auto& loc : result.lineage.inheritanceMap) {
        ASSERT(!loc.locusName.empty(), "InhMap — locus has name: " + loc.locusName);
        seenModes.insert(Sovereign::inheritanceModeToString(loc.mode));
    }

    ASSERT(seenModes.size() >= 2, "InhMap — at least 2 different inheritance modes used");

    bool foundCodominant = false;
    bool foundDominant = false;
    bool foundRecessive = false;
    for (const auto& loc : result.lineage.inheritanceMap) {
        if (loc.dominance == Sovereign::GeneDominance::CODOMINANT) foundCodominant = true;
        if (loc.dominance == Sovereign::GeneDominance::DOMINANT) foundDominant = true;
        if (loc.dominance == Sovereign::GeneDominance::RECESSIVE) foundRecessive = true;
    }
    ASSERT(foundCodominant, "InhMap — has CODOMINANT loci");
    ASSERT(foundDominant, "InhMap — has DOMINANT loci");
    ASSERT(foundRecessive, "InhMap — has RECESSIVE loci");

    resetAll();
}

void testMutationMoat() {
    std::cout << "\n=== Mutation Moat ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_mut.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    Sovereign::SovereignSpawner::SpawnerConfig scfg;
    scfg.baseMutationRate = 0.50f;
    scfg.autoFlushToChronos = false;
    spawner.configure(scfg);

    int totalMutations = 0;
    int totalLoci = 0;
    for (int i = 0; i < 20; i++) {
        Sovereign::BiologicalForge::Get().reset();
        auto r = spawner.spawn(hashSeed("mut-a-" + std::to_string(i)),
                                hashSeed("mut-b-" + std::to_string(i)),
                                "mut-seed-" + std::to_string(i));
        totalMutations += r.lineage.totalMutations;
        totalLoci += 16;
    }

    float mutRate = static_cast<float>(totalMutations) / static_cast<float>(totalLoci);
    ASSERT(totalMutations > 0, "MutMoat — mutations occurred with high rate");
    ASSERT(mutRate > 0.0f, "MutMoat — mutation rate > 0%");

    resetAll();

    scfg.baseMutationRate = 0.0001f;
    spawner.configure(scfg);

    int lowMutations = 0;
    for (int i = 0; i < 20; i++) {
        Sovereign::BiologicalForge::Get().reset();
        auto r = spawner.spawn(hashSeed("lowmut-a-" + std::to_string(i)),
                                hashSeed("lowmut-b-" + std::to_string(i)),
                                "lowmut-" + std::to_string(i));
        lowMutations += r.lineage.totalMutations;
    }

    ASSERT(lowMutations < totalMutations, "MutMoat — lower rate = fewer mutations");

    resetAll();
}

void testMutationDelegate() {
    std::cout << "\n=== Mutation Delegate ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_mutdel.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    Sovereign::SovereignSpawner::SpawnerConfig scfg;
    scfg.baseMutationRate = 0.50f;
    scfg.autoFlushToChronos = false;
    spawner.configure(scfg);

    int mutationsFired = 0;
    spawner.onMutation([&](const Sovereign::FLocusInheritance& loc, int idx) {
        mutationsFired++;
    });

    for (int i = 0; i < 10; i++) {
        Sovereign::BiologicalForge::Get().reset();
        spawner.spawn(hashSeed("mutdel-a-" + std::to_string(i)),
                       hashSeed("mutdel-b-" + std::to_string(i)),
                       "mutdel-" + std::to_string(i));
    }

    ASSERT(mutationsFired > 0, "MutDelegate — mutation delegate fired");

    resetAll();
}

void testChronosFlush() {
    std::cout << "\n=== Spawner → Chronos Flush ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_flush.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    int flushFired = 0;
    spawner.onLineageFlushed([&](const Sovereign::FSpawnLineage& l, bool success) {
        flushFired++;
    });

    auto result = spawner.spawn(hashSeed("flush-a"), hashSeed("flush-b"), "flush-seed");

    ASSERT(result.lineage.flushedToChronos, "Flush — lineage marked as flushed");
    ASSERT(flushFired == 1, "Flush — flush delegate fired");
    ASSERT(Sovereign::ChronosEngine::Get().pendingCount() > 0, "Flush — Chronos has entry");
    ASSERT(spawner.stats().totalFlushed == 1, "Flush — totalFlushed = 1");

    resetAll();
}

void testSpawnDelegate() {
    std::cout << "\n=== Spawn Complete Delegate ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_delegate.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    int completeFired = 0;
    std::string lastChildClass;
    spawner.onSpawnComplete([&](const Sovereign::FSpawnLineage& l, const Sovereign::FVisualPhenotype& p) {
        completeFired++;
        lastChildClass = p.classificationName;
    });

    spawner.spawn(hashSeed("del-a"), hashSeed("del-b"), "del-seed");

    ASSERT(completeFired == 1, "SpawnDelegate — complete delegate fired");
    ASSERT(!lastChildClass.empty(), "SpawnDelegate — received child classification");

    resetAll();
}

void testLineageRegistry() {
    std::cout << "\n=== Lineage Registry ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_registry.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    auto r1 = spawner.spawn(hashSeed("reg-a"), hashSeed("reg-b"), "reg-1");
    auto r2 = spawner.spawn(hashSeed("reg-c"), hashSeed("reg-d"), "reg-2");

    ASSERT(spawner.registry().size() == 2, "Registry — 2 entries");
    ASSERT(spawner.history().size() == 2, "Registry — history has 2 entries");

    auto* lineage = spawner.getLineage(r1.lineage.childHash);
    ASSERT(lineage != nullptr, "Registry — getLineage found child");
    ASSERT(lineage->parentAHash == r1.lineage.parentAHash, "Registry — parent A matches");
    ASSERT(lineage->parentBHash == r1.lineage.parentBHash, "Registry — parent B matches");

    auto* missing = spawner.getLineage("nonexistent-hash");
    ASSERT(missing == nullptr, "Registry — nonexistent returns nullptr");

    resetAll();
}

void testAncestryChain() {
    std::cout << "\n=== Ancestry Chain ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_ancestry.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    std::string a = hashSeed("anc-a");
    std::string b = hashSeed("anc-b");

    auto gen1 = spawner.spawn(a, b, "anc-1", 0);
    auto gen2 = spawner.spawn(gen1.lineage.childHash, b, "anc-2", 1);
    auto gen3 = spawner.spawn(gen2.lineage.childHash, gen1.lineage.childHash, "anc-3", 2);

    ASSERT(gen1.lineage.generation == 1, "Ancestry — gen1 = 1");
    ASSERT(gen2.lineage.generation == 2, "Ancestry — gen2 = 2");
    ASSERT(gen3.lineage.generation == 3, "Ancestry — gen3 = 3");

    auto chain = spawner.getAncestry(gen3.lineage.childHash, 10);
    ASSERT(chain.size() >= 2, "Ancestry — chain has at least 2 entries");
    ASSERT(chain[0] == gen3.lineage.childHash, "Ancestry — chain starts with gen3");

    auto offspring = spawner.getOffspring(gen1.lineage.childHash);
    ASSERT(offspring.size() >= 1, "Ancestry — gen1 has offspring");

    resetAll();
}

void testMultiGeneration() {
    std::cout << "\n=== Multi-Generation Spawn ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_multigen.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    auto result = spawner.spawnMultiGeneration(
        hashSeed("multi-a"), hashSeed("multi-b"), 5, "multi-seed");

    ASSERT(spawner.stats().totalSpawns == 5, "MultiGen — 5 total spawns");
    ASSERT(result.lineage.generation == 5, "MultiGen — last child is generation 5");
    ASSERT(spawner.stats().maxGenerationReached == 5, "MultiGen — max generation = 5");
    ASSERT(spawner.history().size() == 5, "MultiGen — 5 entries in history");

    resetAll();
}

void testLineageIntegrity() {
    std::cout << "\n=== Lineage Integrity (Tamper-Proof) ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_integrity.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();
    auto result = spawner.spawn(hashSeed("int-a"), hashSeed("int-b"), "int-seed");

    ASSERT(result.lineage.verifyIntegrity(), "Integrity — clean lineage verifies");

    auto tampered = result.lineage;
    tampered.generation = 999;
    ASSERT(!tampered.verifyIntegrity(), "Integrity — tampered generation FAILS");

    auto tampered2 = result.lineage;
    tampered2.parentAHash = "fake-hash";
    ASSERT(!tampered2.verifyIntegrity(), "Integrity — tampered parent FAILS");

    auto tampered3 = result.lineage;
    tampered3.totalMutations = 999;
    ASSERT(!tampered3.verifyIntegrity(), "Integrity — tampered mutations FAILS");

    resetAll();
}

void testSpawnerStats() {
    std::cout << "\n=== Spawner Statistics ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_stats.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    ASSERT(spawner.stats().totalSpawns == 0, "Stats — initial spawns = 0");

    for (int i = 0; i < 5; i++) {
        spawner.spawn(hashSeed("stat-a-" + std::to_string(i)),
                       hashSeed("stat-b-" + std::to_string(i)),
                       "stat-" + std::to_string(i));
    }

    ASSERT(spawner.stats().totalSpawns == 5, "Stats — 5 spawns recorded");
    ASSERT(spawner.stats().lastSpawnTimestamp > 0, "Stats — last timestamp set");
    ASSERT(!spawner.stats().offspringClassDistribution.empty(), "Stats — class distribution recorded");
    ASSERT(!spawner.stats().inheritanceModeDistribution.empty(), "Stats — inheritance mode distribution recorded");

    resetAll();
}

void testSpawnFromPhenotypes() {
    std::cout << "\n=== Spawn From Phenotypes ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_pheno.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& forge = Sovereign::BiologicalForge::Get();
    auto phenoA = forge.forge(hashSeed("pheno-a"), "entity-a");
    auto phenoB = forge.forge(hashSeed("pheno-b"), "entity-b");

    ASSERT(phenoA.verifyIntegrity(), "FromPheno — parent A integrity");
    ASSERT(phenoB.verifyIntegrity(), "FromPheno — parent B integrity");

    auto& spawner = Sovereign::SovereignSpawner::Get();
    auto result = spawner.spawnFromPhenotypes(phenoA, phenoB, "pheno-seed");

    ASSERT(result.forgeSucceeded, "FromPheno — forge succeeded");
    ASSERT(result.integrityVerified, "FromPheno — child integrity verified");
    ASSERT(result.lineage.parentAHash == phenoA.sourceHash, "FromPheno — parent A hash from phenotype");
    ASSERT(result.lineage.parentBHash == phenoB.sourceHash, "FromPheno — parent B hash from phenotype");

    resetAll();
}

void testChildPassesForgeTests() {
    std::cout << "\n=== Child Passes All Forge Classification ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_forgetest.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    std::set<std::string> childClasses;
    for (int i = 0; i < 50; i++) {
        Sovereign::BiologicalForge::Get().reset();
        auto result = spawner.spawn(hashSeed("forge-a-" + std::to_string(i)),
                                     hashSeed("forge-b-" + std::to_string(i)),
                                     "forge-seed-" + std::to_string(i));
        ASSERT(result.forgeSucceeded, "ForgeClass — child " + std::to_string(i) + " forged");
        ASSERT(result.integrityVerified, "ForgeClass — child " + std::to_string(i) + " integrity");
        ASSERT(result.childPhenotype.classification != Sovereign::PhenotypeClass::UNKNOWN,
               "ForgeClass — child " + std::to_string(i) + " has classification");
        childClasses.insert(result.childPhenotype.classificationName);
    }

    ASSERT(childClasses.size() >= 3, "ForgeClass — at least 3 different child classes from 50 spawns");

    resetAll();
}

void testResetClearsAll() {
    std::cout << "\n=== Reset Clears Everything ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_reset.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();
    spawner.spawn(hashSeed("rst-a"), hashSeed("rst-b"), "rst-seed");

    spawner.reset();

    ASSERT(spawner.stats().totalSpawns == 0, "Reset — spawns cleared");
    ASSERT(spawner.history().empty(), "Reset — history cleared");
    ASSERT(spawner.registry().empty(), "Reset — registry cleared");

    resetAll();
}

void testSpawnerConfig() {
    std::cout << "\n=== Spawner Configuration ===" << std::endl;
    auto& spawner = Sovereign::SovereignSpawner::Get();
    spawner.reset();

    Sovereign::SovereignSpawner::SpawnerConfig scfg;
    scfg.baseMutationRate = 0.05f;
    scfg.autoFlushToChronos = false;
    scfg.autoForgeChild = false;
    scfg.maxGenerationDepth = 50;
    spawner.configure(scfg);

    auto config = spawner.getConfig();
    ASSERT(std::abs(config.baseMutationRate - 0.05f) < 0.001f, "Config — baseMutationRate = 0.05");
    ASSERT(config.autoFlushToChronos == false, "Config — autoFlush disabled");
    ASSERT(config.autoForgeChild == false, "Config — autoForge disabled");
    ASSERT(config.maxGenerationDepth == 50, "Config — maxGenDepth = 50");

    resetAll();
}

void testAsymmetricParentOrder() {
    std::cout << "\n=== Asymmetric Parent Order ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_asym.bin";
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& spawner = Sovereign::SovereignSpawner::Get();

    std::string a = hashSeed("asym-a");
    std::string b = hashSeed("asym-b");

    auto r1 = spawner.spawn(a, b, "asym-seed");
    Sovereign::BiologicalForge::Get().reset();
    auto r2 = spawner.spawn(b, a, "asym-seed");

    ASSERT(r1.lineage.childHash != r2.lineage.childHash, "Asymmetric — A×B != B×A child hash");

    resetAll();
}

void testCrossModuleIntegration() {
    std::cout << "\n=== Cross-Module: Forge → Spawn → Arena → Chronos ===" << std::endl;
    resetAll();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/spawner_crossmod.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto& forge = Sovereign::BiologicalForge::Get();
    auto parentA = forge.forge(hashSeed("cross-dragon"), "dragon");
    auto parentB = forge.forge(hashSeed("cross-golem"), "golem");

    ASSERT(parentA.verifyIntegrity(), "CrossMod — parent A integrity");
    ASSERT(parentB.verifyIntegrity(), "CrossMod — parent B integrity");

    auto& spawner = Sovereign::SovereignSpawner::Get();
    auto spawnResult = spawner.spawnFromPhenotypes(parentA, parentB, "cross-seed");

    ASSERT(spawnResult.forgeSucceeded, "CrossMod — child forged");
    ASSERT(spawnResult.integrityVerified, "CrossMod — child integrity");
    ASSERT(spawnResult.lineage.flushedToChronos, "CrossMod — lineage flushed to Chronos");

    auto& arena = Sovereign::SovereignArena::Get();
    auto arenaResult = arena.interact(parentA, "dragon", spawnResult.childPhenotype, "offspring");

    ASSERT(arenaResult.verifyIntegrity(), "CrossMod — arena result integrity");
    ASSERT(!arenaResult.finalOutcomeName.empty(), "CrossMod — arena has outcome");

    ASSERT(Sovereign::ChronosEngine::Get().pendingCount() >= 2, "CrossMod — Chronos has lineage + arena entries");

    auto* lineage = spawner.getLineage(spawnResult.lineage.childHash);
    ASSERT(lineage != nullptr, "CrossMod — lineage in registry");
    ASSERT(lineage->verifyIntegrity(), "CrossMod — registered lineage integrity");

    auto& showroom = Sovereign::ASovereignShowroom::Get();
    auto scene = showroom.loadEntity("offspring", spawnResult.childPhenotype);
    ASSERT(scene.active, "CrossMod — offspring visible in Showroom");
    ASSERT(scene.pedigree.loci.size() == 16, "CrossMod — offspring pedigree has 16 loci");

    resetAll();
}

int main() {
    std::cout << "=== The Sovereign Spawner: Evolutionary Logic ===" << std::endl;

    testSpawnerSingleton();
    testDominanceTable();
    testInheritanceModeEnum();
    testBasicSpawn();
    testSpawnDeterminism();
    testVerifyDeterminismAPI();
    testInheritanceMapDetail();
    testMutationMoat();
    testMutationDelegate();
    testChronosFlush();
    testSpawnDelegate();
    testLineageRegistry();
    testAncestryChain();
    testMultiGeneration();
    testLineageIntegrity();
    testSpawnerStats();
    testSpawnFromPhenotypes();
    testChildPassesForgeTests();
    testResetClearsAll();
    testSpawnerConfig();
    testAsymmetricParentOrder();
    testCrossModuleIntegration();

    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "SPAWNER RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;

    return failed > 0 ? 1 : 0;
}
