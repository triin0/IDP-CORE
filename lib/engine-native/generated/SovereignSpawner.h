#pragma once

#include "SovereignArena.h"
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
#include <array>
#include <set>

namespace Sovereign {

enum class GeneDominance {
    DOMINANT,
    RECESSIVE,
    CODOMINANT
};

inline std::string dominanceToString(GeneDominance d) {
    switch (d) {
        case GeneDominance::DOMINANT:   return "DOMINANT";
        case GeneDominance::RECESSIVE:  return "RECESSIVE";
        case GeneDominance::CODOMINANT: return "CODOMINANT";
    }
    return "UNKNOWN";
}

enum class InheritanceMode {
    PARENT_A,
    PARENT_B,
    BLEND,
    MUTATION
};

inline std::string inheritanceModeToString(InheritanceMode m) {
    switch (m) {
        case InheritanceMode::PARENT_A:  return "PARENT_A";
        case InheritanceMode::PARENT_B:  return "PARENT_B";
        case InheritanceMode::BLEND:     return "BLEND";
        case InheritanceMode::MUTATION:  return "MUTATION";
    }
    return "UNKNOWN";
}

struct GeneticDominanceEntry {
    std::string locusName;
    int byteOffset;
    int byteLength;
    GeneDominance dominance;
    float mutationSensitivity;
};

class GeneticDominanceTable {
public:
    static const std::array<GeneticDominanceEntry, 16>& table() {
        static const std::array<GeneticDominanceEntry, 16> entries = {{
            {"primaryR",     0,  1, GeneDominance::CODOMINANT, 0.02f},
            {"primaryG",     1,  1, GeneDominance::CODOMINANT, 0.02f},
            {"primaryB",     2,  1, GeneDominance::CODOMINANT, 0.02f},
            {"accentR",      3,  1, GeneDominance::RECESSIVE,  0.03f},
            {"accentG",      4,  1, GeneDominance::RECESSIVE,  0.03f},
            {"accentB",      5,  1, GeneDominance::RECESSIVE,  0.03f},
            {"metallic",     6,  1, GeneDominance::DOMINANT,   0.01f},
            {"roughness",    7,  1, GeneDominance::CODOMINANT, 0.01f},
            {"emission",     8,  1, GeneDominance::DOMINANT,   0.02f},
            {"opacity",      9,  1, GeneDominance::RECESSIVE,  0.005f},
            {"meshIndex",   10,  2, GeneDominance::DOMINANT,   0.015f},
            {"scaleX",      12,  2, GeneDominance::CODOMINANT, 0.01f},
            {"scaleY",      14,  2, GeneDominance::CODOMINANT, 0.01f},
            {"scaleZ",      16,  2, GeneDominance::CODOMINANT, 0.01f},
            {"subsurface",  22,  1, GeneDominance::RECESSIVE,  0.02f},
            {"anisotropy",  23,  1, GeneDominance::RECESSIVE,  0.025f}
        }};
        return entries;
    }

    static const GeneticDominanceEntry& getEntry(int index) {
        return table()[index % 16];
    }

    static const GeneticDominanceEntry* findByName(const std::string& name) {
        for (const auto& entry : table()) {
            if (entry.locusName == name) return &entry;
        }
        return nullptr;
    }
};

struct FLocusInheritance {
    std::string locusName;
    int byteOffset;
    int byteLength;
    GeneDominance dominance;
    InheritanceMode mode;
    uint32_t parentAValue;
    uint32_t parentBValue;
    uint32_t childValue;
    bool mutated;
    float mutationRoll;
    float mutationThreshold;
};

struct FSpawnLineage {
    std::string childHash;
    std::string parentAHash;
    std::string parentBHash;
    std::string sovereignSeed;
    std::string lineageHash;
    int generation;
    std::vector<FLocusInheritance> inheritanceMap;
    int64_t birthTimestamp;
    int totalMutations;
    bool flushedToChronos;
    std::string childEntityKey;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"childHash\":\"" << childHash << "\""
            << ",\"generation\":" << generation
            << ",\"parentAHash\":\"" << parentAHash << "\""
            << ",\"parentBHash\":\"" << parentBHash << "\""
            << ",\"sovereignSeed\":\"" << sovereignSeed << "\""
            << ",\"totalMutations\":" << totalMutations
            << "}";
        return oss.str();
    }

    std::string computeLineageHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !lineageHash.empty() && lineageHash == computeLineageHash();
    }
};

struct SpawnerStats {
    int totalSpawns = 0;
    int totalMutations = 0;
    int totalGenerations = 0;
    int maxGenerationReached = 0;
    int64_t lastSpawnTimestamp = 0;
    int totalFlushed = 0;
    std::map<PhenotypeClass, int> offspringClassDistribution;
    std::map<InheritanceMode, int> inheritanceModeDistribution;
};

using SpawnCompleteDelegate = std::function<void(const FSpawnLineage&, const FVisualPhenotype&)>;
using MutationDelegate = std::function<void(const FLocusInheritance&, int locusIndex)>;
using LineageFlushedDelegate = std::function<void(const FSpawnLineage&, bool success)>;

class RecombinationEngine {
public:
    static std::vector<uint8_t> crossover(
        const std::vector<uint8_t>& genomeA,
        const std::vector<uint8_t>& genomeB,
        const std::string& sovereignSeed,
        float mutationRate,
        std::vector<FLocusInheritance>& inheritanceLog) {

        std::vector<uint8_t> childGenome(32, 0);

        std::string crossoverSeed = sovereignSeed + ":crossover";
        DeterministicRNG rng(crossoverSeed);

        const auto& dominanceTable = GeneticDominanceTable::table();

        for (int i = 0; i < 16; i++) {
            const auto& entry = dominanceTable[i];

            FLocusInheritance locus;
            locus.locusName = entry.locusName;
            locus.byteOffset = entry.byteOffset;
            locus.byteLength = entry.byteLength;
            locus.dominance = entry.dominance;
            locus.mutated = false;

            locus.parentAValue = extractLocusValue(genomeA, entry.byteOffset, entry.byteLength);
            locus.parentBValue = extractLocusValue(genomeB, entry.byteOffset, entry.byteLength);

            float effectiveMutationRate = mutationRate * entry.mutationSensitivity * 100.0f;
            effectiveMutationRate = std::min(effectiveMutationRate, 0.10f);
            locus.mutationThreshold = effectiveMutationRate;
            locus.mutationRoll = rng.next01();

            if (locus.mutationRoll < effectiveMutationRate) {
                locus.mode = InheritanceMode::MUTATION;
                locus.mutated = true;
                locus.childValue = generateMutation(rng, entry.byteLength);
            } else {
                float dominanceRoll = rng.next01();

                uint32_t middleBitsA = extractMiddleBits(genomeA, i);
                uint32_t middleBitsB = extractMiddleBits(genomeB, i);
                bool aStronger = middleBitsA >= middleBitsB;

                switch (entry.dominance) {
                    case GeneDominance::DOMINANT:
                        if (aStronger) {
                            locus.mode = InheritanceMode::PARENT_A;
                            locus.childValue = locus.parentAValue;
                        } else {
                            locus.mode = InheritanceMode::PARENT_B;
                            locus.childValue = locus.parentBValue;
                        }
                        break;

                    case GeneDominance::RECESSIVE:
                        if (!aStronger) {
                            locus.mode = InheritanceMode::PARENT_A;
                            locus.childValue = locus.parentAValue;
                        } else {
                            locus.mode = InheritanceMode::PARENT_B;
                            locus.childValue = locus.parentBValue;
                        }
                        break;

                    case GeneDominance::CODOMINANT:
                        if (dominanceRoll < 0.25f) {
                            locus.mode = InheritanceMode::PARENT_A;
                            locus.childValue = locus.parentAValue;
                        } else if (dominanceRoll < 0.50f) {
                            locus.mode = InheritanceMode::PARENT_B;
                            locus.childValue = locus.parentBValue;
                        } else {
                            locus.mode = InheritanceMode::BLEND;
                            locus.childValue = blendValues(locus.parentAValue, locus.parentBValue,
                                                            dominanceRoll, entry.byteLength);
                        }
                        break;
                }
            }

            writeLocusValue(childGenome, entry.byteOffset, entry.byteLength, locus.childValue);
            inheritanceLog.push_back(locus);
        }

        fillUnmappedBytes(childGenome, genomeA, genomeB, rng);

        return childGenome;
    }

private:
    static uint32_t extractLocusValue(const std::vector<uint8_t>& genome, int offset, int length) {
        uint32_t val = 0;
        for (int i = 0; i < length && (offset + i) < static_cast<int>(genome.size()); i++) {
            val = (val << 8) | genome[offset + i];
        }
        return val;
    }

    static uint32_t extractMiddleBits(const std::vector<uint8_t>& genome, int locusIndex) {
        int midOffset = 12 + (locusIndex % 8);
        if (midOffset >= static_cast<int>(genome.size())) midOffset = locusIndex % 32;
        return genome[midOffset];
    }

    static uint32_t generateMutation(DeterministicRNG& rng, int byteLength) {
        uint32_t val = 0;
        for (int i = 0; i < byteLength; i++) {
            val = (val << 8) | static_cast<uint8_t>(rng.next01() * 255.0f);
        }
        return val;
    }

    static uint32_t blendValues(uint32_t a, uint32_t b, float blendFactor, int byteLength) {
        float t = (blendFactor - 0.50f) / 0.50f;
        float fa = static_cast<float>(a);
        float fb = static_cast<float>(b);
        float blended = fa * (1.0f - t) + fb * t;
        uint32_t maxVal = (byteLength == 1) ? 255 : 65535;
        return static_cast<uint32_t>(std::max(0.0f, std::min(static_cast<float>(maxVal), blended)));
    }

    static void writeLocusValue(std::vector<uint8_t>& genome, int offset, int length, uint32_t value) {
        for (int i = length - 1; i >= 0 && (offset + i) < static_cast<int>(genome.size()); i--) {
            genome[offset + i] = static_cast<uint8_t>(value & 0xFF);
            value >>= 8;
        }
    }

    static void fillUnmappedBytes(std::vector<uint8_t>& child,
                                   const std::vector<uint8_t>& parentA,
                                   const std::vector<uint8_t>& parentB,
                                   DeterministicRNG& rng) {
        std::set<int> mappedBytes;
        for (const auto& entry : GeneticDominanceTable::table()) {
            for (int i = 0; i < entry.byteLength; i++) {
                mappedBytes.insert(entry.byteOffset + i);
            }
        }
        for (int i = 0; i < 32; i++) {
            if (mappedBytes.find(i) == mappedBytes.end()) {
                float r = rng.next01();
                if (r < 0.5f) {
                    child[i] = (i < static_cast<int>(parentA.size())) ? parentA[i] : 0;
                } else {
                    child[i] = (i < static_cast<int>(parentB.size())) ? parentB[i] : 0;
                }
            }
        }
    }
};

class SovereignSpawner {
public:
    static SovereignSpawner& Get() {
        static SovereignSpawner instance;
        return instance;
    }

    SovereignSpawner(const SovereignSpawner&) = delete;
    SovereignSpawner& operator=(const SovereignSpawner&) = delete;

    struct SpawnerConfig {
        float baseMutationRate = 0.01f;
        bool autoFlushToChronos = true;
        bool autoForgeChild = true;
        int maxGenerationDepth = 100;
    };

    void configure(const SpawnerConfig& config) {
        std::lock_guard<std::mutex> lock(mutex_);
        config_ = config;
    }

    SpawnerConfig getConfig() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return config_;
    }

    struct SpawnResult {
        FSpawnLineage lineage;
        FVisualPhenotype childPhenotype;
        bool forgeSucceeded;
        bool integrityVerified;
    };

    SpawnResult spawn(const std::string& parentAHash,
                       const std::string& parentBHash,
                       const std::string& sovereignSeed = "",
                       int parentGeneration = 0) {

        SpawnResult result;
        FSpawnLineage lineageCopy;
        FVisualPhenotype phenotypeCopy;
        bool shouldFlush = false;
        bool shouldFireSpawnComplete = false;
        SpawnCompleteDelegate spawnDelegate;
        MutationDelegate mutDelegate;
        std::vector<FLocusInheritance> mutatedLoci;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            std::string effectiveSeed = sovereignSeed.empty()
                ? SovereignSHA256::hash(parentAHash + ":" + parentBHash)
                : sovereignSeed;

            std::vector<uint8_t> genomeA = GeneticGenomeParser::hashToBytes(parentAHash);
            std::vector<uint8_t> genomeB = GeneticGenomeParser::hashToBytes(parentBHash);

            std::vector<FLocusInheritance> inheritanceMap;
            std::vector<uint8_t> childGenome = RecombinationEngine::crossover(
                genomeA, genomeB, effectiveSeed, config_.baseMutationRate, inheritanceMap);

            std::string childHex = bytesToHex(childGenome);
            std::string childHash = SovereignSHA256::hash(childHex + ":" + effectiveSeed);

            FSpawnLineage lineage;
            lineage.childHash = childHash;
            lineage.parentAHash = parentAHash;
            lineage.parentBHash = parentBHash;
            lineage.sovereignSeed = effectiveSeed;
            lineage.generation = parentGeneration + 1;
            lineage.inheritanceMap = inheritanceMap;
            lineage.birthTimestamp = static_cast<int64_t>(std::time(nullptr));
            lineage.totalMutations = 0;
            lineage.flushedToChronos = false;
            lineage.childEntityKey = "spawn:" + childHash.substr(0, 16);

            for (const auto& loc : inheritanceMap) {
                if (loc.mutated) {
                    lineage.totalMutations++;
                    mutatedLoci.push_back(loc);
                }
                stats_.inheritanceModeDistribution[loc.mode]++;
            }

            mutDelegate = mutationDelegate_;

            lineage.lineageHash = lineage.computeLineageHash();

            result.lineage = lineage;
            result.forgeSucceeded = false;
            result.integrityVerified = false;

            if (config_.autoForgeChild) {
                auto& forge = BiologicalForge::Get();
                result.childPhenotype = forge.forge(childHash, lineage.childEntityKey);
                result.forgeSucceeded = true;
                result.integrityVerified = result.childPhenotype.verifyIntegrity();
                stats_.offspringClassDistribution[result.childPhenotype.classification]++;
            }

            lineageRegistry_[childHash] = lineage;
            spawnHistory_.push_back(lineage);

            stats_.totalSpawns++;
            stats_.totalMutations += lineage.totalMutations;
            stats_.lastSpawnTimestamp = lineage.birthTimestamp;
            if (lineage.generation > stats_.maxGenerationReached) {
                stats_.maxGenerationReached = lineage.generation;
                stats_.totalGenerations = lineage.generation;
            }

            shouldFlush = config_.autoFlushToChronos;
            shouldFireSpawnComplete = static_cast<bool>(spawnCompleteDelegate_);
            spawnDelegate = spawnCompleteDelegate_;
            lineageCopy = lineage;
            phenotypeCopy = result.childPhenotype;
        }

        if (mutDelegate) {
            for (int i = 0; i < static_cast<int>(mutatedLoci.size()); i++) {
                mutDelegate(mutatedLoci[i], i);
            }
        }

        if (shouldFireSpawnComplete) {
            spawnDelegate(lineageCopy, phenotypeCopy);
        }

        if (shouldFlush) {
            flushToChronos(lineageCopy);
            result.lineage.flushedToChronos = true;
        }

        return result;
    }

    bool flushToChronos(FSpawnLineage& lineage) {
        auto& chronos = ChronosEngine::Get();

        JsonValue payload(std::map<std::string, JsonValue>{
            {"childHash", JsonValue(lineage.childHash)},
            {"parentA", JsonValue(lineage.parentAHash)},
            {"parentB", JsonValue(lineage.parentBHash)},
            {"seed", JsonValue(lineage.sovereignSeed)},
            {"generation", JsonValue(lineage.generation)},
            {"mutations", JsonValue(lineage.totalMutations)},
            {"lineageHash", JsonValue(lineage.lineageHash)},
            {"entityKey", JsonValue(lineage.childEntityKey)}
        });

        std::string chronosKey = "lineage:" + lineage.childHash.substr(0, 16);
        chronos.enqueue(chronosKey, payload, 0, "spawner-system");

        lineage.flushedToChronos = true;

        LineageFlushedDelegate flushedDelegate;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            stats_.totalFlushed++;
            if (lineageRegistry_.count(lineage.childHash)) {
                lineageRegistry_[lineage.childHash].flushedToChronos = true;
            }
            flushedDelegate = lineageFlushedDelegate_;
        }

        if (flushedDelegate) {
            flushedDelegate(lineage, true);
        }

        return true;
    }

    SpawnResult spawnFromPhenotypes(const FVisualPhenotype& parentA,
                                     const FVisualPhenotype& parentB,
                                     const std::string& sovereignSeed = "") {
        return spawn(parentA.sourceHash, parentB.sourceHash, sovereignSeed, 0);
    }

    SpawnResult spawnMultiGeneration(const std::string& hashA,
                                      const std::string& hashB,
                                      int generations,
                                      const std::string& baseSeed = "") {
        if (generations <= 0) generations = 1;
        if (generations > config_.maxGenerationDepth) generations = config_.maxGenerationDepth;

        std::string currentA = hashA;
        std::string currentB = hashB;
        SpawnResult lastResult;

        for (int gen = 0; gen < generations; gen++) {
            std::string genSeed = baseSeed.empty()
                ? SovereignSHA256::hash(currentA + ":" + currentB + ":" + std::to_string(gen))
                : baseSeed + ":gen" + std::to_string(gen);

            lastResult = spawn(currentA, currentB, genSeed, gen);

            if (gen < generations - 1) {
                currentA = currentB;
                currentB = lastResult.lineage.childHash;
            }
        }

        return lastResult;
    }

    bool verifyDeterminism(const std::string& hashA, const std::string& hashB,
                            const std::string& seed) {
        std::vector<FSpawnLineage> savedHistory;
        std::map<std::string, FSpawnLineage> savedRegistry;
        SpawnerStats savedStats;

        {
            std::lock_guard<std::mutex> lock(mutex_);
            savedHistory = spawnHistory_;
            savedRegistry = lineageRegistry_;
            savedStats = stats_;
            spawnHistory_.clear();
            lineageRegistry_.clear();
            stats_ = SpawnerStats{};
        }

        auto r1 = spawn(hashA, hashB, seed, 0);

        {
            std::lock_guard<std::mutex> lock(mutex_);
            spawnHistory_.clear();
            lineageRegistry_.clear();
            stats_ = SpawnerStats{};
        }
        BiologicalForge::Get().reset();

        auto r2 = spawn(hashA, hashB, seed, 0);

        {
            std::lock_guard<std::mutex> lock(mutex_);
            spawnHistory_ = savedHistory;
            lineageRegistry_ = savedRegistry;
            stats_ = savedStats;
        }

        return r1.lineage.childHash == r2.lineage.childHash &&
               r1.lineage.lineageHash == r2.lineage.lineageHash &&
               r1.lineage.totalMutations == r2.lineage.totalMutations;
    }

    FSpawnLineage getLineageCopy(const std::string& childHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = lineageRegistry_.find(childHash);
        if (it != lineageRegistry_.end()) return it->second;
        return FSpawnLineage{};
    }

    const FSpawnLineage* getLineage(const std::string& childHash) const {
        auto it = lineageRegistry_.find(childHash);
        if (it != lineageRegistry_.end()) return &it->second;
        return nullptr;
    }

    std::vector<std::string> getAncestry(const std::string& childHash, int maxDepth = 10) const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<std::string> chain;
        std::set<std::string> visited;
        std::vector<std::string> queue;
        queue.push_back(childHash);

        while (!queue.empty() && static_cast<int>(chain.size()) < maxDepth) {
            std::string current = queue.front();
            queue.erase(queue.begin());

            if (visited.count(current)) continue;
            visited.insert(current);

            auto it = lineageRegistry_.find(current);
            if (it == lineageRegistry_.end()) continue;

            chain.push_back(current);

            if (!it->second.parentAHash.empty() && !visited.count(it->second.parentAHash)) {
                queue.push_back(it->second.parentAHash);
            }
            if (!it->second.parentBHash.empty() && !visited.count(it->second.parentBHash)) {
                queue.push_back(it->second.parentBHash);
            }
        }
        return chain;
    }

    std::vector<std::string> getOffspring(const std::string& parentHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<std::string> children;
        for (const auto& [hash, lineage] : lineageRegistry_) {
            if (lineage.parentAHash == parentHash || lineage.parentBHash == parentHash) {
                children.push_back(hash);
            }
        }
        return children;
    }

    SpawnerStats stats() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    std::vector<FSpawnLineage> history() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return spawnHistory_;
    }

    std::map<std::string, FSpawnLineage> registry() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return lineageRegistry_;
    }

    void onSpawnComplete(SpawnCompleteDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        spawnCompleteDelegate_ = std::move(d);
    }
    void onMutation(MutationDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        mutationDelegate_ = std::move(d);
    }
    void onLineageFlushed(LineageFlushedDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        lineageFlushedDelegate_ = std::move(d);
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        spawnHistory_.clear();
        lineageRegistry_.clear();
        stats_ = SpawnerStats{};
        config_ = SpawnerConfig{};
        spawnCompleteDelegate_ = nullptr;
        mutationDelegate_ = nullptr;
        lineageFlushedDelegate_ = nullptr;
    }

private:
    SovereignSpawner() = default;
    mutable std::mutex mutex_;
    SpawnerConfig config_;
    SpawnerStats stats_;
    std::vector<FSpawnLineage> spawnHistory_;
    std::map<std::string, FSpawnLineage> lineageRegistry_;
    SpawnCompleteDelegate spawnCompleteDelegate_;
    MutationDelegate mutationDelegate_;
    LineageFlushedDelegate lineageFlushedDelegate_;

    static std::string bytesToHex(const std::vector<uint8_t>& bytes) {
        std::ostringstream oss;
        for (uint8_t b : bytes) {
            oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(b);
        }
        return oss.str();
    }
};

}
