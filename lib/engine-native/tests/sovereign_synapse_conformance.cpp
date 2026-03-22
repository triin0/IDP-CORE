#include "../generated/SovereignSynapse.h"
#include <iostream>
#include <cassert>
#include <set>
#include <cstring>
#include <algorithm>
#include <cmath>
#include <thread>
#include <chrono>

using namespace Sovereign;

static int passCount = 0;
static int failCount = 0;

#define TEST(name) { const char* testName = name; try {
#define END_TEST(name) std::cout << "  PASS: " << testName << std::endl; passCount++; } catch (...) { std::cout << "  FAIL: " << testName << std::endl; failCount++; } }
#define ASSERT_TRUE(expr) if (!(expr)) { std::cout << "ASSERT_TRUE failed: " #expr " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }
#define ASSERT_FALSE(expr) if ((expr)) { std::cout << "ASSERT_FALSE failed: " #expr " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }
#define ASSERT_EQ(a, b) if ((a) != (b)) { std::cout << "ASSERT_EQ failed: " #a " != " #b " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }

static const std::string TEST_HASH = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

static FSovereignPassport makeTestPassport() {
    auto phenotype = BiologicalForge::Get().forge(TEST_HASH, "synapse_test");
    auto profile = SovereignIntelKernel::Get().generateProfile(phenotype);
    auto habitat = SovereignHabitatArbiter::Get().generateHabitat("SYNAPSE_WORLD");
    auto synergy = SovereignHabitatArbiter::Get().computeSynergy(phenotype, habitat);
    return SovereignPassportAuthority::Get().issuePassport(phenotype, profile, habitat, synergy, "synapse_test_entity");
}

int main() {
    std::cout << "============================================================" << std::endl;
    std::cout << "  SOVEREIGN SYNAPSE CONFORMANCE TESTS (Module 17)" << std::endl;
    std::cout << "============================================================\n" << std::endl;

    auto passport = makeTestPassport();
    auto& synapse = SovereignSynapse::Get();
    synapse.resetStats();

    std::cout << "=== Intent Category Enum Tests ===" << std::endl;

    TEST("intent_category_strings")
        ASSERT_EQ(intentCategoryToString(IntentCategory::COMBAT), "COMBAT");
        ASSERT_EQ(intentCategoryToString(IntentCategory::TRADE), "TRADE");
        ASSERT_EQ(intentCategoryToString(IntentCategory::MOVEMENT), "MOVEMENT");
        ASSERT_EQ(intentCategoryToString(IntentCategory::QUERY), "QUERY");
        ASSERT_EQ(intentCategoryToString(IntentCategory::CONFIGURATION), "CONFIGURATION");
        ASSERT_EQ(intentCategoryToString(IntentCategory::SOCIAL), "SOCIAL");
        ASSERT_EQ(intentCategoryToString(IntentCategory::SYSTEM), "SYSTEM");
        ASSERT_EQ(intentCategoryToString(IntentCategory::UNKNOWN), "UNKNOWN");
    END_TEST("intent_category_strings")

    TEST("validation_result_strings")
        ASSERT_EQ(validationResultToString(ValidationResult::APPROVED), "APPROVED");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_BOUNDARY_VIOLATION), "REJECTED_BOUNDARY_VIOLATION");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_LIQUIDITY_EXCEEDED), "REJECTED_LIQUIDITY_EXCEEDED");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_OWNERSHIP_LOCKED), "REJECTED_OWNERSHIP_LOCKED");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_COOLDOWN_ACTIVE), "REJECTED_COOLDOWN_ACTIVE");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_INVALID_TARGET), "REJECTED_INVALID_TARGET");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_SANITIZATION_FAILED), "REJECTED_SANITIZATION_FAILED");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_INTEGRITY_FAILURE), "REJECTED_INTEGRITY_FAILURE");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_EMPTY_INTENT), "REJECTED_EMPTY_INTENT");
        ASSERT_EQ(validationResultToString(ValidationResult::REJECTED_MALFORMED_INTENT), "REJECTED_MALFORMED_INTENT");
    END_TEST("validation_result_strings")

    std::cout << "\n=== Intent Sanitization Tests ===" << std::endl;

    TEST("sanitize_empty_intent")
        auto result = synapse.sanitizeIntent("");
        ASSERT_FALSE(result.isValid);
        ASSERT_EQ(result.totalTokens, 0);
    END_TEST("sanitize_empty_intent")

    TEST("sanitize_pure_slop")
        auto result = synapse.sanitizeIntent("I would love to help you certainly do this for you");
        ASSERT_FALSE(result.isValid);
        ASSERT_TRUE(result.slopRatio > 0.8f);
    END_TEST("sanitize_pure_slop")

    TEST("sanitize_combat_verb_strike")
        auto result = synapse.sanitizeIntent("strike the enemy hard");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "strike");
        ASSERT_TRUE(result.sanitizedAction.find("STRIKE_ACTION") != std::string::npos);
    END_TEST("sanitize_combat_verb_strike")

    TEST("sanitize_combat_verb_guard")
        auto result = synapse.sanitizeIntent("guard against the next blow");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "guard");
        ASSERT_TRUE(result.sanitizedAction.find("GUARD_ACTION") != std::string::npos);
    END_TEST("sanitize_combat_verb_guard")

    TEST("sanitize_combat_verb_charge")
        auto result = synapse.sanitizeIntent("charge forward now");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "charge");
    END_TEST("sanitize_combat_verb_charge")

    TEST("sanitize_combat_verb_counter")
        auto result = synapse.sanitizeIntent("counter the attack immediately");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "counter");
    END_TEST("sanitize_combat_verb_counter")

    TEST("sanitize_combat_verb_feint")
        auto result = synapse.sanitizeIntent("feint left then strike");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "feint");
    END_TEST("sanitize_combat_verb_feint")

    TEST("sanitize_combat_verb_retreat")
        auto result = synapse.sanitizeIntent("retreat to safety now");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "retreat");
    END_TEST("sanitize_combat_verb_retreat")

    TEST("sanitize_combat_verb_hold")
        auto result = synapse.sanitizeIntent("hold position");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "hold");
    END_TEST("sanitize_combat_verb_hold")

    TEST("sanitize_trade_verb_buy")
        auto result = synapse.sanitizeIntent("buy suspension upgrade 5000");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "buy");
        ASSERT_TRUE(result.extractedAmount > 0.0f);
    END_TEST("sanitize_trade_verb_buy")

    TEST("sanitize_trade_with_dollar_sign")
        auto result = synapse.sanitizeIntent("bid $50,000 on car");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "bid");
        ASSERT_TRUE(std::abs(result.extractedAmount - 50000.0f) < 1.0f);
    END_TEST("sanitize_trade_with_dollar_sign")

    TEST("sanitize_sloppy_trade")
        auto result = synapse.sanitizeIntent("I'd love to help you buy this car, let me set your bid to $50,000");
        ASSERT_TRUE(result.isValid);
        ASSERT_TRUE(result.slopTokensStripped > 5);
        ASSERT_TRUE(result.sanitizedAction.find("BID_ACTION") != std::string::npos || result.sanitizedAction.find("BUY_ACTION") != std::string::npos);
        ASSERT_TRUE(std::abs(result.extractedAmount - 50000.0f) < 1.0f);
    END_TEST("sanitize_sloppy_trade")

    TEST("sanitize_movement_verb")
        auto result = synapse.sanitizeIntent("move north quickly");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "move");
    END_TEST("sanitize_movement_verb")

    TEST("sanitize_query_verb")
        auto result = synapse.sanitizeIntent("inspect inventory");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "inspect");
    END_TEST("sanitize_query_verb")

    TEST("sanitize_configuration_verb")
        auto result = synapse.sanitizeIntent("adjust suspension stiffness 0.75");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "adjust");
        ASSERT_TRUE(result.extractedAmount > 0.0f);
    END_TEST("sanitize_configuration_verb")

    TEST("sanitize_social_verb")
        auto result = synapse.sanitizeIntent("wave greeting emote");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "wave");
    END_TEST("sanitize_social_verb")

    TEST("sanitize_slop_ratio_calculation")
        auto result = synapse.sanitizeIntent("I would really love to absolutely definitely strike");
        ASSERT_TRUE(result.isValid);
        ASSERT_TRUE(result.slopRatio > 0.0f);
        ASSERT_TRUE(result.slopRatio < 1.0f);
        ASSERT_TRUE(result.slopTokensStripped > 0);
    END_TEST("sanitize_slop_ratio_calculation")

    TEST("sanitize_target_extraction")
        auto result = synapse.sanitizeIntent("strike dragon fiercely");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "strike");
        ASSERT_EQ(result.extractedTarget, "dragon");
    END_TEST("sanitize_target_extraction")

    TEST("sanitize_canonicalize")
        auto result = synapse.sanitizeIntent("strike enemy 100");
        std::string c = result.canonicalize();
        ASSERT_TRUE(c.find("extractedVerb") != std::string::npos);
        ASSERT_TRUE(c.find("sanitizedAction") != std::string::npos);
        ASSERT_TRUE(c.find("slopRatio") != std::string::npos);
    END_TEST("sanitize_canonicalize")

    std::cout << "\n=== Action Struct Tests ===" << std::endl;

    TEST("action_struct_combat")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        ASSERT_EQ(action.actionTypeName, "STRIKE");
        ASSERT_EQ(action.categoryName, "COMBAT");
        ASSERT_TRUE(action.verifyIntegrity());
    END_TEST("action_struct_combat")

    TEST("action_struct_trade")
        auto san = synapse.sanitizeIntent("buy car 5000");
        auto action = synapse.buildActionStruct(san, passport.genomeHash, "target_hash");
        ASSERT_EQ(action.categoryName, "TRADE");
        ASSERT_TRUE(action.amountCredits > 0.0f);
        ASSERT_TRUE(action.verifyIntegrity());
    END_TEST("action_struct_trade")

    TEST("action_struct_movement")
        auto san = synapse.sanitizeIntent("move north");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        ASSERT_EQ(action.categoryName, "MOVEMENT");
    END_TEST("action_struct_movement")

    TEST("action_struct_hash_integrity")
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        ASSERT_TRUE(action.verifyIntegrity());
        ASSERT_EQ(action.actionHash.size(), static_cast<size_t>(64));
    END_TEST("action_struct_hash_integrity")

    TEST("action_struct_tamper_detection")
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        ASSERT_TRUE(action.verifyIntegrity());
        action.amountCredits = 999999.0f;
        ASSERT_FALSE(action.verifyIntegrity());
    END_TEST("action_struct_tamper_detection")

    TEST("action_struct_canonicalize")
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        std::string c = action.canonicalize();
        ASSERT_TRUE(c.find("actionType") != std::string::npos);
        ASSERT_TRUE(c.find("category") != std::string::npos);
        ASSERT_TRUE(c.find("sourceEntityHash") != std::string::npos);
    END_TEST("action_struct_canonicalize")

    std::cout << "\n=== Validation Tests (Pass 50 — Reality Check) ===" << std::endl;

    TEST("validate_approved_combat")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        auto report = synapse.validateAction(action, passport);
        ASSERT_TRUE(report.isApproved());
        ASSERT_EQ(report.resultName, "APPROVED");
        ASSERT_TRUE(report.passesChecked >= 10);
        ASSERT_EQ(report.violationsFound, 0);
    END_TEST("validate_approved_combat")

    TEST("validate_empty_intent_rejected")
        synapse.clearCooldowns();
        FSovereignActionStruct action;
        action.rawIntent = "";
        action.sourceEntityHash = passport.genomeHash;
        action.updateHash();
        auto report = synapse.validateAction(action, passport);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_EMPTY_INTENT);
    END_TEST("validate_empty_intent_rejected")

    TEST("validate_boundary_violation")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        action.positionX = 99999.0f;
        action.positionY = 99999.0f;
        action.positionZ = 99999.0f;
        action.updateHash();
        auto report = synapse.validateAction(action, passport);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_BOUNDARY_VIOLATION);
    END_TEST("validate_boundary_violation")

    TEST("validate_liquidity_exceeded_max")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("buy car 9999999");
        auto action = synapse.buildActionStruct(san, passport.genomeHash, "target_hash");
        action.category = IntentCategory::TRADE;
        action.categoryName = "TRADE";
        action.amountCredits = 9999999.0f;
        action.updateHash();
        FSynapseConstraints constraints;
        constraints.maxBidCredits = 1000000.0f;
        auto report = synapse.validateAction(action, passport, constraints);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_LIQUIDITY_EXCEEDED);
    END_TEST("validate_liquidity_exceeded_max")

    TEST("validate_liquidity_below_minimum")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("buy car 0.001");
        auto action = synapse.buildActionStruct(san, passport.genomeHash, "target_hash");
        action.category = IntentCategory::TRADE;
        action.categoryName = "TRADE";
        action.amountCredits = 0.001f;
        action.updateHash();
        FSynapseConstraints constraints;
        constraints.minBidCredits = 0.01f;
        auto report = synapse.validateAction(action, passport, constraints);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_LIQUIDITY_EXCEEDED);
    END_TEST("validate_liquidity_below_minimum")

    TEST("validate_intensity_exceeded")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        action.intensity = 50.0f;
        action.updateHash();
        auto report = synapse.validateAction(action, passport);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_BOUNDARY_VIOLATION);
    END_TEST("validate_intensity_exceeded")

    TEST("validate_empty_source_entity")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, "");
        auto report = synapse.validateAction(action, passport);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_INVALID_TARGET);
    END_TEST("validate_empty_source_entity")

    TEST("validate_trade_without_target")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("buy car 5000");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        action.category = IntentCategory::TRADE;
        action.categoryName = "TRADE";
        action.targetEntityHash = "";
        action.updateHash();
        auto report = synapse.validateAction(action, passport);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_INVALID_TARGET);
    END_TEST("validate_trade_without_target")

    TEST("validate_tampered_action_hash")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        action.actionHash = "TAMPERED_HASH";
        auto report = synapse.validateAction(action, passport);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_INTEGRITY_FAILURE);
    END_TEST("validate_tampered_action_hash")

    TEST("validate_report_hash_integrity")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        auto report = synapse.validateAction(action, passport);
        ASSERT_TRUE(report.verifyIntegrity());
        ASSERT_EQ(report.validatorHash.size(), static_cast<size_t>(64));
    END_TEST("validate_report_hash_integrity")

    TEST("validate_report_tamper_detection")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        auto report = synapse.validateAction(action, passport);
        ASSERT_TRUE(report.verifyIntegrity());
        report.reason = "TAMPERED";
        ASSERT_FALSE(report.verifyIntegrity());
    END_TEST("validate_report_tamper_detection")

    TEST("validate_validation_time_tracked")
        synapse.clearCooldowns();
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        auto report = synapse.validateAction(action, passport);
        ASSERT_TRUE(report.validationTimeMs >= 0.0f);
    END_TEST("validate_validation_time_tracked")

    TEST("validate_cooldown_rejection")
        synapse.clearCooldowns();
        FSynapseConstraints constraints;
        constraints.cooldownMs = 500.0f;
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action1 = synapse.buildActionStruct(san, passport.genomeHash);
        auto report1 = synapse.validateAction(action1, passport, constraints);
        ASSERT_TRUE(report1.isApproved());

        auto action2 = synapse.buildActionStruct(san, passport.genomeHash);
        auto report2 = synapse.validateAction(action2, passport, constraints);
        ASSERT_FALSE(report2.isApproved());
        ASSERT_EQ(report2.result, ValidationResult::REJECTED_COOLDOWN_ACTIVE);
    END_TEST("validate_cooldown_rejection")

    TEST("validate_constraints_canonicalize")
        FSynapseConstraints c;
        std::string s = c.canonicalize();
        ASSERT_TRUE(s.find("maxBidCredits") != std::string::npos);
        ASSERT_TRUE(s.find("cooldownMs") != std::string::npos);
        ASSERT_TRUE(s.find("maxPositionRadius") != std::string::npos);
    END_TEST("validate_constraints_canonicalize")

    std::cout << "\n=== Full Pipeline processIntent Tests ===" << std::endl;

    TEST("process_intent_approved")
        synapse.resetStats();
        auto report = synapse.processIntent("strike enemy now", passport);
        ASSERT_TRUE(report.isApproved());
        ASSERT_EQ(report.resultName, "APPROVED");
    END_TEST("process_intent_approved")

    TEST("process_intent_empty_rejected")
        synapse.clearCooldowns();
        auto report = synapse.processIntent("", passport);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_EMPTY_INTENT);
    END_TEST("process_intent_empty_rejected")

    TEST("process_intent_high_slop_rejected")
        synapse.clearCooldowns();
        FSynapseConstraints constraints;
        constraints.maxSlopRatio = 0.3f;
        auto report = synapse.processIntent("I would love to certainly absolutely definitely help you strike", passport, "", constraints);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_SANITIZATION_FAILED);
    END_TEST("process_intent_high_slop_rejected")

    TEST("process_intent_trade_approved")
        synapse.clearCooldowns();
        auto report = synapse.processIntent("buy suspension 500", passport, "target_car_hash");
        ASSERT_TRUE(report.isApproved());
    END_TEST("process_intent_trade_approved")

    TEST("process_intent_trade_no_target_rejected")
        synapse.clearCooldowns();
        auto report = synapse.processIntent("buy suspension 500", passport);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_INVALID_TARGET);
    END_TEST("process_intent_trade_no_target_rejected")

    TEST("process_intent_sloppy_ai_output")
        synapse.clearCooldowns();
        auto report = synapse.processIntent(
            "I'd love to help you buy this car, let me set your bid to $50,000",
            passport, "car_hash");
        ASSERT_TRUE(report.isApproved());
    END_TEST("process_intent_sloppy_ai_output")

    TEST("process_intent_delegate_fires")
        synapse.resetStats();
        bool fired = false;
        std::string capturedKey;
        synapse.onIntentProcessed([&](const FValidationReport& r, const std::string& key) {
            fired = true;
            capturedKey = key;
        });
        synapse.processIntent("strike enemy", passport);
        ASSERT_TRUE(fired);
        ASSERT_EQ(capturedKey, passport.entityKey);
        synapse.onIntentProcessed(nullptr);
    END_TEST("process_intent_delegate_fires")

    TEST("process_multiple_verbs")
        synapse.clearCooldowns();
        std::string verbs[] = {"attack", "defend", "rush", "flee", "parry", "fake", "wait"};
        std::string expected[] = {"STRIKE", "GUARD", "CHARGE", "RETREAT", "COUNTER", "FEINT", "HOLD"};
        for (int i = 0; i < 7; i++) {
            synapse.clearCooldowns();
            auto san = synapse.sanitizeIntent(verbs[i] + " target");
            auto action = synapse.buildActionStruct(san, passport.genomeHash);
            ASSERT_EQ(action.actionTypeName, expected[i]);
        }
    END_TEST("process_multiple_verbs")

    std::cout << "\n=== Behavioral Mirror Tests ===" << std::endl;

    TEST("mirror_predict_action")
        synapse.resetStats();
        auto state = synapse.predictAction(passport.genomeHash, "STRIKE");
        ASSERT_TRUE(state.isPredicted);
        ASSERT_FALSE(state.isConfirmed);
        ASSERT_FALSE(state.isRolledBack);
        ASSERT_EQ(state.lastAction, "STRIKE");
        ASSERT_EQ(state.entityHash, passport.genomeHash);
    END_TEST("mirror_predict_action")

    TEST("mirror_confirm_action")
        synapse.resetStats();
        synapse.predictAction(passport.genomeHash, "GUARD");
        auto confirmed = synapse.confirmAction(passport.genomeHash);
        ASSERT_TRUE(confirmed.isConfirmed);
        ASSERT_FALSE(confirmed.isPredicted);
        ASSERT_FALSE(confirmed.isRolledBack);
        ASSERT_EQ(confirmed.lastAction, "GUARD");
    END_TEST("mirror_confirm_action")

    TEST("mirror_rollback_action")
        synapse.resetStats();
        synapse.predictAction(passport.genomeHash, "CHARGE");
        auto rolledBack = synapse.rollbackAction(passport.genomeHash, "Invalid target");
        ASSERT_TRUE(rolledBack.isRolledBack);
        ASSERT_FALSE(rolledBack.isPredicted);
        ASSERT_FALSE(rolledBack.isConfirmed);
        ASSERT_EQ(rolledBack.lastAction, "HOLD");
        ASSERT_EQ(rolledBack.rollbackCount, 1);
    END_TEST("mirror_rollback_action")

    TEST("mirror_rollback_delegate_fires")
        synapse.resetStats();
        bool fired = false;
        std::string capturedReason;
        synapse.onRollback([&](const FBehavioralMirrorState& s, const std::string& reason) {
            fired = true;
            capturedReason = reason;
        });
        synapse.predictAction(passport.genomeHash, "STRIKE");
        synapse.rollbackAction(passport.genomeHash, "COOLDOWN_BLOCKED");
        ASSERT_TRUE(fired);
        ASSERT_EQ(capturedReason, "COOLDOWN_BLOCKED");
        synapse.onRollback(nullptr);
    END_TEST("mirror_rollback_delegate_fires")

    TEST("mirror_predict_and_validate_approved")
        synapse.resetStats();
        auto state = synapse.predictAndValidate("strike enemy", passport);
        ASSERT_TRUE(state.isConfirmed);
        ASSERT_FALSE(state.isRolledBack);
    END_TEST("mirror_predict_and_validate_approved")

    TEST("mirror_predict_and_validate_rejected")
        synapse.resetStats();
        auto state = synapse.predictAndValidate("", passport);
        ASSERT_TRUE(state.isRolledBack);
        ASSERT_FALSE(state.isConfirmed);
    END_TEST("mirror_predict_and_validate_rejected")

    TEST("mirror_get_state")
        synapse.resetStats();
        synapse.predictAction("some_entity_123", "FEINT");
        auto state = synapse.getMirrorState("some_entity_123");
        ASSERT_EQ(state.entityHash, "some_entity_123");
        ASSERT_TRUE(state.isPredicted);
    END_TEST("mirror_get_state")

    TEST("mirror_get_nonexistent_state")
        auto state = synapse.getMirrorState("nonexistent_entity_hash_xyz");
        ASSERT_EQ(state.entityHash, "nonexistent_entity_hash_xyz");
        ASSERT_FALSE(state.isPredicted);
        ASSERT_FALSE(state.isConfirmed);
    END_TEST("mirror_get_nonexistent_state")

    TEST("mirror_state_canonicalize")
        synapse.resetStats();
        synapse.predictAction(passport.genomeHash, "STRIKE");
        auto state = synapse.getMirrorState(passport.genomeHash);
        std::string c = state.canonicalize();
        ASSERT_TRUE(c.find("entityHash") != std::string::npos);
        ASSERT_TRUE(c.find("isPredicted") != std::string::npos);
        ASSERT_TRUE(c.find("lastAction") != std::string::npos);
    END_TEST("mirror_state_canonicalize")

    TEST("mirror_multiple_rollbacks_counted")
        synapse.resetStats();
        synapse.predictAction(passport.genomeHash, "STRIKE");
        synapse.rollbackAction(passport.genomeHash, "r1");
        synapse.predictAction(passport.genomeHash, "GUARD");
        synapse.rollbackAction(passport.genomeHash, "r2");
        synapse.predictAction(passport.genomeHash, "CHARGE");
        synapse.rollbackAction(passport.genomeHash, "r3");
        auto state = synapse.getMirrorState(passport.genomeHash);
        ASSERT_EQ(state.rollbackCount, 3);
        ASSERT_EQ(state.predictionCount, 3);
    END_TEST("mirror_multiple_rollbacks_counted")

    std::cout << "\n=== Edge Case Intent Tests ===" << std::endl;

    TEST("edge_whitespace_only")
        auto result = synapse.sanitizeIntent("   \t  \n  ");
        ASSERT_FALSE(result.isValid);
    END_TEST("edge_whitespace_only")

    TEST("edge_single_word")
        auto result = synapse.sanitizeIntent("strike");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "strike");
    END_TEST("edge_single_word")

    TEST("edge_massive_number")
        auto result = synapse.sanitizeIntent("bid 999999999999");
        ASSERT_TRUE(result.isValid);
        ASSERT_TRUE(result.extractedAmount > 0.0f);
    END_TEST("edge_massive_number")

    TEST("edge_negative_number")
        auto result = synapse.sanitizeIntent("bid -500 car");
        ASSERT_TRUE(result.isValid);
        ASSERT_TRUE(result.extractedAmount < 0.0f);
    END_TEST("edge_negative_number")

    TEST("edge_special_characters")
        auto result = synapse.sanitizeIntent("strike!!! enemy??? hard...");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "strike");
    END_TEST("edge_special_characters")

    TEST("edge_mixed_case")
        auto result = synapse.sanitizeIntent("STRIKE Enemy HARD");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "strike");
    END_TEST("edge_mixed_case")

    TEST("edge_unknown_verb_passthrough")
        auto result = synapse.sanitizeIntent("xylophone melody harmonize");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "xylophone");
    END_TEST("edge_unknown_verb_passthrough")

    TEST("edge_very_long_intent")
        std::string longIntent = "strike";
        for (int i = 0; i < 100; i++) longIntent += " enemy";
        auto result = synapse.sanitizeIntent(longIntent);
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "strike");
    END_TEST("edge_very_long_intent")

    TEST("edge_all_slop_single_meaningful")
        auto result = synapse.sanitizeIntent("I would love to certainly absolutely definitely strike");
        ASSERT_TRUE(result.isValid);
        ASSERT_EQ(result.extractedVerb, "strike");
    END_TEST("edge_all_slop_single_meaningful")

    TEST("edge_numeric_only")
        auto result = synapse.sanitizeIntent("12345");
        ASSERT_TRUE(result.isValid);
        ASSERT_TRUE(result.extractedAmount > 0.0f);
    END_TEST("edge_numeric_only")

    TEST("edge_boundary_exactly_at_radius")
        synapse.clearCooldowns();
        FSynapseConstraints c;
        c.maxPositionRadius = 100.0f;
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        action.positionX = 57.7f;
        action.positionY = 57.7f;
        action.positionZ = 57.7f;
        action.updateHash();
        auto report = synapse.validateAction(action, passport, c);
        ASSERT_TRUE(report.isApproved());
    END_TEST("edge_boundary_exactly_at_radius")

    TEST("edge_boundary_just_over_radius")
        synapse.clearCooldowns();
        FSynapseConstraints c;
        c.maxPositionRadius = 100.0f;
        auto san = synapse.sanitizeIntent("strike enemy");
        auto action = synapse.buildActionStruct(san, passport.genomeHash);
        action.positionX = 60.0f;
        action.positionY = 60.0f;
        action.positionZ = 60.0f;
        action.updateHash();
        auto report = synapse.validateAction(action, passport, c);
        ASSERT_FALSE(report.isApproved());
        ASSERT_EQ(report.result, ValidationResult::REJECTED_BOUNDARY_VIOLATION);
    END_TEST("edge_boundary_just_over_radius")

    std::cout << "\n=== Stats Tests ===" << std::endl;

    TEST("stats_track_intents")
        synapse.resetStats();
        synapse.processIntent("strike enemy", passport);
        synapse.clearCooldowns();
        synapse.processIntent("guard now", passport);
        synapse.clearCooldowns();
        synapse.processIntent("", passport);
        auto stats = synapse.getStats();
        ASSERT_EQ(stats.totalIntentsProcessed, 3);
        ASSERT_EQ(stats.totalApproved, 2);
        ASSERT_EQ(stats.totalRejected, 1);
        ASSERT_TRUE(stats.totalEmptyIntents >= 1);
    END_TEST("stats_track_intents")

    TEST("stats_action_counts")
        synapse.resetStats();
        synapse.processIntent("strike enemy", passport);
        synapse.clearCooldowns();
        synapse.processIntent("strike enemy", passport);
        auto stats = synapse.getStats();
        ASSERT_TRUE(stats.actionCounts.count("STRIKE") > 0);
        ASSERT_TRUE(stats.actionCounts["STRIKE"] >= 2);
    END_TEST("stats_action_counts")

    TEST("stats_category_counts")
        synapse.resetStats();
        synapse.processIntent("strike enemy", passport);
        synapse.clearCooldowns();
        synapse.processIntent("buy car 100", passport, "target_hash");
        auto stats = synapse.getStats();
        ASSERT_TRUE(stats.categoryCounts.count("COMBAT") > 0);
        ASSERT_TRUE(stats.categoryCounts.count("TRADE") > 0);
    END_TEST("stats_category_counts")

    TEST("stats_rejection_counts")
        synapse.resetStats();
        synapse.processIntent("", passport);
        synapse.processIntent("", passport);
        auto stats = synapse.getStats();
        ASSERT_TRUE(stats.rejectionCounts.count("REJECTED_EMPTY_INTENT") > 0);
        ASSERT_TRUE(stats.rejectionCounts["REJECTED_EMPTY_INTENT"] >= 2);
    END_TEST("stats_rejection_counts")

    TEST("stats_reset")
        synapse.processIntent("strike enemy", passport);
        synapse.resetStats();
        auto stats = synapse.getStats();
        ASSERT_EQ(stats.totalIntentsProcessed, 0);
        ASSERT_EQ(stats.totalApproved, 0);
        ASSERT_EQ(stats.totalRejected, 0);
    END_TEST("stats_reset")

    TEST("stats_json_export")
        synapse.resetStats();
        synapse.processIntent("strike enemy", passport);
        std::string json = synapse.exportStatsJSON();
        ASSERT_TRUE(json.find("totalIntentsProcessed") != std::string::npos);
        ASSERT_TRUE(json.find("totalApproved") != std::string::npos);
        ASSERT_TRUE(json.find("totalRollbacks") != std::string::npos);
    END_TEST("stats_json_export")

    std::cout << "\n=== UE5 Code Generation Tests ===" << std::endl;

    TEST("ue5_synapse_class")
        std::string code = synapse.generateUE5SynapseCode();
        ASSERT_TRUE(code.find("UCLASS(BlueprintType)") != std::string::npos);
        ASSERT_TRUE(code.find("USovereignSynapse") != std::string::npos);
        ASSERT_TRUE(code.find("ProcessIntent") != std::string::npos);
        ASSERT_TRUE(code.find("SanitizeIntent") != std::string::npos);
        ASSERT_TRUE(code.find("PredictAction") != std::string::npos);
        ASSERT_TRUE(code.find("ConfirmAction") != std::string::npos);
        ASSERT_TRUE(code.find("RollbackAction") != std::string::npos);
        ASSERT_TRUE(code.find("ESovereignIntentCategory") != std::string::npos);
        ASSERT_TRUE(code.find("ESovereignValidationResult") != std::string::npos);
        ASSERT_TRUE(code.find("FSovereignActionStruct") != std::string::npos);
        ASSERT_TRUE(code.find("FSovereignValidationReport") != std::string::npos);
    END_TEST("ue5_synapse_class")

    TEST("ue5_uenum_intent_categories")
        std::string code = synapse.generateUE5SynapseCode();
        ASSERT_TRUE(code.find("UENUM(BlueprintType)") != std::string::npos);
        ASSERT_TRUE(code.find("COMBAT") != std::string::npos);
        ASSERT_TRUE(code.find("TRADE") != std::string::npos);
        ASSERT_TRUE(code.find("MOVEMENT") != std::string::npos);
    END_TEST("ue5_uenum_intent_categories")

    TEST("ue5_uenum_validation_results")
        std::string code = synapse.generateUE5SynapseCode();
        ASSERT_TRUE(code.find("APPROVED") != std::string::npos);
        ASSERT_TRUE(code.find("REJECTED_BOUNDARY_VIOLATION") != std::string::npos);
        ASSERT_TRUE(code.find("Boundary Violation") != std::string::npos);
    END_TEST("ue5_uenum_validation_results")

    TEST("ue5_ustruct_action")
        std::string code = synapse.generateUE5SynapseCode();
        ASSERT_TRUE(code.find("USTRUCT(BlueprintType)") != std::string::npos);
        ASSERT_TRUE(code.find("GENERATED_BODY()") != std::string::npos);
        ASSERT_TRUE(code.find("AmountCredits") != std::string::npos);
        ASSERT_TRUE(code.find("SanitizedIntent") != std::string::npos);
    END_TEST("ue5_ustruct_action")

    std::cout << "\n=== Genesis Ancestors Synapse Test ===" << std::endl;

    TEST("genesis_ancestors_synapse")
        synapse.resetStats();
        int approved = 0;
        std::string actions[] = {"strike enemy", "guard now", "charge forward", "retreat back", "counter attack"};
        for (int i = 0; i < 5; i++) {
            synapse.clearCooldowns();
            std::string input = "GENESIS_SYNAPSE_" + std::to_string(i);
            std::string hash = SovereignSHA256::hash(input);
            auto p = BiologicalForge::Get().forge(hash, "g_" + std::to_string(i));
            auto prof = SovereignIntelKernel::Get().generateProfile(p);
            auto hab = SovereignHabitatArbiter::Get().generateHabitat("GENESIS_WORLD");
            auto syn = SovereignHabitatArbiter::Get().computeSynergy(p, hab);
            auto pass = SovereignPassportAuthority::Get().issuePassport(p, prof, hab, syn, "g_" + std::to_string(i));
            auto report = synapse.processIntent(actions[i], pass);
            if (report.isApproved()) approved++;
        }
        ASSERT_EQ(approved, 5);
    END_TEST("genesis_ancestors_synapse")

    TEST("determinism_same_intent_same_result")
        synapse.clearCooldowns();
        auto r1 = synapse.processIntent("strike enemy", passport);
        synapse.clearCooldowns();
        auto r2 = synapse.processIntent("strike enemy", passport);
        ASSERT_EQ(r1.resultName, r2.resultName);
    END_TEST("determinism_same_intent_same_result")

    std::cout << "\n==================================================" << std::endl;
    std::cout << "SYNAPSE RESULTS: " << passCount << " passed, " << failCount << " failed" << std::endl;
    std::cout << "==================================================" << std::endl;

    return failCount > 0 ? 1 : 0;
}
