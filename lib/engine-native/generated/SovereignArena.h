#pragma once

#include "SovereignShowroom.h"
#include <string>
#include <vector>
#include <map>
#include <cstdint>
#include <cmath>
#include <functional>
#include <sstream>
#include <iomanip>
#include <mutex>
#include <algorithm>
#include <numeric>

namespace Sovereign {

enum class InteractionOutcome {
    ATTACKER_WINS,
    DEFENDER_WINS,
    TRADE,
    MISS,
    DRAW
};

inline std::string outcomeToString(InteractionOutcome o) {
    switch (o) {
        case InteractionOutcome::ATTACKER_WINS: return "ATTACKER_WINS";
        case InteractionOutcome::DEFENDER_WINS: return "DEFENDER_WINS";
        case InteractionOutcome::TRADE:         return "TRADE";
        case InteractionOutcome::MISS:          return "MISS";
        case InteractionOutcome::DRAW:          return "DRAW";
    }
    return "UNKNOWN";
}

enum class DamageType {
    KINETIC,
    THERMAL,
    CORROSIVE,
    RADIANT,
    VOID
};

inline std::string damageTypeToString(DamageType d) {
    switch (d) {
        case DamageType::KINETIC:   return "KINETIC";
        case DamageType::THERMAL:   return "THERMAL";
        case DamageType::CORROSIVE: return "CORROSIVE";
        case DamageType::RADIANT:   return "RADIANT";
        case DamageType::VOID:      return "VOID";
    }
    return "KINETIC";
}

struct FCombatStats {
    float attackPower = 0.0f;
    float defense = 0.0f;
    float speed = 0.0f;
    float accuracy = 0.0f;
    float evasion = 0.0f;
    float criticalChance = 0.0f;
    float criticalMultiplier = 1.5f;
    float resilience = 0.0f;
    float reach = 1.0f;
    float mass = 1.0f;
    DamageType primaryDamageType = DamageType::KINETIC;
    std::string entityKey;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"accuracy\":" << accuracy
            << ",\"attackPower\":" << attackPower
            << ",\"criticalChance\":" << criticalChance
            << ",\"criticalMultiplier\":" << criticalMultiplier
            << ",\"damageType\":\"" << damageTypeToString(primaryDamageType) << "\""
            << ",\"defense\":" << defense
            << ",\"entityKey\":\"" << entityKey << "\""
            << ",\"evasion\":" << evasion
            << ",\"mass\":" << mass
            << ",\"reach\":" << reach
            << ",\"resilience\":" << resilience
            << ",\"speed\":" << speed
            << "}";
        return oss.str();
    }

    float totalPower() const {
        return attackPower + defense + speed + accuracy + evasion +
               criticalChance + resilience + reach;
    }
};

struct FInteractionRound {
    int roundNumber = 0;
    std::string attackerKey;
    std::string defenderKey;
    float attackRoll = 0.0f;
    float defenseRoll = 0.0f;
    float damageDealt = 0.0f;
    bool hit = false;
    bool critical = false;
    InteractionOutcome roundOutcome = InteractionOutcome::MISS;
    std::string roundHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"attackRoll\":" << attackRoll
            << ",\"attackerKey\":\"" << attackerKey << "\""
            << ",\"critical\":" << (critical ? "true" : "false")
            << ",\"damageDealt\":" << damageDealt
            << ",\"defenderKey\":\"" << defenderKey << "\""
            << ",\"defenseRoll\":" << defenseRoll
            << ",\"hit\":" << (hit ? "true" : "false")
            << ",\"roundNumber\":" << roundNumber
            << ",\"roundOutcome\":\"" << outcomeToString(roundOutcome) << "\""
            << "}";
        return oss.str();
    }

    void computeHash() {
        roundHash = SovereignSHA256::hash(canonicalize());
    }
};

struct FInteractionResult {
    std::string arenaSessionId;
    std::string entityAKey;
    std::string entityBKey;
    FCombatStats statsA;
    FCombatStats statsB;
    std::vector<FInteractionRound> rounds;
    InteractionOutcome finalOutcome = InteractionOutcome::DRAW;
    std::string finalOutcomeName;
    float entityAHealthRemaining = 100.0f;
    float entityBHealthRemaining = 100.0f;
    float totalDamageDealtByA = 0.0f;
    float totalDamageDealtByB = 0.0f;
    int totalRounds = 0;
    int hitsA = 0;
    int hitsB = 0;
    int critsA = 0;
    int critsB = 0;
    int64_t timestamp = 0;
    std::string resultHash;
    bool flushedToArbiter = false;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"entityAHealthRemaining\":" << entityAHealthRemaining
            << ",\"entityAKey\":\"" << entityAKey << "\""
            << ",\"entityBHealthRemaining\":" << entityBHealthRemaining
            << ",\"entityBKey\":\"" << entityBKey << "\""
            << ",\"finalOutcome\":\"" << finalOutcomeName << "\""
            << ",\"rounds\":[";
        for (size_t i = 0; i < rounds.size(); i++) {
            if (i > 0) oss << ",";
            oss << rounds[i].canonicalize();
        }
        oss << "],\"sessionId\":\"" << arenaSessionId << "\""
            << ",\"statsA\":" << statsA.canonicalize()
            << ",\"statsB\":" << statsB.canonicalize()
            << ",\"totalDamageByA\":" << totalDamageDealtByA
            << ",\"totalDamageByB\":" << totalDamageDealtByB
            << ",\"totalRounds\":" << totalRounds
            << "}";
        return oss.str();
    }

    std::string computeResultHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !resultHash.empty() && resultHash == computeResultHash();
    }
};

struct ArenaStats {
    int totalInteractions = 0;
    int totalRoundsPlayed = 0;
    int attackerWins = 0;
    int defenderWins = 0;
    int trades = 0;
    int draws = 0;
    int totalCriticalHits = 0;
    int totalMisses = 0;
    int totalFlushed = 0;
    int64_t lastInteractionTimestamp = 0;
    std::map<DamageType, int> damageTypeDistribution;
};

using InteractionCompleteDelegate = std::function<void(const FInteractionResult&)>;
using RoundResolvedDelegate = std::function<void(const FInteractionRound&, int roundNum, int totalRounds)>;
using ArenaFlushDelegate = std::function<void(const FInteractionResult&, bool success)>;

class PhenotypeStatMapper {
public:
    static FCombatStats mapToStats(const FVisualPhenotype& phenotype, const std::string& entityKey) {
        FCombatStats stats;
        stats.entityKey = entityKey;

        const auto& mat = phenotype.material;
        const auto& morph = phenotype.morphology;

        stats.attackPower = computeAttackPower(mat, morph);
        stats.defense = computeDefense(mat, morph);
        stats.speed = computeSpeed(mat, morph);
        stats.accuracy = computeAccuracy(mat, morph);
        stats.evasion = computeEvasion(mat, morph);
        stats.criticalChance = computeCriticalChance(mat, phenotype.primaryColor);
        stats.criticalMultiplier = 1.5f + mat.specular * 1.0f;
        stats.resilience = computeResilience(mat);
        stats.reach = computeReach(morph);
        stats.mass = computeMass(morph);
        stats.primaryDamageType = classifyDamageType(phenotype.classification, mat);

        stats.attackPower = clamp(stats.attackPower, 0.0f, 100.0f);
        stats.defense = clamp(stats.defense, 0.0f, 100.0f);
        stats.speed = clamp(stats.speed, 0.0f, 100.0f);
        stats.accuracy = clamp(stats.accuracy, 0.0f, 1.0f);
        stats.evasion = clamp(stats.evasion, 0.0f, 1.0f);
        stats.criticalChance = clamp(stats.criticalChance, 0.0f, 1.0f);
        stats.criticalMultiplier = clamp(stats.criticalMultiplier, 1.0f, 3.0f);
        stats.resilience = clamp(stats.resilience, 0.0f, 1.0f);
        stats.reach = clamp(stats.reach, 0.5f, 5.0f);
        stats.mass = clamp(stats.mass, 0.1f, 10.0f);

        return stats;
    }

private:
    static float clamp(float v, float lo, float hi) {
        return std::max(lo, std::min(hi, v));
    }

    static float computeAttackPower(const FOrganicMaterialProfile& mat, const FMorphologyDescriptor& morph) {
        float base = mat.metallic * 40.0f + mat.emissionIntensity * 3.0f;
        float scaleBonus = (morph.scaleX + morph.scaleY + morph.scaleZ) / 3.0f * 10.0f;
        return base + scaleBonus + mat.displacementHeight * 20.0f;
    }

    static float computeDefense(const FOrganicMaterialProfile& mat, const FMorphologyDescriptor& morph) {
        float base = mat.roughness * 35.0f + mat.opacity * 15.0f;
        float scaleBonus = (morph.scaleX + morph.scaleY + morph.scaleZ) / 3.0f * 8.0f;
        return base + scaleBonus + mat.subsurfaceScattering * 10.0f;
    }

    static float computeSpeed(const FOrganicMaterialProfile& mat, const FMorphologyDescriptor& morph) {
        float avgScale = (morph.scaleX + morph.scaleY + morph.scaleZ) / 3.0f;
        float inverseMass = 1.0f / (0.5f + avgScale);
        float agility = (1.0f - mat.roughness) * 30.0f + mat.anisotropy * 20.0f;
        return agility * inverseMass + morph.animationFrequency * 5.0f;
    }

    static float computeAccuracy(const FOrganicMaterialProfile& mat, const FMorphologyDescriptor& morph) {
        return 0.3f + mat.normalIntensity * 0.2f + mat.specular * 0.15f +
               (1.0f - mat.roughness) * 0.1f + mat.fresnelPower / 10.0f * 0.1f;
    }

    static float computeEvasion(const FOrganicMaterialProfile& mat, const FMorphologyDescriptor& morph) {
        float avgScale = (morph.scaleX + morph.scaleY + morph.scaleZ) / 3.0f;
        float sizeP = 1.0f / (0.5f + avgScale) * 0.3f;
        return sizeP + mat.anisotropy * 0.2f + (1.0f - mat.opacity) * 0.15f +
               morph.animationFrequency / 5.0f * 0.1f;
    }

    static float computeCriticalChance(const FOrganicMaterialProfile& mat, const FLinearColor& color) {
        return 0.05f + mat.specular * 0.15f + mat.emissionIntensity / 10.0f * 0.1f +
               color.luminance() * 0.05f;
    }

    static float computeResilience(const FOrganicMaterialProfile& mat) {
        return mat.subsurfaceScattering * 0.4f + mat.opacity * 0.3f +
               mat.roughness * 0.2f + mat.displacementHeight * 0.1f;
    }

    static float computeReach(const FMorphologyDescriptor& morph) {
        return (morph.scaleX + morph.scaleY) / 2.0f + morph.uvTilingU * 0.2f;
    }

    static float computeMass(const FMorphologyDescriptor& morph) {
        return morph.scaleX * morph.scaleY * morph.scaleZ;
    }

    static DamageType classifyDamageType(PhenotypeClass cls, const FOrganicMaterialProfile& mat) {
        switch (cls) {
            case PhenotypeClass::VOLCANIC:    return DamageType::THERMAL;
            case PhenotypeClass::METALLIC:    return DamageType::KINETIC;
            case PhenotypeClass::CRYSTALLINE: return DamageType::RADIANT;
            case PhenotypeClass::AQUEOUS:     return DamageType::CORROSIVE;
            case PhenotypeClass::ETHEREAL:    return DamageType::VOID;
            case PhenotypeClass::ORGANIC:
            default:
                if (mat.emissionIntensity > 5.0f) return DamageType::RADIANT;
                if (mat.metallic > 0.6f) return DamageType::KINETIC;
                return DamageType::CORROSIVE;
        }
    }
};

struct FDamageMatrix {
    static float getMultiplier(DamageType attacker, DamageType defender) {
        static const float matrix[5][5] = {
            /*            KIN   THRM  CORR  RAD   VOID */
            /* KIN  */ { 1.0f, 0.8f, 1.2f, 1.0f, 0.9f },
            /* THRM */ { 1.2f, 1.0f, 0.8f, 1.1f, 0.7f },
            /* CORR */ { 0.8f, 1.2f, 1.0f, 0.9f, 1.3f },
            /* RAD  */ { 1.0f, 0.9f, 1.1f, 1.0f, 1.2f },
            /* VOID */ { 1.1f, 1.3f, 0.7f, 0.8f, 1.0f }
        };
        int a = static_cast<int>(attacker);
        int d = static_cast<int>(defender);
        if (a >= 0 && a < 5 && d >= 0 && d < 5) return matrix[a][d];
        return 1.0f;
    }

    static std::string getEffectivenessLabel(float mult) {
        if (mult > 1.15f) return "SUPER_EFFECTIVE";
        if (mult < 0.85f) return "NOT_VERY_EFFECTIVE";
        return "NORMAL";
    }
};

class DeterministicRNG {
public:
    explicit DeterministicRNG(const std::string& seed) {
        state_ = 0;
        for (size_t i = 0; i < seed.size(); i++) {
            state_ ^= static_cast<uint64_t>(seed[i]) << ((i % 8) * 8);
            state_ = state_ * 6364136223846793005ULL + 1442695040888963407ULL;
        }
    }

    float next01() {
        state_ = state_ * 6364136223846793005ULL + 1442695040888963407ULL;
        uint32_t xorshifted = static_cast<uint32_t>(((state_ >> 18u) ^ state_) >> 27u);
        uint32_t rot = static_cast<uint32_t>(state_ >> 59u);
        uint32_t result = (xorshifted >> rot) | (xorshifted << ((-rot) & 31));
        return static_cast<float>(result) / static_cast<float>(UINT32_MAX);
    }

    uint64_t state() const { return state_; }

private:
    uint64_t state_;
};

class SovereignArena {
public:
    static SovereignArena& Get() {
        static SovereignArena instance;
        return instance;
    }

    SovereignArena(const SovereignArena&) = delete;
    SovereignArena& operator=(const SovereignArena&) = delete;

    struct ArenaConfig {
        int maxRounds = 10;
        float startingHealth = 100.0f;
        float tradeThreshold = 5.0f;
        bool autoFlushToChronos = true;
        float missFloor = 0.15f;
    };

    void configure(const ArenaConfig& config) {
        std::lock_guard<std::mutex> lock(mutex_);
        config_ = config;
    }

    ArenaConfig getConfig() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return config_;
    }

    FInteractionResult interact(
        const FVisualPhenotype& entityA, const std::string& entityAKey,
        const FVisualPhenotype& entityB, const std::string& entityBKey) {

        std::lock_guard<std::mutex> lock(mutex_);

        FInteractionResult result;
        result.entityAKey = entityAKey;
        result.entityBKey = entityBKey;
        result.statsA = PhenotypeStatMapper::mapToStats(entityA, entityAKey);
        result.statsB = PhenotypeStatMapper::mapToStats(entityB, entityBKey);
        result.entityAHealthRemaining = config_.startingHealth;
        result.entityBHealthRemaining = config_.startingHealth;

        std::string sessionSeed = entityA.sourceHash + ":" + entityB.sourceHash;
        result.arenaSessionId = SovereignSHA256::hash(sessionSeed);
        DeterministicRNG rng(sessionSeed);

        for (int round = 0; round < config_.maxRounds; round++) {
            if (result.entityAHealthRemaining <= 0.0f || result.entityBHealthRemaining <= 0.0f) break;

            bool aGoesFirst = result.statsA.speed >= result.statsB.speed;
            if (std::abs(result.statsA.speed - result.statsB.speed) < 0.01f) {
                aGoesFirst = rng.next01() >= 0.5f;
            }

            if (aGoesFirst) {
                auto roundA = resolveAttack(result.statsA, result.statsB, entityAKey, entityBKey,
                                            round * 2, rng);
                result.rounds.push_back(roundA);
                if (roundA.hit) {
                    result.entityBHealthRemaining -= roundA.damageDealt;
                    result.totalDamageDealtByA += roundA.damageDealt;
                    result.hitsA++;
                    if (roundA.critical) result.critsA++;
                }

                if (result.entityBHealthRemaining > 0.0f) {
                    auto roundB = resolveAttack(result.statsB, result.statsA, entityBKey, entityAKey,
                                                round * 2 + 1, rng);
                    result.rounds.push_back(roundB);
                    if (roundB.hit) {
                        result.entityAHealthRemaining -= roundB.damageDealt;
                        result.totalDamageDealtByB += roundB.damageDealt;
                        result.hitsB++;
                        if (roundB.critical) result.critsB++;
                    }
                }
            } else {
                auto roundB = resolveAttack(result.statsB, result.statsA, entityBKey, entityAKey,
                                            round * 2, rng);
                result.rounds.push_back(roundB);
                if (roundB.hit) {
                    result.entityAHealthRemaining -= roundB.damageDealt;
                    result.totalDamageDealtByB += roundB.damageDealt;
                    result.hitsB++;
                    if (roundB.critical) result.critsB++;
                }

                if (result.entityAHealthRemaining > 0.0f) {
                    auto roundA = resolveAttack(result.statsA, result.statsB, entityAKey, entityBKey,
                                                round * 2 + 1, rng);
                    result.rounds.push_back(roundA);
                    if (roundA.hit) {
                        result.entityBHealthRemaining -= roundA.damageDealt;
                        result.totalDamageDealtByA += roundA.damageDealt;
                        result.hitsA++;
                        if (roundA.critical) result.critsA++;
                    }
                }
            }
        }

        result.entityAHealthRemaining = std::max(0.0f, result.entityAHealthRemaining);
        result.entityBHealthRemaining = std::max(0.0f, result.entityBHealthRemaining);
        result.totalRounds = static_cast<int>(result.rounds.size());
        result.timestamp = static_cast<int64_t>(std::time(nullptr));

        result.finalOutcome = determineFinalOutcome(result);
        result.finalOutcomeName = outcomeToString(result.finalOutcome);

        for (auto& round : result.rounds) {
            round.computeHash();
        }
        result.resultHash = result.computeResultHash();

        history_.push_back(result);
        updateStats(result);

        if (interactionCompleteDelegate_) {
            interactionCompleteDelegate_(result);
        }

        if (config_.autoFlushToChronos) {
            flushToArbiter(result);
        }

        return result;
    }

    bool flushToArbiter(FInteractionResult& result) {
        auto& chronos = ChronosEngine::Get();

        JsonValue payload(std::map<std::string, JsonValue>{
            {"sessionId", JsonValue(result.arenaSessionId)},
            {"entityA", JsonValue(result.entityAKey)},
            {"entityB", JsonValue(result.entityBKey)},
            {"outcome", JsonValue(result.finalOutcomeName)},
            {"healthA", JsonValue(static_cast<double>(result.entityAHealthRemaining))},
            {"healthB", JsonValue(static_cast<double>(result.entityBHealthRemaining))},
            {"totalDamageA", JsonValue(static_cast<double>(result.totalDamageDealtByA))},
            {"totalDamageB", JsonValue(static_cast<double>(result.totalDamageDealtByB))},
            {"totalRounds", JsonValue(result.totalRounds)},
            {"resultHash", JsonValue(result.resultHash)}
        });

        std::string chronosKey = "arena:" + result.arenaSessionId;
        chronos.enqueue(chronosKey, payload, 0, "arena-system");

        result.flushedToArbiter = true;
        stats_.totalFlushed++;

        if (flushDelegate_) {
            flushDelegate_(result, true);
        }

        return true;
    }

    bool verifyResult(const FInteractionResult& result) const {
        return result.verifyIntegrity();
    }

    bool verifyDeterminism(const FVisualPhenotype& entityA, const std::string& keyA,
                            const FVisualPhenotype& entityB, const std::string& keyB) {
        auto saved = history_;
        auto savedStats = stats_;
        history_.clear();
        stats_ = ArenaStats{};

        auto r1 = interact(entityA, keyA, entityB, keyB);
        history_.clear();
        stats_ = ArenaStats{};
        auto r2 = interact(entityA, keyA, entityB, keyB);

        history_ = saved;
        stats_ = savedStats;

        return r1.resultHash == r2.resultHash &&
               r1.finalOutcome == r2.finalOutcome &&
               r1.totalRounds == r2.totalRounds;
    }

    const ArenaStats& stats() const { return stats_; }
    const std::vector<FInteractionResult>& history() const { return history_; }

    void onInteractionComplete(InteractionCompleteDelegate d) { interactionCompleteDelegate_ = std::move(d); }
    void onRoundResolved(RoundResolvedDelegate d) { roundResolvedDelegate_ = std::move(d); }
    void onFlush(ArenaFlushDelegate d) { flushDelegate_ = std::move(d); }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        history_.clear();
        stats_ = ArenaStats{};
        config_ = ArenaConfig{};
        interactionCompleteDelegate_ = nullptr;
        roundResolvedDelegate_ = nullptr;
        flushDelegate_ = nullptr;
    }

private:
    SovereignArena() = default;
    mutable std::mutex mutex_;
    ArenaConfig config_;
    ArenaStats stats_;
    std::vector<FInteractionResult> history_;
    InteractionCompleteDelegate interactionCompleteDelegate_;
    RoundResolvedDelegate roundResolvedDelegate_;
    ArenaFlushDelegate flushDelegate_;

    FInteractionRound resolveAttack(const FCombatStats& attacker, const FCombatStats& defender,
                                     const std::string& atkKey, const std::string& defKey,
                                     int roundNum, DeterministicRNG& rng) {
        FInteractionRound round;
        round.roundNumber = roundNum;
        round.attackerKey = atkKey;
        round.defenderKey = defKey;

        round.attackRoll = rng.next01();
        round.defenseRoll = rng.next01();

        float hitChance = attacker.accuracy - defender.evasion + 0.1f;
        hitChance = std::max(config_.missFloor, std::min(0.95f, hitChance));

        round.hit = round.attackRoll < hitChance;

        if (round.hit) {
            float typeMultiplier = FDamageMatrix::getMultiplier(
                attacker.primaryDamageType, defender.primaryDamageType);

            float rawDamage = attacker.attackPower * typeMultiplier;

            float critRoll = rng.next01();
            round.critical = critRoll < attacker.criticalChance;
            if (round.critical) {
                rawDamage *= attacker.criticalMultiplier;
            }

            float damageReduction = defender.defense * defender.resilience * 0.5f;
            round.damageDealt = std::max(1.0f, rawDamage - damageReduction);

            if (round.critical) {
                round.roundOutcome = InteractionOutcome::ATTACKER_WINS;
            } else {
                round.roundOutcome = InteractionOutcome::ATTACKER_WINS;
            }
        } else {
            round.damageDealt = 0.0f;
            round.roundOutcome = InteractionOutcome::MISS;
            stats_.totalMisses++;
        }

        if (roundResolvedDelegate_) {
            roundResolvedDelegate_(round, roundNum, config_.maxRounds * 2);
        }

        return round;
    }

    InteractionOutcome determineFinalOutcome(const FInteractionResult& result) const {
        float healthDiff = result.entityAHealthRemaining - result.entityBHealthRemaining;

        if (result.entityBHealthRemaining <= 0.0f && result.entityAHealthRemaining > 0.0f) {
            return InteractionOutcome::ATTACKER_WINS;
        }
        if (result.entityAHealthRemaining <= 0.0f && result.entityBHealthRemaining > 0.0f) {
            return InteractionOutcome::DEFENDER_WINS;
        }
        if (result.entityAHealthRemaining <= 0.0f && result.entityBHealthRemaining <= 0.0f) {
            return InteractionOutcome::TRADE;
        }

        if (std::abs(healthDiff) < config_.tradeThreshold) {
            return InteractionOutcome::DRAW;
        }

        return healthDiff > 0.0f ? InteractionOutcome::ATTACKER_WINS : InteractionOutcome::DEFENDER_WINS;
    }

    void updateStats(const FInteractionResult& result) {
        stats_.totalInteractions++;
        stats_.totalRoundsPlayed += result.totalRounds;
        stats_.totalCriticalHits += result.critsA + result.critsB;
        stats_.lastInteractionTimestamp = result.timestamp;
        stats_.damageTypeDistribution[result.statsA.primaryDamageType]++;
        stats_.damageTypeDistribution[result.statsB.primaryDamageType]++;

        switch (result.finalOutcome) {
            case InteractionOutcome::ATTACKER_WINS: stats_.attackerWins++; break;
            case InteractionOutcome::DEFENDER_WINS: stats_.defenderWins++; break;
            case InteractionOutcome::TRADE:         stats_.trades++; break;
            case InteractionOutcome::DRAW:          stats_.draws++; break;
            case InteractionOutcome::MISS:          break;
        }
    }
};

}
