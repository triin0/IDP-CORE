#pragma once

#include "BiologicalForge.h"
#include "SovereignHabitat.h"
#include "SovereignArena.h"
#include <string>
#include <vector>
#include <array>
#include <cmath>
#include <algorithm>
#include <mutex>
#include <functional>
#include <cstdint>
#include <unordered_map>
#include <ctime>

namespace Sovereign {

enum class BehaviorArchetype {
    AGGRESSIVE,
    DEFENSIVE,
    EVASIVE,
    TACTICAL,
    BERSERKER,
    SENTINEL,
    UNKNOWN
};

inline std::string behaviorArchetypeToString(BehaviorArchetype a) {
    switch (a) {
        case BehaviorArchetype::AGGRESSIVE: return "AGGRESSIVE";
        case BehaviorArchetype::DEFENSIVE:  return "DEFENSIVE";
        case BehaviorArchetype::EVASIVE:    return "EVASIVE";
        case BehaviorArchetype::TACTICAL:   return "TACTICAL";
        case BehaviorArchetype::BERSERKER:  return "BERSERKER";
        case BehaviorArchetype::SENTINEL:   return "SENTINEL";
        default: return "UNKNOWN";
    }
}

enum class ActionType {
    STRIKE,
    GUARD,
    FLANK,
    CHARGE,
    RETREAT,
    COUNTER,
    FEINT,
    HOLD
};

inline std::string actionTypeToString(ActionType a) {
    switch (a) {
        case ActionType::STRIKE:  return "STRIKE";
        case ActionType::GUARD:   return "GUARD";
        case ActionType::FLANK:   return "FLANK";
        case ActionType::CHARGE:  return "CHARGE";
        case ActionType::RETREAT: return "RETREAT";
        case ActionType::COUNTER: return "COUNTER";
        case ActionType::FEINT:   return "FEINT";
        case ActionType::HOLD:    return "HOLD";
        default: return "UNKNOWN";
    }
}

struct FBehavioralWeights {
    float aggression     = 0.0f;
    float stoicism       = 0.0f;
    float elusiveness    = 0.0f;
    float decisiveness   = 0.0f;
    float adaptability   = 0.0f;
    float confidence     = 0.0f;
    float attackFrequency = 0.0f;
    float defenseBias    = 0.0f;

    std::string canonicalize() const {
        char buf[512];
        snprintf(buf, sizeof(buf),
            "{\"aggression\":%.6f,\"stoicism\":%.6f,\"elusiveness\":%.6f,"
            "\"decisiveness\":%.6f,\"adaptability\":%.6f,\"confidence\":%.6f,"
            "\"attackFrequency\":%.6f,\"defenseBias\":%.6f}",
            aggression, stoicism, elusiveness, decisiveness,
            adaptability, confidence, attackFrequency, defenseBias);
        return std::string(buf);
    }
};

struct FActionUtility {
    ActionType action   = ActionType::HOLD;
    float utility       = 0.0f;
    std::string actionName;

    FActionUtility() : actionName("HOLD") {}
    FActionUtility(ActionType a, float u) : action(a), utility(u), actionName(actionTypeToString(a)) {}
};

struct FSituationalContext {
    float healthRatio       = 1.0f;
    float enemyHealthRatio  = 1.0f;
    float distanceNorm      = 0.5f;
    float roundNumber       = 1.0f;
    float synergyCoefficient = 0.0f;
    float thermalStress     = 0.0f;
    bool  isHomeHabitat     = false;
    int   totalRounds       = 10;

    std::string canonicalize() const {
        char buf[512];
        snprintf(buf, sizeof(buf),
            "{\"healthRatio\":%.6f,\"enemyHealthRatio\":%.6f,\"distanceNorm\":%.6f,"
            "\"roundNumber\":%.6f,\"synergyCoefficient\":%.6f,\"thermalStress\":%.6f,"
            "\"isHomeHabitat\":%s,\"totalRounds\":%d}",
            healthRatio, enemyHealthRatio, distanceNorm, roundNumber,
            synergyCoefficient, thermalStress,
            isHomeHabitat ? "true" : "false", totalRounds);
        return std::string(buf);
    }
};

struct FDecisionResult {
    ActionType chosenAction       = ActionType::HOLD;
    std::string chosenActionName  = "HOLD";
    float chosenUtility           = 0.0f;
    std::vector<FActionUtility> utilityVector;
    std::string entityHash;
    std::string decisionHash;
    int64_t timestamp = 0;

    std::string canonicalize() const {
        std::string result = "{\"chosenAction\":\"" + chosenActionName +
            "\",\"chosenUtility\":" + std::to_string(chosenUtility) +
            ",\"entityHash\":\"" + entityHash + "\",\"utilities\":[";
        for (size_t i = 0; i < utilityVector.size(); i++) {
            if (i > 0) result += ",";
            result += "{\"action\":\"" + utilityVector[i].actionName +
                "\",\"utility\":" + std::to_string(utilityVector[i].utility) + "}";
        }
        result += "]}";
        return result;
    }

    bool verifyIntegrity() const {
        std::string expected = SovereignSHA256::hash(canonicalize());
        return expected == decisionHash;
    }
};

struct FBehavioralProfile {
    BehaviorArchetype archetype = BehaviorArchetype::UNKNOWN;
    std::string archetypeName   = "UNKNOWN";
    FBehavioralWeights weights;
    std::string sourceHash;
    PhenotypeClass entityClass  = PhenotypeClass::UNKNOWN;
    std::string profileHash;

    std::string canonicalize() const {
        return "{\"archetype\":\"" + archetypeName +
            "\",\"entityClass\":\"" + phenotypeClassToString(entityClass) +
            "\",\"sourceHash\":\"" + sourceHash +
            "\",\"weights\":" + weights.canonicalize() + "}";
    }

    bool verifyIntegrity() const {
        std::string expected = SovereignSHA256::hash(canonicalize());
        return expected == profileHash;
    }

    void updateHash() {
        profileHash = SovereignSHA256::hash(canonicalize());
    }
};

struct FBehavioralLocusEntry {
    std::string locusName;
    int byteOffset;
    int byteLength;
    std::string targetWeight;
};

class BehavioralLocusTable {
public:
    static const std::array<FBehavioralLocusEntry, 4>& morphologyLoci() {
        static const std::array<FBehavioralLocusEntry, 4> entries = {{
            {"meshIndex",  10, 2, "decisiveness"},
            {"scaleX",     12, 2, "aggression"},
            {"scaleY",     14, 2, "defenseBias"},
            {"scaleZ",     16, 2, "stoicism"}
        }};
        return entries;
    }

    static const std::array<FBehavioralLocusEntry, 4>& materialLoci() {
        static const std::array<FBehavioralLocusEntry, 4> entries = {{
            {"metallic",   6, 1, "stoicism"},
            {"roughness",  7, 1, "defenseBias"},
            {"emission",   8, 1, "aggression"},
            {"opacity",    9, 1, "elusiveness"}
        }};
        return entries;
    }

    static const std::array<FBehavioralLocusEntry, 4>& anisotropyLoci() {
        static const std::array<FBehavioralLocusEntry, 4> entries = {{
            {"subsurface",  22, 1, "elusiveness"},
            {"anisotropy",  23, 1, "attackFrequency"},
            {"fresnelHigh", 24, 1, "adaptability"},
            {"fresnelLow",  25, 1, "adaptability"}
        }};
        return entries;
    }

    static int totalMappedBytes() { return 16; }
};

struct FIntelStats {
    int totalProfilesGenerated = 0;
    int totalDecisionsMade = 0;
    int64_t lastProfileTimestamp = 0;
    int64_t lastDecisionTimestamp = 0;
    std::unordered_map<BehaviorArchetype, int> archetypeDistribution;
};

using ProfileGeneratedDelegate = std::function<void(const FBehavioralProfile&)>;
using DecisionMadeDelegate = std::function<void(const FDecisionResult&, const std::string& entityKey)>;

class SovereignIntelKernel {
public:
    static SovereignIntelKernel& Get() {
        static SovereignIntelKernel instance;
        return instance;
    }

    SovereignIntelKernel(const SovereignIntelKernel&) = delete;
    SovereignIntelKernel& operator=(const SovereignIntelKernel&) = delete;

    FBehavioralProfile generateProfile(const FVisualPhenotype& entity) {
        FBehavioralProfile profile;
        ProfileGeneratedDelegate profileDelegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            std::vector<uint8_t> genome = GeneticGenomeParser::hashToBytes(entity.sourceHash);
            profile.sourceHash = entity.sourceHash;
            profile.entityClass = entity.classification;

            profile.weights = computeWeightsFromGenome(genome, entity);

            profile.archetype = classifyArchetype(profile.weights);
            profile.archetypeName = behaviorArchetypeToString(profile.archetype);
            profile.updateHash();

            profileCache_[entity.sourceHash] = profile;

            stats_.totalProfilesGenerated++;
            stats_.lastProfileTimestamp = static_cast<int64_t>(std::time(nullptr));
            stats_.archetypeDistribution[profile.archetype]++;

            profileDelegate = profileGeneratedDelegate_;
        }

        if (profileDelegate) {
            profileDelegate(profile);
        }

        return profile;
    }

    FBehavioralProfile generateProfileWithSynergy(const FVisualPhenotype& entity,
                                                    const FSynergyResult& synergy) {
        FBehavioralProfile profile;
        ProfileGeneratedDelegate profileDelegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            std::vector<uint8_t> genome = GeneticGenomeParser::hashToBytes(entity.sourceHash);
            profile.sourceHash = entity.sourceHash;
            profile.entityClass = entity.classification;

            profile.weights = computeWeightsFromGenome(genome, entity);

            float confidenceBoost = synergy.coefficient * 0.5f;
            profile.weights.confidence = std::max(0.0f, std::min(1.0f,
                profile.weights.confidence + confidenceBoost));

            float thermalPenalty = synergy.thermalStress * 0.3f;
            profile.weights.adaptability = std::max(0.0f, std::min(1.0f,
                profile.weights.adaptability - thermalPenalty));

            profile.archetype = classifyArchetype(profile.weights);
            profile.archetypeName = behaviorArchetypeToString(profile.archetype);
            profile.updateHash();

            profileCache_[entity.sourceHash + ":" + synergy.environmentHash] = profile;

            stats_.totalProfilesGenerated++;
            stats_.lastProfileTimestamp = static_cast<int64_t>(std::time(nullptr));
            stats_.archetypeDistribution[profile.archetype]++;

            profileDelegate = profileGeneratedDelegate_;
        }

        if (profileDelegate) {
            profileDelegate(profile);
        }

        return profile;
    }

    FDecisionResult decide(const FBehavioralProfile& profile,
                            const FSituationalContext& context) {
        FDecisionResult result;
        DecisionMadeDelegate decisionDelegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            result.entityHash = profile.sourceHash;

            result.utilityVector = computeUtilityVector(profile.weights, context);

            float maxUtility = -1e9f;
            for (const auto& au : result.utilityVector) {
                if (au.utility > maxUtility) {
                    maxUtility = au.utility;
                    result.chosenAction = au.action;
                    result.chosenActionName = au.actionName;
                    result.chosenUtility = au.utility;
                }
            }

            result.timestamp = static_cast<int64_t>(std::time(nullptr));
            result.decisionHash = SovereignSHA256::hash(result.canonicalize());

            stats_.totalDecisionsMade++;
            stats_.lastDecisionTimestamp = result.timestamp;

            decisionDelegate = decisionMadeDelegate_;
        }

        if (decisionDelegate) {
            decisionDelegate(result, profile.sourceHash);
        }

        return result;
    }

    FDecisionResult decideInContext(const FVisualPhenotype& entity,
                                     const FHabitatState& habitat,
                                     const FSynergyResult& synergy,
                                     float healthRatio,
                                     float enemyHealthRatio,
                                     float distanceNorm,
                                     int roundNumber,
                                     int totalRounds) {
        auto profile = generateProfileWithSynergy(entity, synergy);

        FSituationalContext ctx;
        ctx.healthRatio = healthRatio;
        ctx.enemyHealthRatio = enemyHealthRatio;
        ctx.distanceNorm = distanceNorm;
        ctx.roundNumber = static_cast<float>(roundNumber);
        ctx.synergyCoefficient = synergy.coefficient;
        ctx.thermalStress = synergy.thermalStress;
        ctx.isHomeHabitat = (synergy.grade == SynergyGrade::PERFECT ||
                            synergy.grade == SynergyGrade::STRONG);
        ctx.totalRounds = totalRounds;

        return decide(profile, ctx);
    }

    bool verifyDeterminism(const FVisualPhenotype& entity,
                            const FSituationalContext& context) {
        FBehavioralProfile p1, p2;
        FDecisionResult d1, d2;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            std::vector<uint8_t> genome = GeneticGenomeParser::hashToBytes(entity.sourceHash);

            p1.sourceHash = entity.sourceHash;
            p1.entityClass = entity.classification;
            p1.weights = computeWeightsFromGenome(genome, entity);
            p1.archetype = classifyArchetype(p1.weights);
            p1.archetypeName = behaviorArchetypeToString(p1.archetype);
            p1.updateHash();

            p2.sourceHash = entity.sourceHash;
            p2.entityClass = entity.classification;
            p2.weights = computeWeightsFromGenome(genome, entity);
            p2.archetype = classifyArchetype(p2.weights);
            p2.archetypeName = behaviorArchetypeToString(p2.archetype);
            p2.updateHash();
        }

        if (p1.profileHash != p2.profileHash) return false;

        d1 = decide(p1, context);
        d2 = decide(p2, context);

        return d1.chosenAction == d2.chosenAction &&
               std::abs(d1.chosenUtility - d2.chosenUtility) < 1e-6f;
    }

    std::string generateUE5BehaviorTree(const FBehavioralProfile& profile) {
        std::string code;
        code += "USTRUCT(BlueprintType)\n";
        code += "struct FSovereignBehaviorProfile\n{\n";
        code += "    GENERATED_BODY()\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    float Aggression = " + std::to_string(profile.weights.aggression) + "f;\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    float Stoicism = " + std::to_string(profile.weights.stoicism) + "f;\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    float Elusiveness = " + std::to_string(profile.weights.elusiveness) + "f;\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    float Decisiveness = " + std::to_string(profile.weights.decisiveness) + "f;\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    float Adaptability = " + std::to_string(profile.weights.adaptability) + "f;\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    float Confidence = " + std::to_string(profile.weights.confidence) + "f;\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    float AttackFrequency = " + std::to_string(profile.weights.attackFrequency) + "f;\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    float DefenseBias = " + std::to_string(profile.weights.defenseBias) + "f;\n\n";
        code += "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        code += "    FString Archetype = TEXT(\"" + profile.archetypeName + "\");\n";
        code += "};\n";
        return code;
    }

    void onProfileGenerated(ProfileGeneratedDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        profileGeneratedDelegate_ = delegate;
    }

    void onDecisionMade(DecisionMadeDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        decisionMadeDelegate_ = delegate;
    }

    FIntelStats getStats() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        profileCache_.clear();
        stats_ = FIntelStats{};
    }

private:
    SovereignIntelKernel() = default;

    mutable std::mutex mutex_;
    std::unordered_map<std::string, FBehavioralProfile> profileCache_;
    FIntelStats stats_;
    ProfileGeneratedDelegate profileGeneratedDelegate_;
    DecisionMadeDelegate decisionMadeDelegate_;

    static FBehavioralWeights computeWeightsFromGenome(const std::vector<uint8_t>& genome,
                                                        const FVisualPhenotype& entity) {
        FBehavioralWeights w;

        uint16_t scaleXRaw = (static_cast<uint16_t>(genome[12]) << 8) | genome[13];
        float scaleXNorm = static_cast<float>(scaleXRaw) / 65535.0f;
        w.aggression = scaleXNorm * 0.6f;

        uint16_t scaleZRaw = (static_cast<uint16_t>(genome[16]) << 8) | genome[17];
        float scaleZNorm = static_cast<float>(scaleZRaw) / 65535.0f;
        w.stoicism = scaleZNorm * 0.5f;

        uint16_t scaleYRaw = (static_cast<uint16_t>(genome[14]) << 8) | genome[15];
        float scaleYNorm = static_cast<float>(scaleYRaw) / 65535.0f;
        w.defenseBias = scaleYNorm * 0.5f;

        uint16_t meshRaw = (static_cast<uint16_t>(genome[10]) << 8) | genome[11];
        float meshNorm = static_cast<float>(meshRaw) / 65535.0f;
        w.decisiveness = 0.3f + meshNorm * 0.4f;

        float emissionNorm = static_cast<float>(genome[8]) / 255.0f;
        w.aggression += emissionNorm * 0.3f;

        float metallicNorm = static_cast<float>(genome[6]) / 255.0f;
        w.stoicism += metallicNorm * 0.3f;

        float roughnessNorm = static_cast<float>(genome[7]) / 255.0f;
        w.defenseBias += roughnessNorm * 0.3f;

        float opacityNorm = static_cast<float>(genome[9]) / 255.0f;
        w.elusiveness = (1.0f - opacityNorm) * 0.6f;

        float subsurfaceNorm = static_cast<float>(genome[22]) / 255.0f;
        w.elusiveness += subsurfaceNorm * 0.3f;

        float anisotropyNorm = static_cast<float>(genome[23]) / 255.0f;
        w.attackFrequency = anisotropyNorm * 0.7f;

        uint16_t fresnelRaw = (static_cast<uint16_t>(genome[24]) << 8) | genome[25];
        float fresnelNorm = static_cast<float>(fresnelRaw) / 65535.0f;
        w.adaptability = fresnelNorm * 0.6f;

        w.attackFrequency += emissionNorm * 0.2f;

        applyClassModifiers(w, entity.classification);

        w.confidence = 0.3f + w.decisiveness * 0.3f + w.stoicism * 0.2f;

        w.aggression      = std::max(0.0f, std::min(1.0f, w.aggression));
        w.stoicism         = std::max(0.0f, std::min(1.0f, w.stoicism));
        w.elusiveness      = std::max(0.0f, std::min(1.0f, w.elusiveness));
        w.decisiveness     = std::max(0.0f, std::min(1.0f, w.decisiveness));
        w.adaptability     = std::max(0.0f, std::min(1.0f, w.adaptability));
        w.confidence       = std::max(0.0f, std::min(1.0f, w.confidence));
        w.attackFrequency  = std::max(0.0f, std::min(1.0f, w.attackFrequency));
        w.defenseBias      = std::max(0.0f, std::min(1.0f, w.defenseBias));

        return w;
    }

    static void applyClassModifiers(FBehavioralWeights& w, PhenotypeClass cls) {
        switch (cls) {
            case PhenotypeClass::VOLCANIC:
                w.aggression += 0.15f;
                w.attackFrequency += 0.1f;
                break;
            case PhenotypeClass::CRYSTALLINE:
                w.elusiveness += 0.1f;
                w.adaptability += 0.1f;
                break;
            case PhenotypeClass::METALLIC:
                w.stoicism += 0.15f;
                w.defenseBias += 0.1f;
                break;
            case PhenotypeClass::ETHEREAL:
                w.elusiveness += 0.15f;
                w.adaptability += 0.1f;
                break;
            case PhenotypeClass::ORGANIC:
                w.adaptability += 0.1f;
                w.confidence += 0.05f;
                break;
            case PhenotypeClass::AQUEOUS:
                w.elusiveness += 0.1f;
                w.defenseBias += 0.05f;
                break;
            default:
                break;
        }
    }

    static BehaviorArchetype classifyArchetype(const FBehavioralWeights& w) {
        float aggressiveScore = w.aggression * 0.4f + w.attackFrequency * 0.3f +
                                (1.0f - w.defenseBias) * 0.2f + w.decisiveness * 0.1f;
        float defensiveScore  = w.defenseBias * 0.4f + w.stoicism * 0.3f +
                                (1.0f - w.aggression) * 0.2f + w.confidence * 0.1f;
        float evasiveScore    = w.elusiveness * 0.4f + w.adaptability * 0.3f +
                                (1.0f - w.stoicism) * 0.2f + (1.0f - w.defenseBias) * 0.1f;
        float tacticalScore   = w.decisiveness * 0.3f + w.adaptability * 0.3f +
                                w.confidence * 0.2f + (1.0f - w.aggression) * 0.1f +
                                w.elusiveness * 0.1f;
        float berserkerScore  = w.aggression * 0.3f + w.attackFrequency * 0.3f +
                                (1.0f - w.elusiveness) * 0.2f + (1.0f - w.stoicism) * 0.2f;
        float sentinelScore   = w.stoicism * 0.3f + w.defenseBias * 0.3f +
                                w.confidence * 0.2f + (1.0f - w.elusiveness) * 0.1f +
                                (1.0f - w.attackFrequency) * 0.1f;

        struct { BehaviorArchetype type; float score; } candidates[] = {
            {BehaviorArchetype::AGGRESSIVE, aggressiveScore},
            {BehaviorArchetype::DEFENSIVE,  defensiveScore},
            {BehaviorArchetype::EVASIVE,    evasiveScore},
            {BehaviorArchetype::TACTICAL,   tacticalScore},
            {BehaviorArchetype::BERSERKER,  berserkerScore},
            {BehaviorArchetype::SENTINEL,   sentinelScore}
        };

        BehaviorArchetype best = BehaviorArchetype::UNKNOWN;
        float bestScore = -1.0f;
        for (const auto& c : candidates) {
            if (c.score > bestScore) {
                bestScore = c.score;
                best = c.type;
            }
        }
        return best;
    }

    static std::vector<FActionUtility> computeUtilityVector(const FBehavioralWeights& w,
                                                              const FSituationalContext& ctx) {
        std::vector<FActionUtility> utilities;

        float roundProgress = ctx.roundNumber / static_cast<float>(std::max(1, ctx.totalRounds));
        float healthAdvantage = ctx.healthRatio - ctx.enemyHealthRatio;
        float urgency = 1.0f - ctx.healthRatio;
        float proximity = 1.0f - ctx.distanceNorm;

        float strikeU = w.aggression * 0.35f +
                         proximity * 0.25f +
                         w.confidence * 0.15f +
                         w.attackFrequency * 0.15f +
                         urgency * 0.10f;

        float guardU = w.defenseBias * 0.35f +
                        w.stoicism * 0.25f +
                        urgency * 0.20f +
                        (1.0f - w.aggression) * 0.10f +
                        w.confidence * 0.10f;

        float flankU = w.elusiveness * 0.35f +
                        w.adaptability * 0.25f +
                        ctx.distanceNorm * 0.15f +
                        w.decisiveness * 0.15f +
                        (1.0f - w.stoicism) * 0.10f;

        float chargeU = w.aggression * 0.30f +
                         w.confidence * 0.25f +
                         healthAdvantage * 0.20f +
                         w.decisiveness * 0.15f +
                         proximity * 0.10f;

        float retreatU = (1.0f - w.stoicism) * 0.25f +
                          urgency * 0.30f +
                          w.elusiveness * 0.20f +
                          ctx.distanceNorm * 0.15f +
                          w.adaptability * 0.10f;

        float counterU = w.stoicism * 0.30f +
                          w.decisiveness * 0.25f +
                          w.confidence * 0.20f +
                          (1.0f - w.attackFrequency) * 0.15f +
                          proximity * 0.10f;

        float feintU = w.elusiveness * 0.30f +
                        w.decisiveness * 0.25f +
                        w.adaptability * 0.20f +
                        (1.0f - w.stoicism) * 0.15f +
                        w.attackFrequency * 0.10f;

        float holdU = w.stoicism * 0.30f +
                       w.defenseBias * 0.25f +
                       (1.0f - urgency) * 0.20f +
                       w.confidence * 0.15f +
                       (1.0f - roundProgress) * 0.10f;

        if (ctx.isHomeHabitat) {
            float homeBonus = 0.05f + ctx.synergyCoefficient * 0.05f;
            strikeU += homeBonus;
            chargeU += homeBonus;
            counterU += homeBonus * 0.5f;
        }

        if (ctx.thermalStress > 0.5f) {
            float thermalPenalty = ctx.thermalStress * 0.08f;
            chargeU -= thermalPenalty;
            strikeU -= thermalPenalty * 0.5f;
        }

        utilities.push_back(FActionUtility(ActionType::STRIKE,  strikeU));
        utilities.push_back(FActionUtility(ActionType::GUARD,   guardU));
        utilities.push_back(FActionUtility(ActionType::FLANK,   flankU));
        utilities.push_back(FActionUtility(ActionType::CHARGE,  chargeU));
        utilities.push_back(FActionUtility(ActionType::RETREAT, retreatU));
        utilities.push_back(FActionUtility(ActionType::COUNTER, counterU));
        utilities.push_back(FActionUtility(ActionType::FEINT,   feintU));
        utilities.push_back(FActionUtility(ActionType::HOLD,    holdU));

        return utilities;
    }
};

}
