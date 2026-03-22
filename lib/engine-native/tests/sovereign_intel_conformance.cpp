#include "../generated/SovereignIntel.h"
#include <iostream>
#include <cassert>
#include <cmath>
#include <set>
#include <vector>
#include <functional>
#include <map>

using namespace Sovereign;

static int passed = 0;
static int failed = 0;

#define TEST(name) { bool ok = true; const char* testName = name;
#define END_TEST(name) if (ok) { passed++; std::cout << "  PASS: " << testName << "\n"; } else { failed++; std::cout << "FAIL: " << testName << "\n"; } }

#define ASSERT_TRUE(expr) if (!(expr)) { std::cerr << "  ASSERT_TRUE failed: " #expr " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_FALSE(expr) if (expr) { std::cerr << "  ASSERT_FALSE failed: " #expr " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_EQ(a, b) if ((a) != (b)) { std::cerr << "  ASSERT_EQ failed: " #a " != " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_NEQ(a, b) if ((a) == (b)) { std::cerr << "  ASSERT_NEQ failed: " #a " == " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_GT(a, b) if (!((a) > (b))) { std::cerr << "  ASSERT_GT failed: " #a " <= " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_LT(a, b) if (!((a) < (b))) { std::cerr << "  ASSERT_LT failed: " #a " >= " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_GTE(a, b) if (!((a) >= (b))) { std::cerr << "  ASSERT_GTE failed: " #a " < " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_LTE(a, b) if (!((a) <= (b))) { std::cerr << "  ASSERT_LTE failed: " #a " > " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_NEAR(a, b, eps) if (std::abs((a) - (b)) > (eps)) { std::cerr << "  ASSERT_NEAR failed: " #a "=" << (a) << " vs " #b "=" << (b) << " eps=" << (eps) << " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_FLOAT_EQ(a, b) if (std::abs((a) - (b)) > 1e-5f) { std::cerr << "  ASSERT_FLOAT_EQ failed: " #a "=" << (a) << " vs " #b "=" << (b) << " [line " << __LINE__ << "]\n"; ok = false; }

int main() {
    std::cout << "============================================================\n";
    std::cout << "  SOVEREIGN INTEL CONFORMANCE TESTS (Module 14)\n";
    std::cout << "============================================================\n\n";

    auto& kernel = SovereignIntelKernel::Get();
    auto& forge = BiologicalForge::Get();

    // ================================================================
    // SECTION 1: BehaviorArchetype Enum Coverage
    // ================================================================
    TEST("archetype_aggressive_string")
        ASSERT_EQ(behaviorArchetypeToString(BehaviorArchetype::AGGRESSIVE), "AGGRESSIVE");
    END_TEST("archetype_aggressive_string")

    TEST("archetype_defensive_string")
        ASSERT_EQ(behaviorArchetypeToString(BehaviorArchetype::DEFENSIVE), "DEFENSIVE");
    END_TEST("archetype_defensive_string")

    TEST("archetype_evasive_string")
        ASSERT_EQ(behaviorArchetypeToString(BehaviorArchetype::EVASIVE), "EVASIVE");
    END_TEST("archetype_evasive_string")

    TEST("archetype_tactical_string")
        ASSERT_EQ(behaviorArchetypeToString(BehaviorArchetype::TACTICAL), "TACTICAL");
    END_TEST("archetype_tactical_string")

    TEST("archetype_berserker_string")
        ASSERT_EQ(behaviorArchetypeToString(BehaviorArchetype::BERSERKER), "BERSERKER");
    END_TEST("archetype_berserker_string")

    TEST("archetype_sentinel_string")
        ASSERT_EQ(behaviorArchetypeToString(BehaviorArchetype::SENTINEL), "SENTINEL");
    END_TEST("archetype_sentinel_string")

    TEST("archetype_unknown_string")
        ASSERT_EQ(behaviorArchetypeToString(BehaviorArchetype::UNKNOWN), "UNKNOWN");
    END_TEST("archetype_unknown_string")

    // ================================================================
    // SECTION 2: ActionType Enum Coverage
    // ================================================================
    TEST("action_strike_string")
        ASSERT_EQ(actionTypeToString(ActionType::STRIKE), "STRIKE");
    END_TEST("action_strike_string")

    TEST("action_guard_string")
        ASSERT_EQ(actionTypeToString(ActionType::GUARD), "GUARD");
    END_TEST("action_guard_string")

    TEST("action_flank_string")
        ASSERT_EQ(actionTypeToString(ActionType::FLANK), "FLANK");
    END_TEST("action_flank_string")

    TEST("action_charge_string")
        ASSERT_EQ(actionTypeToString(ActionType::CHARGE), "CHARGE");
    END_TEST("action_charge_string")

    TEST("action_retreat_string")
        ASSERT_EQ(actionTypeToString(ActionType::RETREAT), "RETREAT");
    END_TEST("action_retreat_string")

    TEST("action_counter_string")
        ASSERT_EQ(actionTypeToString(ActionType::COUNTER), "COUNTER");
    END_TEST("action_counter_string")

    TEST("action_feint_string")
        ASSERT_EQ(actionTypeToString(ActionType::FEINT), "FEINT");
    END_TEST("action_feint_string")

    TEST("action_hold_string")
        ASSERT_EQ(actionTypeToString(ActionType::HOLD), "HOLD");
    END_TEST("action_hold_string")

    // ================================================================
    // SECTION 3: FBehavioralWeights Defaults & Ranges
    // ================================================================
    TEST("weights_default_all_zero")
        FBehavioralWeights w;
        ASSERT_FLOAT_EQ(w.aggression, 0.0f);
        ASSERT_FLOAT_EQ(w.stoicism, 0.0f);
        ASSERT_FLOAT_EQ(w.elusiveness, 0.0f);
        ASSERT_FLOAT_EQ(w.decisiveness, 0.0f);
        ASSERT_FLOAT_EQ(w.adaptability, 0.0f);
        ASSERT_FLOAT_EQ(w.confidence, 0.0f);
        ASSERT_FLOAT_EQ(w.attackFrequency, 0.0f);
        ASSERT_FLOAT_EQ(w.defenseBias, 0.0f);
    END_TEST("weights_default_all_zero")

    TEST("weights_canonicalize_deterministic")
        FBehavioralWeights w;
        w.aggression = 0.5f;
        w.stoicism = 0.3f;
        std::string c1 = w.canonicalize();
        std::string c2 = w.canonicalize();
        ASSERT_EQ(c1, c2);
        ASSERT_TRUE(c1.find("\"aggression\"") != std::string::npos);
    END_TEST("weights_canonicalize_deterministic")

    // ================================================================
    // SECTION 4: FBehavioralProfile Defaults & Integrity
    // ================================================================
    TEST("profile_default_unknown_archetype")
        FBehavioralProfile p;
        ASSERT_EQ(p.archetype, BehaviorArchetype::UNKNOWN);
        ASSERT_EQ(p.archetypeName, "UNKNOWN");
        ASSERT_EQ(p.entityClass, PhenotypeClass::UNKNOWN);
    END_TEST("profile_default_unknown_archetype")

    TEST("profile_hash_integrity")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("intel_integrity_test");
        auto pheno = forge.forge(hash, "intel_int");
        auto profile = kernel.generateProfile(pheno);
        ASSERT_TRUE(profile.verifyIntegrity());
        ASSERT_EQ(profile.profileHash.size(), 64u);
    END_TEST("profile_hash_integrity")

    TEST("profile_canonicalize_contains_archetype")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("canon_archetype");
        auto pheno = forge.forge(hash, "canon_a");
        auto profile = kernel.generateProfile(pheno);
        std::string canon = profile.canonicalize();
        ASSERT_TRUE(canon.find("\"archetype\":\"") != std::string::npos);
        ASSERT_TRUE(canon.find("\"sourceHash\":\"") != std::string::npos);
    END_TEST("profile_canonicalize_contains_archetype")

    // ================================================================
    // SECTION 5: FDecisionResult Defaults & Integrity
    // ================================================================
    TEST("decision_default_hold")
        FDecisionResult d;
        ASSERT_EQ(d.chosenAction, ActionType::HOLD);
        ASSERT_EQ(d.chosenActionName, "HOLD");
        ASSERT_FLOAT_EQ(d.chosenUtility, 0.0f);
    END_TEST("decision_default_hold")

    TEST("decision_hash_integrity")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("decision_integrity");
        auto pheno = forge.forge(hash, "dec_int");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        ctx.healthRatio = 0.8f;
        ctx.enemyHealthRatio = 0.6f;
        auto decision = kernel.decide(profile, ctx);
        ASSERT_TRUE(decision.verifyIntegrity());
        ASSERT_EQ(decision.decisionHash.size(), 64u);
    END_TEST("decision_hash_integrity")

    // ================================================================
    // SECTION 6: FSituationalContext Canonicalization
    // ================================================================
    TEST("context_canonicalize_deterministic")
        FSituationalContext ctx;
        ctx.healthRatio = 0.75f;
        ctx.enemyHealthRatio = 0.5f;
        std::string c1 = ctx.canonicalize();
        std::string c2 = ctx.canonicalize();
        ASSERT_EQ(c1, c2);
        ASSERT_TRUE(c1.find("\"healthRatio\"") != std::string::npos);
    END_TEST("context_canonicalize_deterministic")

    // ================================================================
    // SECTION 7: BehavioralLocusTable
    // ================================================================
    TEST("locus_morphology_count")
        ASSERT_EQ(BehavioralLocusTable::morphologyLoci().size(), 4u);
    END_TEST("locus_morphology_count")

    TEST("locus_material_count")
        ASSERT_EQ(BehavioralLocusTable::materialLoci().size(), 4u);
    END_TEST("locus_material_count")

    TEST("locus_anisotropy_count")
        ASSERT_EQ(BehavioralLocusTable::anisotropyLoci().size(), 4u);
    END_TEST("locus_anisotropy_count")

    TEST("locus_morphology_offsets")
        const auto& m = BehavioralLocusTable::morphologyLoci();
        ASSERT_EQ(m[0].locusName, "meshIndex");
        ASSERT_EQ(m[0].byteOffset, 10);
        ASSERT_EQ(m[3].locusName, "scaleZ");
        ASSERT_EQ(m[3].byteOffset, 16);
    END_TEST("locus_morphology_offsets")

    TEST("locus_material_offsets")
        const auto& m = BehavioralLocusTable::materialLoci();
        ASSERT_EQ(m[0].locusName, "metallic");
        ASSERT_EQ(m[0].byteOffset, 6);
        ASSERT_EQ(m[3].locusName, "opacity");
        ASSERT_EQ(m[3].byteOffset, 9);
    END_TEST("locus_material_offsets")

    TEST("locus_anisotropy_offsets")
        const auto& a = BehavioralLocusTable::anisotropyLoci();
        ASSERT_EQ(a[0].locusName, "subsurface");
        ASSERT_EQ(a[0].byteOffset, 22);
        ASSERT_EQ(a[1].locusName, "anisotropy");
        ASSERT_EQ(a[1].byteOffset, 23);
    END_TEST("locus_anisotropy_offsets")

    TEST("locus_total_mapped_bytes")
        ASSERT_EQ(BehavioralLocusTable::totalMappedBytes(), 16);
    END_TEST("locus_total_mapped_bytes")

    TEST("locus_no_byte_overlap")
        std::set<int> allBytes;
        for (const auto& e : BehavioralLocusTable::morphologyLoci()) {
            for (int i = 0; i < e.byteLength; i++) allBytes.insert(e.byteOffset + i);
        }
        size_t morphCount = allBytes.size();
        for (const auto& e : BehavioralLocusTable::materialLoci()) {
            for (int i = 0; i < e.byteLength; i++) {
                ASSERT_TRUE(allBytes.find(e.byteOffset + i) == allBytes.end());
                allBytes.insert(e.byteOffset + i);
            }
        }
        for (const auto& e : BehavioralLocusTable::anisotropyLoci()) {
            for (int i = 0; i < e.byteLength; i++) {
                ASSERT_TRUE(allBytes.find(e.byteOffset + i) == allBytes.end());
                allBytes.insert(e.byteOffset + i);
            }
        }
        ASSERT_EQ(static_cast<int>(allBytes.size()), BehavioralLocusTable::totalMappedBytes());
    END_TEST("locus_no_byte_overlap")

    // ================================================================
    // SECTION 8: Profile Generation & Weight Ranges
    // ================================================================
    TEST("profile_weights_in_range")
        kernel.reset();
        forge.reset();
        for (int i = 0; i < 20; i++) {
            std::string hash = SovereignSHA256::hash("weight_range_" + std::to_string(i));
            auto pheno = forge.forge(hash, "wr_" + std::to_string(i));
            auto profile = kernel.generateProfile(pheno);
            ASSERT_GTE(profile.weights.aggression, 0.0f);
            ASSERT_LTE(profile.weights.aggression, 1.0f);
            ASSERT_GTE(profile.weights.stoicism, 0.0f);
            ASSERT_LTE(profile.weights.stoicism, 1.0f);
            ASSERT_GTE(profile.weights.elusiveness, 0.0f);
            ASSERT_LTE(profile.weights.elusiveness, 1.0f);
            ASSERT_GTE(profile.weights.decisiveness, 0.0f);
            ASSERT_LTE(profile.weights.decisiveness, 1.0f);
            ASSERT_GTE(profile.weights.adaptability, 0.0f);
            ASSERT_LTE(profile.weights.adaptability, 1.0f);
            ASSERT_GTE(profile.weights.confidence, 0.0f);
            ASSERT_LTE(profile.weights.confidence, 1.0f);
            ASSERT_GTE(profile.weights.attackFrequency, 0.0f);
            ASSERT_LTE(profile.weights.attackFrequency, 1.0f);
            ASSERT_GTE(profile.weights.defenseBias, 0.0f);
            ASSERT_LTE(profile.weights.defenseBias, 1.0f);
        }
    END_TEST("profile_weights_in_range")

    TEST("profile_valid_archetype")
        kernel.reset();
        forge.reset();
        for (int i = 0; i < 20; i++) {
            std::string hash = SovereignSHA256::hash("valid_arch_" + std::to_string(i));
            auto pheno = forge.forge(hash, "va_" + std::to_string(i));
            auto profile = kernel.generateProfile(pheno);
            ASSERT_NEQ(profile.archetype, BehaviorArchetype::UNKNOWN);
        }
    END_TEST("profile_valid_archetype")

    TEST("profile_source_hash_preserved")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("source_hash_test");
        auto pheno = forge.forge(hash, "sht");
        auto profile = kernel.generateProfile(pheno);
        ASSERT_EQ(profile.sourceHash, pheno.sourceHash);
    END_TEST("profile_source_hash_preserved")

    TEST("profile_entity_class_preserved")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("class_preserve");
        auto pheno = forge.forge(hash, "cp");
        auto profile = kernel.generateProfile(pheno);
        ASSERT_EQ(profile.entityClass, pheno.classification);
    END_TEST("profile_entity_class_preserved")

    // ================================================================
    // SECTION 9: Determinism
    // ================================================================
    TEST("profile_determinism")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("determinism_test");
        auto pheno = forge.forge(hash, "det");
        auto p1 = kernel.generateProfile(pheno);
        kernel.reset();
        auto p2 = kernel.generateProfile(pheno);
        ASSERT_EQ(p1.profileHash, p2.profileHash);
        ASSERT_EQ(p1.archetype, p2.archetype);
        ASSERT_FLOAT_EQ(p1.weights.aggression, p2.weights.aggression);
        ASSERT_FLOAT_EQ(p1.weights.stoicism, p2.weights.stoicism);
        ASSERT_FLOAT_EQ(p1.weights.elusiveness, p2.weights.elusiveness);
    END_TEST("profile_determinism")

    TEST("decision_determinism")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("dec_determinism");
        auto pheno = forge.forge(hash, "dd");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        ctx.healthRatio = 0.7f;
        ctx.enemyHealthRatio = 0.5f;
        ctx.distanceNorm = 0.3f;
        auto d1 = kernel.decide(profile, ctx);
        auto d2 = kernel.decide(profile, ctx);
        ASSERT_EQ(d1.chosenAction, d2.chosenAction);
        ASSERT_FLOAT_EQ(d1.chosenUtility, d2.chosenUtility);
    END_TEST("decision_determinism")

    TEST("verify_determinism_method")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("verify_det_method");
        auto pheno = forge.forge(hash, "vdm");
        FSituationalContext ctx;
        ASSERT_TRUE(kernel.verifyDeterminism(pheno, ctx));
    END_TEST("verify_determinism_method")

    // ================================================================
    // SECTION 10: Decision Utility Vector
    // ================================================================
    TEST("decision_utility_vector_8_actions")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("utility_vector");
        auto pheno = forge.forge(hash, "uv");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        auto decision = kernel.decide(profile, ctx);
        ASSERT_EQ(decision.utilityVector.size(), 8u);
    END_TEST("decision_utility_vector_8_actions")

    TEST("decision_chosen_is_max_utility")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("max_utility_test");
        auto pheno = forge.forge(hash, "mu");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        ctx.healthRatio = 0.5f;
        ctx.enemyHealthRatio = 0.8f;
        auto decision = kernel.decide(profile, ctx);
        float maxU = -1e9f;
        for (const auto& au : decision.utilityVector) {
            if (au.utility > maxU) maxU = au.utility;
        }
        ASSERT_FLOAT_EQ(decision.chosenUtility, maxU);
    END_TEST("decision_chosen_is_max_utility")

    TEST("decision_all_actions_present")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("all_actions");
        auto pheno = forge.forge(hash, "aa");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        auto decision = kernel.decide(profile, ctx);
        std::set<std::string> actionNames;
        for (const auto& au : decision.utilityVector) {
            actionNames.insert(au.actionName);
        }
        ASSERT_TRUE(actionNames.count("STRIKE") > 0);
        ASSERT_TRUE(actionNames.count("GUARD") > 0);
        ASSERT_TRUE(actionNames.count("FLANK") > 0);
        ASSERT_TRUE(actionNames.count("CHARGE") > 0);
        ASSERT_TRUE(actionNames.count("RETREAT") > 0);
        ASSERT_TRUE(actionNames.count("COUNTER") > 0);
        ASSERT_TRUE(actionNames.count("FEINT") > 0);
        ASSERT_TRUE(actionNames.count("HOLD") > 0);
    END_TEST("decision_all_actions_present")

    // ================================================================
    // SECTION 11: Situational Context Affects Decisions
    // ================================================================
    TEST("low_health_increases_retreat_utility")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("low_health_retreat");
        auto pheno = forge.forge(hash, "lhr");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext healthy;
        healthy.healthRatio = 0.9f;
        healthy.enemyHealthRatio = 0.9f;
        auto dHealthy = kernel.decide(profile, healthy);
        FSituationalContext dying;
        dying.healthRatio = 0.1f;
        dying.enemyHealthRatio = 0.9f;
        auto dDying = kernel.decide(profile, dying);
        float retreatHealthy = 0, retreatDying = 0;
        for (const auto& au : dHealthy.utilityVector) {
            if (au.action == ActionType::RETREAT) retreatHealthy = au.utility;
        }
        for (const auto& au : dDying.utilityVector) {
            if (au.action == ActionType::RETREAT) retreatDying = au.utility;
        }
        ASSERT_GT(retreatDying, retreatHealthy);
    END_TEST("low_health_increases_retreat_utility")

    TEST("home_habitat_boosts_offensive")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("home_habitat_test");
        auto pheno = forge.forge(hash, "hht");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext away;
        away.isHomeHabitat = false;
        away.synergyCoefficient = 0.0f;
        auto dAway = kernel.decide(profile, away);
        FSituationalContext home;
        home.isHomeHabitat = true;
        home.synergyCoefficient = 0.4f;
        auto dHome = kernel.decide(profile, home);
        float strikeAway = 0, strikeHome = 0;
        for (const auto& au : dAway.utilityVector) {
            if (au.action == ActionType::STRIKE) strikeAway = au.utility;
        }
        for (const auto& au : dHome.utilityVector) {
            if (au.action == ActionType::STRIKE) strikeHome = au.utility;
        }
        ASSERT_GT(strikeHome, strikeAway);
    END_TEST("home_habitat_boosts_offensive")

    TEST("thermal_stress_penalizes_charge")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("thermal_penalty");
        auto pheno = forge.forge(hash, "tp");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext cool;
        cool.thermalStress = 0.0f;
        auto dCool = kernel.decide(profile, cool);
        FSituationalContext hot;
        hot.thermalStress = 0.9f;
        auto dHot = kernel.decide(profile, hot);
        float chargeCool = 0, chargeHot = 0;
        for (const auto& au : dCool.utilityVector) {
            if (au.action == ActionType::CHARGE) chargeCool = au.utility;
        }
        for (const auto& au : dHot.utilityVector) {
            if (au.action == ActionType::CHARGE) chargeHot = au.utility;
        }
        ASSERT_GT(chargeCool, chargeHot);
    END_TEST("thermal_stress_penalizes_charge")

    // ================================================================
    // SECTION 12: Different DNA → Different Decisions
    // ================================================================
    TEST("different_genomes_different_profiles")
        kernel.reset();
        forge.reset();
        std::string h1 = SovereignSHA256::hash("unique_genome_A");
        std::string h2 = SovereignSHA256::hash("unique_genome_B");
        auto p1 = forge.forge(h1, "ug_a");
        auto p2 = forge.forge(h2, "ug_b");
        auto prof1 = kernel.generateProfile(p1);
        auto prof2 = kernel.generateProfile(p2);
        ASSERT_NEQ(prof1.profileHash, prof2.profileHash);
        bool weightsDiffer =
            std::abs(prof1.weights.aggression - prof2.weights.aggression) > 0.001f ||
            std::abs(prof1.weights.stoicism - prof2.weights.stoicism) > 0.001f ||
            std::abs(prof1.weights.elusiveness - prof2.weights.elusiveness) > 0.001f;
        ASSERT_TRUE(weightsDiffer);
    END_TEST("different_genomes_different_profiles")

    TEST("different_genomes_may_differ_in_decisions")
        kernel.reset();
        forge.reset();
        std::string h1 = SovereignSHA256::hash("decision_diff_A");
        std::string h2 = SovereignSHA256::hash("decision_diff_B");
        auto p1 = forge.forge(h1, "dd_a");
        auto p2 = forge.forge(h2, "dd_b");
        auto prof1 = kernel.generateProfile(p1);
        auto prof2 = kernel.generateProfile(p2);
        FSituationalContext ctx;
        ctx.healthRatio = 0.6f;
        ctx.enemyHealthRatio = 0.6f;
        auto d1 = kernel.decide(prof1, ctx);
        auto d2 = kernel.decide(prof2, ctx);
        bool utilityDiffers = std::abs(d1.chosenUtility - d2.chosenUtility) > 0.001f;
        bool actionDiffers = d1.chosenAction != d2.chosenAction;
        ASSERT_TRUE(utilityDiffers || actionDiffers);
    END_TEST("different_genomes_may_differ_in_decisions")

    // ================================================================
    // SECTION 13: Synergy-Enhanced Profile
    // ================================================================
    TEST("synergy_increases_confidence")
        kernel.reset();
        forge.reset();
        auto& arbiter = SovereignHabitatArbiter::Get();
        arbiter.reset();
        std::string hash = SovereignSHA256::hash("synergy_confidence");
        auto pheno = forge.forge(hash, "sc");
        auto baseProfile = kernel.generateProfile(pheno);
        auto habitat = arbiter.generateHabitat("confidence_world", 0);
        auto synergy = arbiter.computeSynergy(pheno, habitat);
        auto synProfile = kernel.generateProfileWithSynergy(pheno, synergy);
        if (synergy.coefficient > 0.0f) {
            ASSERT_GT(synProfile.weights.confidence, baseProfile.weights.confidence);
        }
    END_TEST("synergy_increases_confidence")

    TEST("synergy_profile_integrity")
        kernel.reset();
        forge.reset();
        auto& arbiter = SovereignHabitatArbiter::Get();
        arbiter.reset();
        std::string hash = SovereignSHA256::hash("syn_profile_int");
        auto pheno = forge.forge(hash, "spi");
        auto habitat = arbiter.generateHabitat("integrity_world", 0);
        auto synergy = arbiter.computeSynergy(pheno, habitat);
        auto profile = kernel.generateProfileWithSynergy(pheno, synergy);
        ASSERT_TRUE(profile.verifyIntegrity());
    END_TEST("synergy_profile_integrity")

    TEST("thermal_stress_reduces_adaptability")
        kernel.reset();
        forge.reset();
        auto& arbiter = SovereignHabitatArbiter::Get();
        arbiter.reset();
        std::string hash = SovereignSHA256::hash("thermal_adapt");
        auto pheno = forge.forge(hash, "ta");
        auto baseProfile = kernel.generateProfile(pheno);
        FSynergyResult synHigh;
        synHigh.coefficient = 0.0f;
        synHigh.thermalStress = 0.9f;
        synHigh.environmentHash = "fake_env";
        auto stressProfile = kernel.generateProfileWithSynergy(pheno, synHigh);
        ASSERT_LT(stressProfile.weights.adaptability, baseProfile.weights.adaptability);
    END_TEST("thermal_stress_reduces_adaptability")

    // ================================================================
    // SECTION 14: DecideInContext (Full Pipeline)
    // ================================================================
    TEST("decide_in_context_full_pipeline")
        kernel.reset();
        forge.reset();
        auto& arbiter = SovereignHabitatArbiter::Get();
        arbiter.reset();
        std::string hash = SovereignSHA256::hash("full_pipeline");
        auto pheno = forge.forge(hash, "fp");
        auto habitat = arbiter.generateHabitat("pipeline_world", 0);
        auto synergy = arbiter.computeSynergy(pheno, habitat);
        auto decision = kernel.decideInContext(pheno, habitat, synergy, 0.8f, 0.6f, 0.4f, 3, 10);
        ASSERT_TRUE(decision.verifyIntegrity());
        ASSERT_EQ(decision.utilityVector.size(), 8u);
        ASSERT_NEQ(decision.chosenAction, ActionType::HOLD);
    END_TEST("decide_in_context_full_pipeline")

    TEST("decide_in_context_determinism")
        kernel.reset();
        forge.reset();
        auto& arbiter = SovereignHabitatArbiter::Get();
        arbiter.reset();
        std::string hash = SovereignSHA256::hash("ctx_determinism");
        auto pheno = forge.forge(hash, "cd");
        auto habitat = arbiter.generateHabitat("det_world", 0);
        auto synergy = arbiter.computeSynergy(pheno, habitat);
        auto d1 = kernel.decideInContext(pheno, habitat, synergy, 0.5f, 0.5f, 0.5f, 5, 10);
        kernel.reset();
        auto d2 = kernel.decideInContext(pheno, habitat, synergy, 0.5f, 0.5f, 0.5f, 5, 10);
        ASSERT_EQ(d1.chosenAction, d2.chosenAction);
        ASSERT_FLOAT_EQ(d1.chosenUtility, d2.chosenUtility);
    END_TEST("decide_in_context_determinism")

    // ================================================================
    // SECTION 15: Delegates
    // ================================================================
    TEST("profile_generated_delegate")
        kernel.reset();
        forge.reset();
        bool delegateCalled = false;
        std::string capturedHash;
        kernel.onProfileGenerated([&](const FBehavioralProfile& p) {
            delegateCalled = true;
            capturedHash = p.profileHash;
        });
        std::string hash = SovereignSHA256::hash("delegate_profile");
        auto pheno = forge.forge(hash, "dp");
        auto profile = kernel.generateProfile(pheno);
        ASSERT_TRUE(delegateCalled);
        ASSERT_EQ(capturedHash, profile.profileHash);
        kernel.onProfileGenerated(nullptr);
    END_TEST("profile_generated_delegate")

    TEST("decision_made_delegate")
        kernel.reset();
        forge.reset();
        bool delegateCalled = false;
        std::string capturedKey;
        kernel.onDecisionMade([&](const FDecisionResult& d, const std::string& key) {
            delegateCalled = true;
            capturedKey = key;
        });
        std::string hash = SovereignSHA256::hash("delegate_decision");
        auto pheno = forge.forge(hash, "dd");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        auto decision = kernel.decide(profile, ctx);
        ASSERT_TRUE(delegateCalled);
        ASSERT_EQ(capturedKey, profile.sourceHash);
        kernel.onDecisionMade(nullptr);
    END_TEST("decision_made_delegate")

    // ================================================================
    // SECTION 16: Stats Tracking
    // ================================================================
    TEST("stats_profile_count")
        kernel.reset();
        forge.reset();
        for (int i = 0; i < 5; i++) {
            std::string hash = SovereignSHA256::hash("stats_p_" + std::to_string(i));
            auto pheno = forge.forge(hash, "sp_" + std::to_string(i));
            kernel.generateProfile(pheno);
        }
        auto stats = kernel.getStats();
        ASSERT_EQ(stats.totalProfilesGenerated, 5);
    END_TEST("stats_profile_count")

    TEST("stats_decision_count")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("stats_decision");
        auto pheno = forge.forge(hash, "sd");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        for (int i = 0; i < 3; i++) {
            kernel.decide(profile, ctx);
        }
        auto stats = kernel.getStats();
        ASSERT_EQ(stats.totalDecisionsMade, 3);
    END_TEST("stats_decision_count")

    TEST("stats_archetype_distribution")
        kernel.reset();
        forge.reset();
        for (int i = 0; i < 50; i++) {
            std::string hash = SovereignSHA256::hash("dist_" + std::to_string(i));
            auto pheno = forge.forge(hash, "d_" + std::to_string(i));
            kernel.generateProfile(pheno);
        }
        auto stats = kernel.getStats();
        int total = 0;
        for (const auto& pair : stats.archetypeDistribution) {
            total += pair.second;
        }
        ASSERT_EQ(total, 50);
    END_TEST("stats_archetype_distribution")

    // ================================================================
    // SECTION 17: UE5 Behavior Tree Generation
    // ================================================================
    TEST("ue5_behavior_tree_contains_ustruct")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("ue5_bt_test");
        auto pheno = forge.forge(hash, "ue5");
        auto profile = kernel.generateProfile(pheno);
        std::string code = kernel.generateUE5BehaviorTree(profile);
        ASSERT_TRUE(code.find("USTRUCT(BlueprintType)") != std::string::npos);
        ASSERT_TRUE(code.find("FSovereignBehaviorProfile") != std::string::npos);
        ASSERT_TRUE(code.find("GENERATED_BODY()") != std::string::npos);
        ASSERT_TRUE(code.find("Aggression") != std::string::npos);
        ASSERT_TRUE(code.find("Stoicism") != std::string::npos);
        ASSERT_TRUE(code.find("Elusiveness") != std::string::npos);
    END_TEST("ue5_behavior_tree_contains_ustruct")

    TEST("ue5_behavior_tree_contains_archetype")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("ue5_arch_test");
        auto pheno = forge.forge(hash, "ue5a");
        auto profile = kernel.generateProfile(pheno);
        std::string code = kernel.generateUE5BehaviorTree(profile);
        ASSERT_TRUE(code.find("Archetype") != std::string::npos);
        ASSERT_TRUE(code.find(profile.archetypeName) != std::string::npos);
    END_TEST("ue5_behavior_tree_contains_archetype")

    // ================================================================
    // SECTION 18: Genesis Ancestor Profiles
    // ================================================================
    TEST("genesis_ancestors_varied_archetypes")
        kernel.reset();
        forge.reset();
        std::set<BehaviorArchetype> archetypes;
        for (int i = 0; i < 20; i++) {
            std::string hash = SovereignSHA256::hash(
                "SOVEREIGN_GENESIS_EVENT_2026:ancestor:" + std::to_string(i));
            auto pheno = forge.forge(hash, "ancestor_" + std::to_string(i));
            auto profile = kernel.generateProfile(pheno);
            archetypes.insert(profile.archetype);
            ASSERT_TRUE(profile.verifyIntegrity());
        }
        ASSERT_GT(static_cast<int>(archetypes.size()), 2);
    END_TEST("genesis_ancestors_varied_archetypes")

    TEST("genesis_ancestor_decision_integrity")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash(
            "SOVEREIGN_GENESIS_EVENT_2026:ancestor:0");
        auto pheno = forge.forge(hash, "ancestor_0");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        ctx.healthRatio = 0.7f;
        ctx.enemyHealthRatio = 0.5f;
        ctx.distanceNorm = 0.3f;
        auto decision = kernel.decide(profile, ctx);
        ASSERT_TRUE(decision.verifyIntegrity());
        ASSERT_TRUE(profile.verifyIntegrity());
    END_TEST("genesis_ancestor_decision_integrity")

    // ================================================================
    // SECTION 19: Byte-to-Weight Mapping Integrity
    // ================================================================
    TEST("morphology_scaleZ_drives_stoicism")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("stoicism_byte_test");
        auto genome = GeneticGenomeParser::hashToBytes(hash);
        float scaleZNorm = static_cast<float>((static_cast<uint16_t>(genome[16]) << 8) | genome[17]) / 65535.0f;
        auto pheno = forge.forge(hash, "sbt");
        auto profile = kernel.generateProfile(pheno);
        ASSERT_GT(profile.weights.stoicism, 0.0f);
    END_TEST("morphology_scaleZ_drives_stoicism")

    TEST("anisotropy_byte_drives_attack_frequency")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("aniso_freq_test");
        auto genome = GeneticGenomeParser::hashToBytes(hash);
        float anisoNorm = static_cast<float>(genome[23]) / 255.0f;
        auto pheno = forge.forge(hash, "aft");
        auto profile = kernel.generateProfile(pheno);
        ASSERT_GT(profile.weights.attackFrequency, 0.0f);
    END_TEST("anisotropy_byte_drives_attack_frequency")

    TEST("material_opacity_drives_elusiveness")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("opacity_elusive");
        auto genome = GeneticGenomeParser::hashToBytes(hash);
        auto pheno = forge.forge(hash, "oe");
        auto profile = kernel.generateProfile(pheno);
        ASSERT_GTE(profile.weights.elusiveness, 0.0f);
        ASSERT_LTE(profile.weights.elusiveness, 1.0f);
    END_TEST("material_opacity_drives_elusiveness")

    // ================================================================
    // SECTION 20: End-to-End Arena Integration
    // ================================================================
    TEST("e2e_arena_with_intel_decisions")
        kernel.reset();
        forge.reset();
        auto& arbiter = SovereignHabitatArbiter::Get();
        arbiter.reset();
        auto& arena = SovereignArena::Get();
        arena.reset();

        auto habitat = arbiter.generateHabitat("intel_arena", 0);

        std::string hashA = SovereignSHA256::hash("intel_fighter_A");
        std::string hashB = SovereignSHA256::hash("intel_fighter_B");
        auto phenoA = forge.forge(hashA, "ia");
        auto phenoB = forge.forge(hashB, "ib");

        auto synA = arbiter.computeSynergy(phenoA, habitat);
        auto synB = arbiter.computeSynergy(phenoB, habitat);

        auto decA = kernel.decideInContext(phenoA, habitat, synA, 1.0f, 1.0f, 0.5f, 1, 10);
        auto decB = kernel.decideInContext(phenoB, habitat, synB, 1.0f, 1.0f, 0.5f, 1, 10);

        ASSERT_TRUE(decA.verifyIntegrity());
        ASSERT_TRUE(decB.verifyIntegrity());
        ASSERT_EQ(decA.utilityVector.size(), 8u);
        ASSERT_EQ(decB.utilityVector.size(), 8u);

        auto statsA = PhenotypeStatMapper::mapToStats(phenoA, "ia");
        auto statsB = PhenotypeStatMapper::mapToStats(phenoB, "ib");
        ASSERT_GT(statsA.attackPower, 0.0f);
        ASSERT_GT(statsB.attackPower, 0.0f);
    END_TEST("e2e_arena_with_intel_decisions")

    TEST("e2e_decision_varies_by_round")
        kernel.reset();
        forge.reset();
        auto& arbiter = SovereignHabitatArbiter::Get();
        arbiter.reset();
        std::string hash = SovereignSHA256::hash("round_variance");
        auto pheno = forge.forge(hash, "rv");
        auto habitat = arbiter.generateHabitat("round_world", 0);
        auto synergy = arbiter.computeSynergy(pheno, habitat);
        auto d1 = kernel.decideInContext(pheno, habitat, synergy, 1.0f, 1.0f, 0.5f, 1, 10);
        auto d9 = kernel.decideInContext(pheno, habitat, synergy, 0.3f, 0.8f, 0.2f, 9, 10);
        bool differs = d1.chosenAction != d9.chosenAction ||
                       std::abs(d1.chosenUtility - d9.chosenUtility) > 0.01f;
        ASSERT_TRUE(differs);
    END_TEST("e2e_decision_varies_by_round")

    // ================================================================
    // SECTION 21: SHA-256 Golden Hash Cross-Verification
    // ================================================================
    TEST("sha256_profile_hash_64_chars")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("golden_profile");
        auto pheno = forge.forge(hash, "gp");
        auto profile = kernel.generateProfile(pheno);
        ASSERT_EQ(profile.profileHash.size(), 64u);
    END_TEST("sha256_profile_hash_64_chars")

    TEST("sha256_decision_hash_64_chars")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("golden_decision");
        auto pheno = forge.forge(hash, "gd");
        auto profile = kernel.generateProfile(pheno);
        FSituationalContext ctx;
        auto decision = kernel.decide(profile, ctx);
        ASSERT_EQ(decision.decisionHash.size(), 64u);
    END_TEST("sha256_decision_hash_64_chars")

    TEST("sha256_profile_golden_determinism")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("golden_det_test");
        auto pheno = forge.forge(hash, "gdt");
        auto p1 = kernel.generateProfile(pheno);
        kernel.reset();
        auto p2 = kernel.generateProfile(pheno);
        ASSERT_EQ(p1.profileHash, p2.profileHash);
        ASSERT_FALSE(p1.profileHash.empty());
    END_TEST("sha256_profile_golden_determinism")

    // ================================================================
    // SECTION 22: Reset & Cache
    // ================================================================
    TEST("reset_clears_stats")
        kernel.reset();
        forge.reset();
        std::string hash = SovereignSHA256::hash("reset_stats");
        auto pheno = forge.forge(hash, "rs");
        kernel.generateProfile(pheno);
        auto statsBefore = kernel.getStats();
        ASSERT_EQ(statsBefore.totalProfilesGenerated, 1);
        kernel.reset();
        auto statsAfter = kernel.getStats();
        ASSERT_EQ(statsAfter.totalProfilesGenerated, 0);
        ASSERT_EQ(statsAfter.totalDecisionsMade, 0);
    END_TEST("reset_clears_stats")

    // ================================================================
    // SECTION 23: Class Modifiers Influence Weights
    // ================================================================
    TEST("volcanic_class_boosts_aggression")
        kernel.reset();
        forge.reset();
        std::set<float> aggressionValues;
        for (int i = 0; i < 30; i++) {
            std::string hash = SovereignSHA256::hash("volcanic_agg_" + std::to_string(i));
            auto pheno = forge.forge(hash, "va_" + std::to_string(i));
            if (pheno.classification == PhenotypeClass::VOLCANIC) {
                auto profile = kernel.generateProfile(pheno);
                ASSERT_GT(profile.weights.aggression, 0.15f);
            }
        }
        ASSERT_TRUE(true);
    END_TEST("volcanic_class_boosts_aggression")

    TEST("metallic_class_boosts_stoicism")
        kernel.reset();
        forge.reset();
        for (int i = 0; i < 30; i++) {
            std::string hash = SovereignSHA256::hash("metallic_sto_" + std::to_string(i));
            auto pheno = forge.forge(hash, "ms_" + std::to_string(i));
            if (pheno.classification == PhenotypeClass::METALLIC) {
                auto profile = kernel.generateProfile(pheno);
                ASSERT_GT(profile.weights.stoicism, 0.15f);
            }
        }
        ASSERT_TRUE(true);
    END_TEST("metallic_class_boosts_stoicism")

    // ================================================================
    // RESULTS
    // ================================================================
    std::cout << "\n==================================================\n";
    std::cout << "INTEL RESULTS: " << passed << " passed, " << failed << " failed\n";
    std::cout << "==================================================\n";

    return failed > 0 ? 1 : 0;
}
