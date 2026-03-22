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

        std::unique_lock<std::mutex> lock(mutex_);
        pendingRoundCallbacks_.clear();

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

        bool shouldFlush = config_.autoFlushToChronos;
        InteractionCompleteDelegate interactionDelegateCopy = interactionCompleteDelegate_;
        RoundResolvedDelegate roundDelegateCopy = roundResolvedDelegate_;
        std::vector<std::tuple<FInteractionRound, int, int>> pendingRoundCallbacks;
        pendingRoundCallbacks.swap(pendingRoundCallbacks_);

        if (shouldFlush) {
            flushToArbiter(result);
        }

        lock.unlock();

        if (roundDelegateCopy) {
            for (const auto& [round, rnum, maxRounds] : pendingRoundCallbacks) {
                roundDelegateCopy(round, rnum, maxRounds);
            }
        }
        if (interactionDelegateCopy) {
            interactionDelegateCopy(result);
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

    void onInteractionComplete(InteractionCompleteDelegate d) { std::lock_guard<std::mutex> lock(mutex_); interactionCompleteDelegate_ = std::move(d); }
    void onRoundResolved(RoundResolvedDelegate d) { std::lock_guard<std::mutex> lock(mutex_); roundResolvedDelegate_ = std::move(d); }
    void onFlush(ArenaFlushDelegate d) { std::lock_guard<std::mutex> lock(mutex_); flushDelegate_ = std::move(d); }

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
    std::vector<std::tuple<FInteractionRound, int, int>> pendingRoundCallbacks_;
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
            pendingRoundCallbacks_.emplace_back(round, roundNum, config_.maxRounds * 2);
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

// ============================================================
// FRAME-BY-FRAME REPLAY INSTRUCTION SYSTEM
// ============================================================

enum class ReplayActionType {
    IDLE,
    MOVE_FORWARD,
    MOVE_BACKWARD,
    ATTACK_WIND_UP,
    ATTACK_STRIKE,
    HIT_REACT,
    DODGE,
    CRITICAL_FLASH,
    BLOCK,
    KO_COLLAPSE,
    VICTORY_POSE,
    DEFEAT_SLUMP,
    DRAW_STANDOFF,
    TRADE_MUTUAL_KO,
    ENTRANCE,
    TYPE_EFFECT
};

inline std::string replayActionToString(ReplayActionType a) {
    switch (a) {
        case ReplayActionType::IDLE:            return "IDLE";
        case ReplayActionType::MOVE_FORWARD:    return "MOVE_FORWARD";
        case ReplayActionType::MOVE_BACKWARD:   return "MOVE_BACKWARD";
        case ReplayActionType::ATTACK_WIND_UP:  return "ATTACK_WIND_UP";
        case ReplayActionType::ATTACK_STRIKE:   return "ATTACK_STRIKE";
        case ReplayActionType::HIT_REACT:       return "HIT_REACT";
        case ReplayActionType::DODGE:           return "DODGE";
        case ReplayActionType::CRITICAL_FLASH:  return "CRITICAL_FLASH";
        case ReplayActionType::BLOCK:           return "BLOCK";
        case ReplayActionType::KO_COLLAPSE:     return "KO_COLLAPSE";
        case ReplayActionType::VICTORY_POSE:    return "VICTORY_POSE";
        case ReplayActionType::DEFEAT_SLUMP:    return "DEFEAT_SLUMP";
        case ReplayActionType::DRAW_STANDOFF:   return "DRAW_STANDOFF";
        case ReplayActionType::TRADE_MUTUAL_KO: return "TRADE_MUTUAL_KO";
        case ReplayActionType::ENTRANCE:        return "ENTRANCE";
        case ReplayActionType::TYPE_EFFECT:     return "TYPE_EFFECT";
    }
    return "IDLE";
}

struct FReplayInstruction {
    int frameIndex = 0;
    std::string actorKey;
    ReplayActionType action = ReplayActionType::IDLE;
    float positionDeltaX = 0.0f;
    float positionDeltaY = 0.0f;
    float positionDeltaZ = 0.0f;
    float rotationYaw = 0.0f;
    float rotationPitch = 0.0f;
    float rotationRoll = 0.0f;
    std::string animationClip;
    float durationFrames = 1.0f;
    std::string vfxTag;
    float intensity = 1.0f;
    float damageValue = 0.0f;
    bool isCritical = false;
    DamageType damageType = DamageType::KINETIC;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"action\":\"" << replayActionToString(action) << "\""
            << ",\"actorKey\":\"" << actorKey << "\""
            << ",\"animClip\":\"" << animationClip << "\""
            << ",\"critical\":" << (isCritical ? "true" : "false")
            << ",\"damageType\":\"" << damageTypeToString(damageType) << "\""
            << ",\"damageValue\":" << damageValue
            << ",\"durationFrames\":" << durationFrames
            << ",\"frameIndex\":" << frameIndex
            << ",\"intensity\":" << intensity
            << ",\"posDelta\":[" << positionDeltaX << "," << positionDeltaY << "," << positionDeltaZ << "]"
            << ",\"rotation\":[" << rotationYaw << "," << rotationPitch << "," << rotationRoll << "]"
            << ",\"vfxTag\":\"" << vfxTag << "\""
            << "}";
        return oss.str();
    }
};

struct FReplayTimeline {
    std::string sessionId;
    std::string entityAKey;
    std::string entityBKey;
    int frameRate = 60;
    int totalFrames = 0;
    float entityAStartX = -3.0f;
    float entityAStartZ = 0.0f;
    float entityBStartX = 3.0f;
    float entityBStartZ = 0.0f;
    std::vector<FReplayInstruction> instructions;
    InteractionOutcome finalOutcome = InteractionOutcome::DRAW;
    std::string timelineHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"entityAKey\":\"" << entityAKey << "\""
            << ",\"entityBKey\":\"" << entityBKey << "\""
            << ",\"finalOutcome\":\"" << outcomeToString(finalOutcome) << "\""
            << ",\"frameRate\":" << frameRate
            << ",\"instructionCount\":" << static_cast<int>(instructions.size())
            << ",\"sessionId\":\"" << sessionId << "\""
            << ",\"totalFrames\":" << totalFrames
            << "}";
        return oss.str();
    }

    void computeHash() {
        std::ostringstream full;
        full << canonicalize();
        for (const auto& inst : instructions) {
            full << inst.canonicalize();
        }
        timelineHash = SovereignSHA256::hash(full.str());
    }

    bool verifyIntegrity() const {
        std::ostringstream full;
        full << canonicalize();
        for (const auto& inst : instructions) {
            full << inst.canonicalize();
        }
        return !timelineHash.empty() && timelineHash == SovereignSHA256::hash(full.str());
    }
};

class ReplayGenerator {
public:
    static constexpr int FRAMES_PER_ROUND = 90;
    static constexpr int ENTRANCE_FRAMES = 60;
    static constexpr int WIND_UP_FRAMES = 15;
    static constexpr int STRIKE_FRAMES = 8;
    static constexpr int HIT_REACT_FRAMES = 20;
    static constexpr int DODGE_FRAMES = 18;
    static constexpr int CRITICAL_FLASH_FRAMES = 12;
    static constexpr int KO_FRAMES = 45;
    static constexpr int VICTORY_FRAMES = 60;
    static constexpr int OUTCOME_FRAMES = 60;
    static constexpr int IDLE_GAP_FRAMES = 10;
    static constexpr float APPROACH_DISTANCE = 1.5f;
    static constexpr float RETREAT_DISTANCE = 0.8f;

    static FReplayTimeline generateTimeline(const FInteractionResult& result) {
        FReplayTimeline timeline;
        timeline.sessionId = result.arenaSessionId;
        timeline.entityAKey = result.entityAKey;
        timeline.entityBKey = result.entityBKey;
        timeline.finalOutcome = result.finalOutcome;
        timeline.frameRate = 60;

        int currentFrame = 0;

        currentFrame = generateEntrance(timeline, result, currentFrame);

        for (const auto& round : result.rounds) {
            currentFrame = generateRoundInstructions(timeline, round, result, currentFrame);
        }

        currentFrame = generateOutcome(timeline, result, currentFrame);

        timeline.totalFrames = currentFrame;
        timeline.computeHash();
        return timeline;
    }

    static bool verifyTimelineDeterminism(const FInteractionResult& result) {
        auto t1 = generateTimeline(result);
        auto t2 = generateTimeline(result);
        return t1.timelineHash == t2.timelineHash &&
               t1.totalFrames == t2.totalFrames &&
               t1.instructions.size() == t2.instructions.size();
    }

private:
    static int generateEntrance(FReplayTimeline& timeline, const FInteractionResult& result, int frame) {
        FReplayInstruction entranceA;
        entranceA.frameIndex = frame;
        entranceA.actorKey = result.entityAKey;
        entranceA.action = ReplayActionType::ENTRANCE;
        entranceA.positionDeltaX = APPROACH_DISTANCE;
        entranceA.durationFrames = static_cast<float>(ENTRANCE_FRAMES);
        entranceA.animationClip = "AM_Entrance_Left";
        entranceA.vfxTag = "VFX_Spawn_" + damageTypeToString(result.statsA.primaryDamageType);
        entranceA.damageType = result.statsA.primaryDamageType;
        timeline.instructions.push_back(entranceA);

        FReplayInstruction entranceB;
        entranceB.frameIndex = frame;
        entranceB.actorKey = result.entityBKey;
        entranceB.action = ReplayActionType::ENTRANCE;
        entranceB.positionDeltaX = -APPROACH_DISTANCE;
        entranceB.durationFrames = static_cast<float>(ENTRANCE_FRAMES);
        entranceB.animationClip = "AM_Entrance_Right";
        entranceB.vfxTag = "VFX_Spawn_" + damageTypeToString(result.statsB.primaryDamageType);
        entranceB.damageType = result.statsB.primaryDamageType;
        timeline.instructions.push_back(entranceB);

        return frame + ENTRANCE_FRAMES;
    }

    static int generateRoundInstructions(FReplayTimeline& timeline, const FInteractionRound& round,
                                          const FInteractionResult& result, int frame) {
        const std::string& atkKey = round.attackerKey;
        const std::string& defKey = round.defenderKey;
        DamageType atkDamageType = (atkKey == result.entityAKey)
            ? result.statsA.primaryDamageType
            : result.statsB.primaryDamageType;

        FReplayInstruction approach;
        approach.frameIndex = frame;
        approach.actorKey = atkKey;
        approach.action = ReplayActionType::MOVE_FORWARD;
        approach.positionDeltaX = (atkKey == result.entityAKey) ? APPROACH_DISTANCE : -APPROACH_DISTANCE;
        approach.durationFrames = static_cast<float>(WIND_UP_FRAMES);
        approach.animationClip = "AM_Walk_Forward";
        timeline.instructions.push_back(approach);
        frame += WIND_UP_FRAMES;

        FReplayInstruction windUp;
        windUp.frameIndex = frame;
        windUp.actorKey = atkKey;
        windUp.action = ReplayActionType::ATTACK_WIND_UP;
        windUp.durationFrames = static_cast<float>(WIND_UP_FRAMES);
        windUp.animationClip = "AM_Attack_WindUp_" + damageTypeToString(atkDamageType);
        windUp.damageType = atkDamageType;
        timeline.instructions.push_back(windUp);
        frame += WIND_UP_FRAMES;

        FReplayInstruction strike;
        strike.frameIndex = frame;
        strike.actorKey = atkKey;
        strike.action = ReplayActionType::ATTACK_STRIKE;
        strike.durationFrames = static_cast<float>(STRIKE_FRAMES);
        strike.animationClip = "AM_Attack_Strike_" + damageTypeToString(atkDamageType);
        strike.damageValue = round.damageDealt;
        strike.isCritical = round.critical;
        strike.damageType = atkDamageType;
        strike.vfxTag = "VFX_Strike_" + damageTypeToString(atkDamageType);
        strike.intensity = round.critical ? 2.0f : 1.0f;
        timeline.instructions.push_back(strike);
        frame += STRIKE_FRAMES;

        if (round.hit) {
            if (round.critical) {
                FReplayInstruction critFlash;
                critFlash.frameIndex = frame;
                critFlash.actorKey = defKey;
                critFlash.action = ReplayActionType::CRITICAL_FLASH;
                critFlash.durationFrames = static_cast<float>(CRITICAL_FLASH_FRAMES);
                critFlash.animationClip = "AM_Critical_Impact";
                critFlash.vfxTag = "VFX_Critical_" + damageTypeToString(atkDamageType);
                critFlash.damageValue = round.damageDealt;
                critFlash.isCritical = true;
                critFlash.intensity = 3.0f;
                timeline.instructions.push_back(critFlash);
                frame += CRITICAL_FLASH_FRAMES;
            }

            FReplayInstruction hitReact;
            hitReact.frameIndex = frame;
            hitReact.actorKey = defKey;
            hitReact.action = ReplayActionType::HIT_REACT;
            hitReact.positionDeltaX = (defKey == result.entityAKey) ? -RETREAT_DISTANCE : RETREAT_DISTANCE;
            hitReact.durationFrames = static_cast<float>(HIT_REACT_FRAMES);
            hitReact.animationClip = round.critical ? "AM_HitReact_Heavy" : "AM_HitReact_Light";
            hitReact.damageValue = round.damageDealt;
            hitReact.vfxTag = "VFX_Impact_" + damageTypeToString(atkDamageType);
            timeline.instructions.push_back(hitReact);
            frame += HIT_REACT_FRAMES;

            FReplayInstruction typeEffect;
            typeEffect.frameIndex = frame;
            typeEffect.actorKey = defKey;
            typeEffect.action = ReplayActionType::TYPE_EFFECT;
            typeEffect.durationFrames = 10.0f;
            typeEffect.damageType = atkDamageType;
            float mult = FDamageMatrix::getMultiplier(atkDamageType, 
                (defKey == result.entityAKey) ? result.statsA.primaryDamageType : result.statsB.primaryDamageType);
            typeEffect.intensity = mult;
            typeEffect.vfxTag = "VFX_TypeEffect_" + FDamageMatrix::getEffectivenessLabel(mult);
            timeline.instructions.push_back(typeEffect);
            frame += 10;
        } else {
            FReplayInstruction dodge;
            dodge.frameIndex = frame;
            dodge.actorKey = defKey;
            dodge.action = ReplayActionType::DODGE;
            dodge.positionDeltaX = (defKey == result.entityAKey) ? -RETREAT_DISTANCE : RETREAT_DISTANCE;
            dodge.positionDeltaZ = 0.5f;
            dodge.durationFrames = static_cast<float>(DODGE_FRAMES);
            dodge.animationClip = "AM_Dodge_Side";
            dodge.vfxTag = "VFX_Dodge_Trail";
            timeline.instructions.push_back(dodge);
            frame += DODGE_FRAMES;
        }

        FReplayInstruction retreat;
        retreat.frameIndex = frame;
        retreat.actorKey = atkKey;
        retreat.action = ReplayActionType::MOVE_BACKWARD;
        retreat.positionDeltaX = (atkKey == result.entityAKey) ? -RETREAT_DISTANCE : RETREAT_DISTANCE;
        retreat.durationFrames = static_cast<float>(IDLE_GAP_FRAMES);
        retreat.animationClip = "AM_Walk_Backward";
        timeline.instructions.push_back(retreat);
        frame += IDLE_GAP_FRAMES;

        return frame;
    }

    static int generateOutcome(FReplayTimeline& timeline, const FInteractionResult& result, int frame) {
        std::string winnerKey, loserKey;
        switch (result.finalOutcome) {
            case InteractionOutcome::ATTACKER_WINS:
                winnerKey = result.entityAKey;
                loserKey = result.entityBKey;
                break;
            case InteractionOutcome::DEFENDER_WINS:
                winnerKey = result.entityBKey;
                loserKey = result.entityAKey;
                break;
            default:
                break;
        }

        if (result.finalOutcome == InteractionOutcome::ATTACKER_WINS ||
            result.finalOutcome == InteractionOutcome::DEFENDER_WINS) {
            FReplayInstruction ko;
            ko.frameIndex = frame;
            ko.actorKey = loserKey;
            ko.action = ReplayActionType::KO_COLLAPSE;
            ko.durationFrames = static_cast<float>(KO_FRAMES);
            ko.animationClip = "AM_KO_Collapse";
            ko.vfxTag = "VFX_KO_Dust";
            ko.positionDeltaY = -0.5f;
            timeline.instructions.push_back(ko);

            FReplayInstruction victory;
            victory.frameIndex = frame;
            victory.actorKey = winnerKey;
            victory.action = ReplayActionType::VICTORY_POSE;
            victory.durationFrames = static_cast<float>(VICTORY_FRAMES);
            victory.animationClip = "AM_Victory_Pose";
            victory.vfxTag = "VFX_Victory_Aura";
            victory.intensity = 2.0f;
            timeline.instructions.push_back(victory);

            frame += std::max(KO_FRAMES, VICTORY_FRAMES);
        } else if (result.finalOutcome == InteractionOutcome::TRADE) {
            FReplayInstruction koA;
            koA.frameIndex = frame;
            koA.actorKey = result.entityAKey;
            koA.action = ReplayActionType::TRADE_MUTUAL_KO;
            koA.durationFrames = static_cast<float>(KO_FRAMES);
            koA.animationClip = "AM_Trade_KO";
            koA.vfxTag = "VFX_Trade_Explosion";
            timeline.instructions.push_back(koA);

            FReplayInstruction koB;
            koB.frameIndex = frame;
            koB.actorKey = result.entityBKey;
            koB.action = ReplayActionType::TRADE_MUTUAL_KO;
            koB.durationFrames = static_cast<float>(KO_FRAMES);
            koB.animationClip = "AM_Trade_KO";
            koB.vfxTag = "VFX_Trade_Explosion";
            timeline.instructions.push_back(koB);

            frame += KO_FRAMES;
        } else {
            FReplayInstruction standoffA;
            standoffA.frameIndex = frame;
            standoffA.actorKey = result.entityAKey;
            standoffA.action = ReplayActionType::DRAW_STANDOFF;
            standoffA.durationFrames = static_cast<float>(OUTCOME_FRAMES);
            standoffA.animationClip = "AM_Draw_Standoff";
            standoffA.vfxTag = "VFX_Draw_Tension";
            timeline.instructions.push_back(standoffA);

            FReplayInstruction standoffB;
            standoffB.frameIndex = frame;
            standoffB.actorKey = result.entityBKey;
            standoffB.action = ReplayActionType::DRAW_STANDOFF;
            standoffB.durationFrames = static_cast<float>(OUTCOME_FRAMES);
            standoffB.animationClip = "AM_Draw_Standoff";
            standoffB.vfxTag = "VFX_Draw_Tension";
            timeline.instructions.push_back(standoffB);

            frame += OUTCOME_FRAMES;
        }

        return frame;
    }
};

// ============================================================
// HITBOX-GENOME COLLISION MAPPING
// ============================================================

enum class CollisionVolumeType {
    SPHERE,
    CAPSULE,
    BOX,
    CONVEX_HULL
};

inline std::string collisionVolumeTypeToString(CollisionVolumeType t) {
    switch (t) {
        case CollisionVolumeType::SPHERE:      return "SPHERE";
        case CollisionVolumeType::CAPSULE:      return "CAPSULE";
        case CollisionVolumeType::BOX:          return "BOX";
        case CollisionVolumeType::CONVEX_HULL:  return "CONVEX_HULL";
    }
    return "SPHERE";
}

struct FCollisionVolume {
    CollisionVolumeType volumeType = CollisionVolumeType::SPHERE;
    float extentX = 1.0f;
    float extentY = 1.0f;
    float extentZ = 1.0f;
    float radius = 1.0f;
    float capsuleHalfHeight = 1.0f;
    float offsetX = 0.0f;
    float offsetY = 0.0f;
    float offsetZ = 0.0f;
    float surfaceArea = 0.0f;
    float volume = 0.0f;
    std::string collisionProfile;
    std::string collisionHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"capsuleHalfHeight\":" << capsuleHalfHeight
            << ",\"collisionProfile\":\"" << collisionProfile << "\""
            << ",\"extentX\":" << extentX
            << ",\"extentY\":" << extentY
            << ",\"extentZ\":" << extentZ
            << ",\"offsetX\":" << offsetX
            << ",\"offsetY\":" << offsetY
            << ",\"offsetZ\":" << offsetZ
            << ",\"radius\":" << radius
            << ",\"surfaceArea\":" << surfaceArea
            << ",\"volume\":" << volume
            << ",\"volumeType\":\"" << collisionVolumeTypeToString(volumeType) << "\""
            << "}";
        return oss.str();
    }

    void computeHash() {
        collisionHash = SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !collisionHash.empty() && collisionHash == SovereignSHA256::hash(canonicalize());
    }
};

struct FHitboxSet {
    std::string entityKey;
    FCollisionVolume bodyVolume;
    FCollisionVolume headVolume;
    FCollisionVolume strikeVolume;
    float totalHitboxVolume = 0.0f;
    float totalSurfaceArea = 0.0f;
    std::string hitboxSetHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"body\":" << bodyVolume.canonicalize()
            << ",\"entityKey\":\"" << entityKey << "\""
            << ",\"head\":" << headVolume.canonicalize()
            << ",\"strike\":" << strikeVolume.canonicalize()
            << ",\"totalHitboxVolume\":" << totalHitboxVolume
            << ",\"totalSurfaceArea\":" << totalSurfaceArea
            << "}";
        return oss.str();
    }

    void computeHash() {
        hitboxSetHash = SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !hitboxSetHash.empty() && hitboxSetHash == SovereignSHA256::hash(canonicalize());
    }
};

class HitboxGenomeMapper {
public:
    static FHitboxSet mapFromPhenotype(const FVisualPhenotype& phenotype, const std::string& entityKey) {
        FHitboxSet hitbox;
        hitbox.entityKey = entityKey;

        const auto& morph = phenotype.morphology;
        CollisionVolumeType baseType = meshFamilyToVolumeType(morph.baseMeshIndex);

        hitbox.bodyVolume = createBodyVolume(morph, baseType, phenotype.classification);
        hitbox.headVolume = createHeadVolume(morph, baseType);
        hitbox.strikeVolume = createStrikeVolume(morph, baseType, phenotype.classification);

        hitbox.totalHitboxVolume = hitbox.bodyVolume.volume + hitbox.headVolume.volume + hitbox.strikeVolume.volume;
        hitbox.totalSurfaceArea = hitbox.bodyVolume.surfaceArea + hitbox.headVolume.surfaceArea + hitbox.strikeVolume.surfaceArea;

        hitbox.bodyVolume.computeHash();
        hitbox.headVolume.computeHash();
        hitbox.strikeVolume.computeHash();
        hitbox.computeHash();

        return hitbox;
    }

    static bool verifyDeterminism(const FVisualPhenotype& phenotype, const std::string& entityKey) {
        auto h1 = mapFromPhenotype(phenotype, entityKey);
        auto h2 = mapFromPhenotype(phenotype, entityKey);
        return h1.hitboxSetHash == h2.hitboxSetHash;
    }

private:
    static float clamp(float v, float lo, float hi) {
        return std::max(lo, std::min(hi, v));
    }

    static constexpr float PI = 3.14159265f;

    static CollisionVolumeType meshFamilyToVolumeType(uint16_t meshIndex) {
        uint16_t family = meshIndex % 16;
        switch (family) {
            case 0:  return CollisionVolumeType::SPHERE;
            case 1:  return CollisionVolumeType::BOX;
            case 2:  return CollisionVolumeType::CAPSULE;
            case 3:  return CollisionVolumeType::SPHERE;
            case 4:  return CollisionVolumeType::CAPSULE;
            case 5:  return CollisionVolumeType::CAPSULE;
            case 6:  return CollisionVolumeType::SPHERE;
            case 7:  return CollisionVolumeType::BOX;
            case 8:  return CollisionVolumeType::CAPSULE;
            case 9:  return CollisionVolumeType::SPHERE;
            case 10: return CollisionVolumeType::CONVEX_HULL;
            case 11: return CollisionVolumeType::CONVEX_HULL;
            case 12: return CollisionVolumeType::CONVEX_HULL;
            case 13: return CollisionVolumeType::SPHERE;
            case 14: return CollisionVolumeType::SPHERE;
            case 15: return CollisionVolumeType::SPHERE;
            default: return CollisionVolumeType::SPHERE;
        }
    }

    static FCollisionVolume createBodyVolume(const FMorphologyDescriptor& morph, CollisionVolumeType baseType, PhenotypeClass cls) {
        FCollisionVolume vol;
        vol.volumeType = baseType;
        vol.collisionProfile = "PhysicsBody_" + phenotypeClassToString(cls);

        float sx = clamp(morph.scaleX, 0.1f, 5.0f);
        float sy = clamp(morph.scaleY, 0.1f, 5.0f);
        float sz = clamp(morph.scaleZ, 0.1f, 5.0f);

        switch (baseType) {
            case CollisionVolumeType::SPHERE:
                vol.radius = (sx + sy + sz) / 3.0f * 50.0f;
                vol.extentX = vol.radius;
                vol.extentY = vol.radius;
                vol.extentZ = vol.radius;
                vol.volume = (4.0f / 3.0f) * PI * vol.radius * vol.radius * vol.radius;
                vol.surfaceArea = 4.0f * PI * vol.radius * vol.radius;
                break;
            case CollisionVolumeType::BOX:
                vol.extentX = sx * 50.0f;
                vol.extentY = sy * 50.0f;
                vol.extentZ = sz * 50.0f;
                vol.radius = std::sqrt(vol.extentX * vol.extentX + vol.extentY * vol.extentY + vol.extentZ * vol.extentZ);
                vol.volume = vol.extentX * 2.0f * vol.extentY * 2.0f * vol.extentZ * 2.0f;
                vol.surfaceArea = 2.0f * (vol.extentX * vol.extentY + vol.extentY * vol.extentZ + vol.extentX * vol.extentZ) * 4.0f;
                break;
            case CollisionVolumeType::CAPSULE:
                vol.radius = (sx + sz) / 2.0f * 40.0f;
                vol.capsuleHalfHeight = sy * 60.0f;
                vol.extentX = vol.radius;
                vol.extentY = vol.capsuleHalfHeight;
                vol.extentZ = vol.radius;
                vol.volume = PI * vol.radius * vol.radius * (vol.capsuleHalfHeight * 2.0f - (2.0f * vol.radius / 3.0f));
                vol.surfaceArea = 2.0f * PI * vol.radius * (2.0f * vol.capsuleHalfHeight);
                break;
            case CollisionVolumeType::CONVEX_HULL:
                vol.extentX = sx * 45.0f;
                vol.extentY = sy * 45.0f;
                vol.extentZ = sz * 45.0f;
                vol.radius = (vol.extentX + vol.extentY + vol.extentZ) / 3.0f;
                vol.volume = vol.extentX * vol.extentY * vol.extentZ * 4.0f;
                vol.surfaceArea = 2.0f * (vol.extentX * vol.extentY + vol.extentY * vol.extentZ + vol.extentX * vol.extentZ) * 3.0f;
                break;
        }

        return vol;
    }

    static FCollisionVolume createHeadVolume(const FMorphologyDescriptor& morph, CollisionVolumeType baseType) {
        FCollisionVolume vol;
        vol.volumeType = CollisionVolumeType::SPHERE;
        vol.collisionProfile = "Headshot_Critical";

        float avgScale = (morph.scaleX + morph.scaleY + morph.scaleZ) / 3.0f;
        vol.radius = clamp(avgScale * 20.0f, 5.0f, 60.0f);
        vol.extentX = vol.radius;
        vol.extentY = vol.radius;
        vol.extentZ = vol.radius;

        float bodyHeight = morph.scaleY * 100.0f;
        vol.offsetY = bodyHeight * 0.85f;

        vol.volume = (4.0f / 3.0f) * PI * vol.radius * vol.radius * vol.radius;
        vol.surfaceArea = 4.0f * PI * vol.radius * vol.radius;

        return vol;
    }

    static FCollisionVolume createStrikeVolume(const FMorphologyDescriptor& morph, CollisionVolumeType baseType, PhenotypeClass cls) {
        FCollisionVolume vol;
        vol.volumeType = CollisionVolumeType::CAPSULE;
        vol.collisionProfile = "StrikeZone_" + phenotypeClassToString(cls);

        float reach = (morph.scaleX + morph.scaleY) / 2.0f;
        vol.radius = clamp(reach * 15.0f, 5.0f, 50.0f);
        vol.capsuleHalfHeight = clamp(reach * 40.0f, 15.0f, 120.0f);
        vol.extentX = vol.radius;
        vol.extentY = vol.capsuleHalfHeight;
        vol.extentZ = vol.radius;

        vol.offsetX = morph.scaleX * 60.0f;
        vol.offsetY = morph.scaleY * 40.0f;

        vol.volume = PI * vol.radius * vol.radius * (vol.capsuleHalfHeight * 2.0f - (2.0f * vol.radius / 3.0f));
        vol.surfaceArea = 2.0f * PI * vol.radius * (2.0f * vol.capsuleHalfHeight);

        return vol;
    }
};

// ============================================================
// THE SCAR SYSTEM — COMBAT CHRONICLE
// ============================================================

enum class ScarType {
    VICTORY_MARK,
    DEFEAT_WOUND,
    TRADE_SCAR,
    DRAW_BADGE,
    CRITICAL_SURVIVOR,
    TYPE_ADVANTAGE_MARK
};

inline std::string scarTypeToString(ScarType s) {
    switch (s) {
        case ScarType::VICTORY_MARK:        return "VICTORY_MARK";
        case ScarType::DEFEAT_WOUND:        return "DEFEAT_WOUND";
        case ScarType::TRADE_SCAR:          return "TRADE_SCAR";
        case ScarType::DRAW_BADGE:          return "DRAW_BADGE";
        case ScarType::CRITICAL_SURVIVOR:   return "CRITICAL_SURVIVOR";
        case ScarType::TYPE_ADVANTAGE_MARK: return "TYPE_ADVANTAGE_MARK";
    }
    return "VICTORY_MARK";
}

enum class VeteranRank {
    ROOKIE,
    WARRIOR,
    VETERAN,
    CHAMPION,
    LEGEND
};

inline std::string veteranRankToString(VeteranRank r) {
    switch (r) {
        case VeteranRank::ROOKIE:   return "ROOKIE";
        case VeteranRank::WARRIOR:  return "WARRIOR";
        case VeteranRank::VETERAN:  return "VETERAN";
        case VeteranRank::CHAMPION: return "CHAMPION";
        case VeteranRank::LEGEND:   return "LEGEND";
    }
    return "ROOKIE";
}

inline VeteranRank computeVeteranRank(int totalFights) {
    if (totalFights >= 50) return VeteranRank::LEGEND;
    if (totalFights >= 30) return VeteranRank::CHAMPION;
    if (totalFights >= 15) return VeteranRank::VETERAN;
    if (totalFights >= 5)  return VeteranRank::WARRIOR;
    return VeteranRank::ROOKIE;
}

struct FCombatScar {
    ScarType type = ScarType::VICTORY_MARK;
    std::string opponentHash;
    PhenotypeClass opponentClass = PhenotypeClass::UNKNOWN;
    float damageTaken = 0.0f;
    float damageDealt = 0.0f;
    int roundCount = 0;
    bool survivedCritical = false;
    bool hadTypeAdvantage = false;
    int64_t timestamp = 0;
    std::string arenaSessionId;
    std::string scarHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"arenaSessionId\":\"" << arenaSessionId << "\""
            << ",\"damageDealt\":" << damageDealt
            << ",\"damageTaken\":" << damageTaken
            << ",\"hadTypeAdvantage\":" << (hadTypeAdvantage ? "true" : "false")
            << ",\"opponentClass\":\"" << phenotypeClassToString(opponentClass) << "\""
            << ",\"opponentHash\":\"" << opponentHash << "\""
            << ",\"roundCount\":" << roundCount
            << ",\"survivedCritical\":" << (survivedCritical ? "true" : "false")
            << ",\"timestamp\":" << timestamp
            << ",\"type\":\"" << scarTypeToString(type) << "\""
            << "}";
        return oss.str();
    }

    void computeHash() {
        scarHash = SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !scarHash.empty() && scarHash == SovereignSHA256::hash(canonicalize());
    }
};

struct FCombatChronicle {
    std::string entityHash;
    int wins = 0;
    int losses = 0;
    int trades = 0;
    int draws = 0;
    float totalDamageDealt = 0.0f;
    float totalDamageTaken = 0.0f;
    int totalCriticalsSurvived = 0;
    int totalCriticalsDealt = 0;
    int typeAdvantageWins = 0;
    int64_t experiencePoints = 0;
    VeteranRank rank = VeteranRank::ROOKIE;
    std::vector<FCombatScar> scars;
    std::string chronicleHash;
    int64_t lastCombatTimestamp = 0;

    int totalFights() const { return wins + losses + trades + draws; }

    float winRate() const {
        int total = totalFights();
        return total > 0 ? static_cast<float>(wins) / static_cast<float>(total) : 0.0f;
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"draws\":" << draws
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"experiencePoints\":" << experiencePoints
            << ",\"losses\":" << losses
            << ",\"rank\":\"" << veteranRankToString(rank) << "\""
            << ",\"scarCount\":" << static_cast<int>(scars.size())
            << ",\"totalCriticalsDealt\":" << totalCriticalsDealt
            << ",\"totalCriticalsSurvived\":" << totalCriticalsSurvived
            << ",\"totalDamageDealt\":" << totalDamageDealt
            << ",\"totalDamageTaken\":" << totalDamageTaken
            << ",\"trades\":" << trades
            << ",\"typeAdvantageWins\":" << typeAdvantageWins
            << ",\"wins\":" << wins
            << "}";
        return oss.str();
    }

    void computeHash() {
        std::ostringstream full;
        full << canonicalize();
        for (const auto& scar : scars) {
            full << scar.canonicalize();
        }
        chronicleHash = SovereignSHA256::hash(full.str());
    }

    bool verifyIntegrity() const {
        std::ostringstream full;
        full << canonicalize();
        for (const auto& scar : scars) {
            full << scar.canonicalize();
        }
        return !chronicleHash.empty() && chronicleHash == SovereignSHA256::hash(full.str());
    }
};

struct ExperienceConfig {
    int64_t baseXpPerFight = 100;
    int64_t victoryBonus = 200;
    int64_t criticalHitBonus = 50;
    int64_t typeAdvantageBonus = 75;
    float damageDealtMultiplier = 2.0f;
    float survivalBonus = 1.5f;
};

using ScarAcquiredDelegate = std::function<void(const std::string& entityHash, const FCombatScar& scar)>;
using RankUpDelegate = std::function<void(const std::string& entityHash, VeteranRank oldRank, VeteranRank newRank)>;
using ChronicleUpdatedDelegate = std::function<void(const std::string& entityHash, const FCombatChronicle& chronicle)>;

class CombatChronicleEngine {
public:
    static CombatChronicleEngine& Get() {
        static CombatChronicleEngine instance;
        return instance;
    }

    CombatChronicleEngine(const CombatChronicleEngine&) = delete;
    CombatChronicleEngine& operator=(const CombatChronicleEngine&) = delete;

    void configureExperience(const ExperienceConfig& config) {
        std::lock_guard<std::mutex> lock(mutex_);
        xpConfig_ = config;
    }

    ExperienceConfig getExperienceConfig() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return xpConfig_;
    }

    void postCombatFlush(const FInteractionResult& result,
                          const FVisualPhenotype& phenotypeA,
                          const FVisualPhenotype& phenotypeB) {
        ScarAcquiredDelegate scarDelegateCopy;
        RankUpDelegate rankDelegateCopy;
        ChronicleUpdatedDelegate chronicleDelegateCopy;
        FCombatScar copiedScarA, copiedScarB;
        FCombatChronicle copiedChronicleA, copiedChronicleB;
        bool aRankedUp = false, bRankedUp = false;
        VeteranRank copiedOldRankA = VeteranRank::ROOKIE, copiedOldRankB = VeteranRank::ROOKIE;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            auto& chronicleA = getOrCreateChronicle(result.entityAKey);
            auto& chronicleB = getOrCreateChronicle(result.entityBKey);

            float typeMultA = FDamageMatrix::getMultiplier(result.statsA.primaryDamageType, result.statsB.primaryDamageType);
            float typeMultB = FDamageMatrix::getMultiplier(result.statsB.primaryDamageType, result.statsA.primaryDamageType);
            bool aHadAdvantage = typeMultA > 1.1f;
            bool bHadAdvantage = typeMultB > 1.1f;

            FCombatScar scarA = buildScar(result, result.entityAKey, result.entityBKey,
                                           phenotypeB.classification,
                                           result.totalDamageDealtByB, result.totalDamageDealtByA,
                                           result.critsB > 0, aHadAdvantage);
            FCombatScar scarB = buildScar(result, result.entityBKey, result.entityAKey,
                                           phenotypeA.classification,
                                           result.totalDamageDealtByA, result.totalDamageDealtByB,
                                           result.critsA > 0, bHadAdvantage);

            switch (result.finalOutcome) {
                case InteractionOutcome::ATTACKER_WINS:
                    scarA.type = ScarType::VICTORY_MARK;
                    scarB.type = ScarType::DEFEAT_WOUND;
                    chronicleA.wins++;
                    chronicleB.losses++;
                    if (aHadAdvantage) chronicleA.typeAdvantageWins++;
                    break;
                case InteractionOutcome::DEFENDER_WINS:
                    scarA.type = ScarType::DEFEAT_WOUND;
                    scarB.type = ScarType::VICTORY_MARK;
                    chronicleA.losses++;
                    chronicleB.wins++;
                    if (bHadAdvantage) chronicleB.typeAdvantageWins++;
                    break;
                case InteractionOutcome::TRADE:
                    scarA.type = ScarType::TRADE_SCAR;
                    scarB.type = ScarType::TRADE_SCAR;
                    chronicleA.trades++;
                    chronicleB.trades++;
                    break;
                case InteractionOutcome::DRAW:
                case InteractionOutcome::MISS:
                    scarA.type = ScarType::DRAW_BADGE;
                    scarB.type = ScarType::DRAW_BADGE;
                    chronicleA.draws++;
                    chronicleB.draws++;
                    break;
            }

            if (result.critsB > 0 && result.entityAHealthRemaining > 0.0f) {
                scarA.survivedCritical = true;
                chronicleA.totalCriticalsSurvived++;
            }
            if (result.critsA > 0 && result.entityBHealthRemaining > 0.0f) {
                scarB.survivedCritical = true;
                chronicleB.totalCriticalsSurvived++;
            }
            chronicleA.totalCriticalsDealt += result.critsA;
            chronicleB.totalCriticalsDealt += result.critsB;

            scarA.computeHash();
            scarB.computeHash();

            chronicleA.scars.push_back(scarA);
            chronicleB.scars.push_back(scarB);

            chronicleA.totalDamageDealt += result.totalDamageDealtByA;
            chronicleA.totalDamageTaken += result.totalDamageDealtByB;
            chronicleB.totalDamageDealt += result.totalDamageDealtByB;
            chronicleB.totalDamageTaken += result.totalDamageDealtByA;

            chronicleA.lastCombatTimestamp = result.timestamp;
            chronicleB.lastCombatTimestamp = result.timestamp;

            VeteranRank oldRankA = chronicleA.rank;
            VeteranRank oldRankB = chronicleB.rank;

            int64_t xpA = computeExperience(result, true, aHadAdvantage);
            int64_t xpB = computeExperience(result, false, bHadAdvantage);
            chronicleA.experiencePoints += xpA;
            chronicleB.experiencePoints += xpB;

            chronicleA.rank = computeVeteranRank(chronicleA.totalFights());
            chronicleB.rank = computeVeteranRank(chronicleB.totalFights());

            chronicleA.computeHash();
            chronicleB.computeHash();

            flushChronicleToChronos(chronicleA);
            flushChronicleToChronos(chronicleB);

            stats_.totalScarsCreated += 2;
            stats_.totalXpAwarded += xpA + xpB;
            stats_.totalChroniclesUpdated += 2;
            if (chronicleA.rank != oldRankA) stats_.totalRankUps++;
            if (chronicleB.rank != oldRankB) stats_.totalRankUps++;

            scarDelegateCopy = scarDelegate_;
            rankDelegateCopy = rankDelegate_;
            chronicleDelegateCopy = chronicleDelegate_;

            copiedScarA = scarA;
            copiedScarB = scarB;
            copiedChronicleA = chronicleA;
            copiedChronicleB = chronicleB;
            aRankedUp = (chronicleA.rank != oldRankA);
            bRankedUp = (chronicleB.rank != oldRankB);
            copiedOldRankA = oldRankA;
            copiedOldRankB = oldRankB;
        }

        if (scarDelegateCopy) {
            scarDelegateCopy(result.entityAKey, copiedScarA);
            scarDelegateCopy(result.entityBKey, copiedScarB);
        }
        if (rankDelegateCopy) {
            if (aRankedUp) rankDelegateCopy(result.entityAKey, copiedOldRankA, copiedChronicleA.rank);
            if (bRankedUp) rankDelegateCopy(result.entityBKey, copiedOldRankB, copiedChronicleB.rank);
        }
        if (chronicleDelegateCopy) {
            chronicleDelegateCopy(result.entityAKey, copiedChronicleA);
            chronicleDelegateCopy(result.entityBKey, copiedChronicleB);
        }
    }

    const FCombatChronicle* getChronicle(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = chronicles_.find(entityHash);
        if (it != chronicles_.end()) return &it->second;
        return nullptr;
    }

    bool hasChronicle(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        return chronicles_.find(entityHash) != chronicles_.end();
    }

    size_t chronicleCount() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return chronicles_.size();
    }

    bool verifyChronicleIntegrity(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = chronicles_.find(entityHash);
        if (it == chronicles_.end()) return false;
        return it->second.verifyIntegrity();
    }

    struct ChronicleStats {
        int totalScarsCreated = 0;
        int64_t totalXpAwarded = 0;
        int totalChroniclesUpdated = 0;
        int totalRankUps = 0;
        int totalChronosFlushed = 0;
    };

    ChronicleStats getStats() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    void onScarAcquired(ScarAcquiredDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        scarDelegate_ = std::move(d);
    }
    void onRankUp(RankUpDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        rankDelegate_ = std::move(d);
    }
    void onChronicleUpdated(ChronicleUpdatedDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        chronicleDelegate_ = std::move(d);
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        chronicles_.clear();
        stats_ = ChronicleStats{};
        scarDelegate_ = nullptr;
        rankDelegate_ = nullptr;
        chronicleDelegate_ = nullptr;
    }

private:
    CombatChronicleEngine() = default;
    mutable std::mutex mutex_;
    std::map<std::string, FCombatChronicle> chronicles_;
    ExperienceConfig xpConfig_;
    ChronicleStats stats_;
    ScarAcquiredDelegate scarDelegate_;
    RankUpDelegate rankDelegate_;
    ChronicleUpdatedDelegate chronicleDelegate_;

    FCombatChronicle& getOrCreateChronicle(const std::string& entityHash) {
        auto it = chronicles_.find(entityHash);
        if (it == chronicles_.end()) {
            FCombatChronicle c;
            c.entityHash = entityHash;
            chronicles_[entityHash] = c;
            return chronicles_[entityHash];
        }
        return it->second;
    }

    FCombatScar buildScar(const FInteractionResult& result,
                           const std::string& selfKey, const std::string& oppKey,
                           PhenotypeClass oppClass,
                           float damageTaken, float damageDealt,
                           bool survivedCrit, bool hadAdvantage) {
        FCombatScar scar;
        scar.opponentHash = oppKey;
        scar.opponentClass = oppClass;
        scar.damageTaken = damageTaken;
        scar.damageDealt = damageDealt;
        scar.roundCount = result.totalRounds;
        scar.survivedCritical = survivedCrit;
        scar.hadTypeAdvantage = hadAdvantage;
        scar.timestamp = result.timestamp;
        scar.arenaSessionId = result.arenaSessionId;
        return scar;
    }

    int64_t computeExperience(const FInteractionResult& result, bool isEntityA, bool hadTypeAdvantage) {
        int64_t xp = xpConfig_.baseXpPerFight;

        bool won = (isEntityA && result.finalOutcome == InteractionOutcome::ATTACKER_WINS) ||
                   (!isEntityA && result.finalOutcome == InteractionOutcome::DEFENDER_WINS);
        if (won) xp += xpConfig_.victoryBonus;

        float dmgDealt = isEntityA ? result.totalDamageDealtByA : result.totalDamageDealtByB;
        xp += static_cast<int64_t>(dmgDealt * xpConfig_.damageDealtMultiplier);

        int crits = isEntityA ? result.critsA : result.critsB;
        xp += crits * xpConfig_.criticalHitBonus;

        if (hadTypeAdvantage && won) xp += xpConfig_.typeAdvantageBonus;

        float healthRemaining = isEntityA ? result.entityAHealthRemaining : result.entityBHealthRemaining;
        if (healthRemaining > 0.0f && healthRemaining < 20.0f) {
            xp = static_cast<int64_t>(static_cast<float>(xp) * xpConfig_.survivalBonus);
        }

        return xp;
    }

    void flushChronicleToChronos(const FCombatChronicle& chronicle) {
        auto& chronos = ChronosEngine::Get();

        std::vector<JsonValue> scarJsonList;
        for (const auto& scar : chronicle.scars) {
            scarJsonList.push_back(JsonValue(std::map<std::string, JsonValue>{
                {"type", JsonValue(scarTypeToString(scar.type))},
                {"opponentHash", JsonValue(scar.opponentHash)},
                {"opponentClass", JsonValue(phenotypeClassToString(scar.opponentClass))},
                {"damageTaken", JsonValue(static_cast<double>(scar.damageTaken))},
                {"damageDealt", JsonValue(static_cast<double>(scar.damageDealt))},
                {"roundCount", JsonValue(scar.roundCount)},
                {"survivedCritical", JsonValue(scar.survivedCritical)},
                {"scarHash", JsonValue(scar.scarHash)}
            }));
        }

        JsonValue payload(std::map<std::string, JsonValue>{
            {"entityHash", JsonValue(chronicle.entityHash)},
            {"wins", JsonValue(chronicle.wins)},
            {"losses", JsonValue(chronicle.losses)},
            {"trades", JsonValue(chronicle.trades)},
            {"draws", JsonValue(chronicle.draws)},
            {"totalDamageDealt", JsonValue(static_cast<double>(chronicle.totalDamageDealt))},
            {"totalDamageTaken", JsonValue(static_cast<double>(chronicle.totalDamageTaken))},
            {"experiencePoints", JsonValue(static_cast<int>(chronicle.experiencePoints))},
            {"rank", JsonValue(veteranRankToString(chronicle.rank))},
            {"totalFights", JsonValue(chronicle.totalFights())},
            {"chronicleHash", JsonValue(chronicle.chronicleHash)},
            {"scars", JsonValue(scarJsonList)}
        });

        std::string chronosKey = "scar:" + chronicle.entityHash;
        chronos.enqueue(chronosKey, payload, 0, "chronicle-engine");
        stats_.totalChronosFlushed++;
    }
};

}
