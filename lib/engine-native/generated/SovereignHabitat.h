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

namespace Sovereign {

enum class BiomeType {
    VOLCANIC,
    ARCTIC,
    CRYSTALLINE,
    ABYSSAL,
    VERDANT,
    ETHEREAL_VOID,
    UNKNOWN
};

inline std::string biomeTypeToString(BiomeType b) {
    switch (b) {
        case BiomeType::VOLCANIC:       return "VOLCANIC";
        case BiomeType::ARCTIC:         return "ARCTIC";
        case BiomeType::CRYSTALLINE:    return "CRYSTALLINE";
        case BiomeType::ABYSSAL:        return "ABYSSAL";
        case BiomeType::VERDANT:        return "VERDANT";
        case BiomeType::ETHEREAL_VOID:  return "ETHEREAL_VOID";
        case BiomeType::UNKNOWN:        return "UNKNOWN";
    }
    return "UNKNOWN";
}

enum class SynergyGrade {
    PERFECT,
    STRONG,
    NEUTRAL,
    WEAK,
    HOSTILE
};

inline std::string synergyGradeToString(SynergyGrade s) {
    switch (s) {
        case SynergyGrade::PERFECT:  return "PERFECT";
        case SynergyGrade::STRONG:   return "STRONG";
        case SynergyGrade::NEUTRAL:  return "NEUTRAL";
        case SynergyGrade::WEAK:     return "WEAK";
        case SynergyGrade::HOSTILE:  return "HOSTILE";
    }
    return "NEUTRAL";
}

struct FAtmosphericLocus {
    float fogDensity = 0.0f;
    float lightTemperature = 5500.0f;
    float skyboxEmission = 0.0f;
    float ambientIntensity = 0.5f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"ambientIntensity\":" << ambientIntensity
            << ",\"fogDensity\":" << fogDensity
            << ",\"lightTemperature\":" << lightTemperature
            << ",\"skyboxEmission\":" << skyboxEmission << "}";
        return oss.str();
    }
};

struct FThermalLocus {
    float globalHeatIndex = 0.5f;
    float surfaceRadiance = 0.0f;
    float convectionRate = 0.0f;
    float thermalConductivity = 0.5f;

    bool isVolcanic() const { return globalHeatIndex > 0.75f; }
    bool isArctic() const { return globalHeatIndex < 0.25f; }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"convectionRate\":" << convectionRate
            << ",\"globalHeatIndex\":" << globalHeatIndex
            << ",\"surfaceRadiance\":" << surfaceRadiance
            << ",\"thermalConductivity\":" << thermalConductivity << "}";
        return oss.str();
    }
};

struct FTopographyLocus {
    float displacementAmplitude = 0.0f;
    float gravityMultiplier = 1.0f;
    float terrainRoughness = 0.5f;
    float elevationRange = 100.0f;
    float erosionFactor = 0.0f;
    float tectonicStress = 0.0f;
    float caveDensity = 0.0f;
    float waterTableDepth = 0.5f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"caveDensity\":" << caveDensity
            << ",\"displacementAmplitude\":" << displacementAmplitude
            << ",\"elevationRange\":" << elevationRange
            << ",\"erosionFactor\":" << erosionFactor
            << ",\"gravityMultiplier\":" << gravityMultiplier
            << ",\"tectonicStress\":" << tectonicStress
            << ",\"terrainRoughness\":" << terrainRoughness
            << ",\"waterTableDepth\":" << waterTableDepth << "}";
        return oss.str();
    }
};

struct FResourceLocus {
    float nourishmentLevel = 0.5f;
    float mineralDensity = 0.0f;
    float energyFlux = 0.0f;
    float toxicity = 0.0f;
    float oxygenSaturation = 1.0f;
    float photonAbundance = 0.5f;
    float crystallineResonance = 0.0f;
    float volatileConcentration = 0.0f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"crystallineResonance\":" << crystallineResonance
            << ",\"energyFlux\":" << energyFlux
            << ",\"mineralDensity\":" << mineralDensity
            << ",\"nourishmentLevel\":" << nourishmentLevel
            << ",\"oxygenSaturation\":" << oxygenSaturation
            << ",\"photonAbundance\":" << photonAbundance
            << ",\"toxicity\":" << toxicity
            << ",\"volatileConcentration\":" << volatileConcentration << "}";
        return oss.str();
    }
};

struct FHabitatState {
    std::string worldSeed;
    std::string environmentHash;
    std::vector<uint8_t> environmentGenome;
    BiomeType biome = BiomeType::UNKNOWN;
    std::string biomeName;
    int epochId = 0;

    FAtmosphericLocus atmosphere;
    FThermalLocus thermal;
    FTopographyLocus topography;
    FResourceLocus resources;

    std::string habitatHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"atmosphere\":" << atmosphere.canonicalize()
            << ",\"biome\":\"" << biomeName << "\""
            << ",\"environmentHash\":\"" << environmentHash << "\""
            << ",\"epochId\":" << epochId
            << ",\"resources\":" << resources.canonicalize()
            << ",\"thermal\":" << thermal.canonicalize()
            << ",\"topography\":" << topography.canonicalize()
            << ",\"worldSeed\":\"" << worldSeed << "\"}";
        return oss.str();
    }

    std::string computeHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void updateHash() {
        habitatHash = computeHash();
    }

    bool verifyIntegrity() const {
        return !habitatHash.empty() && habitatHash == computeHash();
    }
};

struct FSynergyResult {
    float coefficient = 0.0f;
    SynergyGrade grade = SynergyGrade::NEUTRAL;
    std::string gradeName;
    float attackModifier = 1.0f;
    float defenseModifier = 1.0f;
    float speedModifier = 1.0f;
    float accuracyModifier = 1.0f;
    float evasionModifier = 1.0f;
    float thermalStress = 0.0f;
    std::string entityHash;
    std::string environmentHash;
    std::string synergyHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"accuracyModifier\":" << accuracyModifier
            << ",\"attackModifier\":" << attackModifier
            << ",\"coefficient\":" << coefficient
            << ",\"defenseModifier\":" << defenseModifier
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"environmentHash\":\"" << environmentHash << "\""
            << ",\"evasionModifier\":" << evasionModifier
            << ",\"grade\":\"" << gradeName << "\""
            << ",\"speedModifier\":" << speedModifier
            << ",\"thermalStress\":" << thermalStress << "}";
        return oss.str();
    }

    std::string computeHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void updateHash() {
        synergyHash = computeHash();
    }

    bool verifyIntegrity() const {
        return !synergyHash.empty() && synergyHash == computeHash();
    }
};

struct HabitatArbiterStats {
    int totalHabitatsGenerated = 0;
    int totalSynergyCalculations = 0;
    int totalEpochTransitions = 0;
    int64_t lastGeneratedTimestamp = 0;
    std::map<BiomeType, int> biomeDistribution;
    std::map<SynergyGrade, int> synergyGradeDistribution;
};

struct EnvironmentLocusEntry {
    std::string locusName;
    int byteOffset;
    int byteLength;
};

class EnvironmentGenomeTable {
public:
    static const std::array<EnvironmentLocusEntry, 4>& atmospheric() {
        static const std::array<EnvironmentLocusEntry, 4> entries = {{
            {"fogDensity",       0, 1},
            {"lightTempHigh",    1, 1},
            {"lightTempLow",     2, 1},
            {"skyboxEmission",   3, 1}
        }};
        return entries;
    }

    static const std::array<EnvironmentLocusEntry, 4>& thermal() {
        static const std::array<EnvironmentLocusEntry, 4> entries = {{
            {"globalHeatIndex",     4, 1},
            {"surfaceRadiance",     5, 1},
            {"convectionRate",      6, 1},
            {"thermalConductivity", 7, 1}
        }};
        return entries;
    }

    static const std::array<EnvironmentLocusEntry, 8>& topographic() {
        static const std::array<EnvironmentLocusEntry, 8> entries = {{
            {"displacementAmp",  8,  1},
            {"gravityHigh",      9,  1},
            {"gravityLow",       10, 1},
            {"terrainRoughness", 11, 1},
            {"elevationHigh",    12, 1},
            {"elevationLow",     13, 1},
            {"erosionFactor",    14, 1},
            {"tectonicStress",   15, 1}
        }};
        return entries;
    }

    static const std::array<EnvironmentLocusEntry, 8>& resource() {
        static const std::array<EnvironmentLocusEntry, 8> entries = {{
            {"nourishmentLevel",      16, 1},
            {"mineralDensity",        17, 1},
            {"energyFlux",            18, 1},
            {"toxicity",              19, 1},
            {"oxygenSaturation",      20, 1},
            {"photonAbundance",       21, 1},
            {"crystallineResonance",  22, 1},
            {"volatileConcentration", 23, 1}
        }};
        return entries;
    }

    static int totalMappedBytes() { return 24; }
};

class SynergyMatrix {
public:
    static float getAffinityScore(PhenotypeClass entityClass, BiomeType biome) {
        static const float matrix[6][6] = {
            /*               VOLCANIC  ARCTIC  CRYSTAL  ABYSSAL  VERDANT  ETHEREAL */
            /* ORGANIC   */ {  -0.10f,  0.00f,  -0.05f,  -0.15f,   0.20f,   0.05f },
            /* CRYSTALLINE*/{  -0.20f,  0.15f,   0.25f,   0.00f,  -0.05f,   0.10f },
            /* METALLIC  */ {   0.15f, -0.10f,   0.05f,   0.10f,  -0.05f,   0.00f },
            /* ETHEREAL  */ {   0.00f,  0.05f,   0.10f,   0.15f,  -0.10f,   0.25f },
            /* VOLCANIC  */ {   0.25f, -0.20f,  -0.15f,   0.05f,  -0.10f,   0.00f },
            /* AQUEOUS   */ {  -0.15f,  0.10f,   0.00f,   0.25f,   0.15f,  -0.05f }
        };

        int row = static_cast<int>(entityClass);
        int col = static_cast<int>(biome);
        if (row < 0 || row >= 6 || col < 0 || col >= 6) return 0.0f;
        return matrix[row][col];
    }
};

using HabitatGeneratedDelegate = std::function<void(const FHabitatState&)>;
using SynergyCalculatedDelegate = std::function<void(const FSynergyResult&, const std::string& entityKey)>;
using EpochTransitionDelegate = std::function<void(int oldEpoch, int newEpoch, const FHabitatState&)>;

class SovereignHabitatArbiter {
public:
    static SovereignHabitatArbiter& Get() {
        static SovereignHabitatArbiter instance;
        return instance;
    }

    SovereignHabitatArbiter(const SovereignHabitatArbiter&) = delete;
    SovereignHabitatArbiter& operator=(const SovereignHabitatArbiter&) = delete;

    static BiomeType classifyBiomePublic(const FHabitatState& h) {
        return classifyBiome(h);
    }

    FHabitatState generateHabitat(const std::string& worldSeed, int epochId = 0) {
        FHabitatState habitat;
        HabitatGeneratedDelegate genDelegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            std::string epochSeed = worldSeed + ":epoch:" + std::to_string(epochId);
            std::string envHash = SovereignSHA256::hash(epochSeed);

            std::vector<uint8_t> genome = GeneticGenomeParser::hashToBytes(envHash);

            habitat.worldSeed = worldSeed;
            habitat.environmentHash = envHash;
            habitat.environmentGenome = genome;
            habitat.epochId = epochId;

            habitat.atmosphere.fogDensity = static_cast<float>(genome[0]) / 255.0f;
            uint16_t lightTempRaw = (static_cast<uint16_t>(genome[1]) << 8) | genome[2];
            habitat.atmosphere.lightTemperature = 2000.0f + (static_cast<float>(lightTempRaw) / 65535.0f) * 10000.0f;
            habitat.atmosphere.skyboxEmission = static_cast<float>(genome[3]) / 255.0f * 5.0f;
            habitat.atmosphere.ambientIntensity = 0.2f + static_cast<float>(genome[24]) / 255.0f * 0.8f;

            habitat.thermal.globalHeatIndex = static_cast<float>(genome[4]) / 255.0f;
            habitat.thermal.surfaceRadiance = static_cast<float>(genome[5]) / 255.0f * 10.0f;
            habitat.thermal.convectionRate = static_cast<float>(genome[6]) / 255.0f;
            habitat.thermal.thermalConductivity = static_cast<float>(genome[7]) / 255.0f;

            habitat.topography.displacementAmplitude = static_cast<float>(genome[8]) / 255.0f * 50.0f;
            uint16_t gravRaw = (static_cast<uint16_t>(genome[9]) << 8) | genome[10];
            habitat.topography.gravityMultiplier = 0.1f + (static_cast<float>(gravRaw) / 65535.0f) * 3.9f;
            habitat.topography.terrainRoughness = static_cast<float>(genome[11]) / 255.0f;
            uint16_t elevRaw = (static_cast<uint16_t>(genome[12]) << 8) | genome[13];
            habitat.topography.elevationRange = static_cast<float>(elevRaw) / 65535.0f * 5000.0f;
            habitat.topography.erosionFactor = static_cast<float>(genome[14]) / 255.0f;
            habitat.topography.tectonicStress = static_cast<float>(genome[15]) / 255.0f;
            habitat.topography.caveDensity = static_cast<float>(genome[25]) / 255.0f * 0.5f;
            habitat.topography.waterTableDepth = static_cast<float>(genome[26]) / 255.0f;

            habitat.resources.nourishmentLevel = static_cast<float>(genome[16]) / 255.0f;
            habitat.resources.mineralDensity = static_cast<float>(genome[17]) / 255.0f;
            habitat.resources.energyFlux = static_cast<float>(genome[18]) / 255.0f * 10.0f;
            habitat.resources.toxicity = static_cast<float>(genome[19]) / 255.0f;
            habitat.resources.oxygenSaturation = 0.5f + static_cast<float>(genome[20]) / 255.0f * 0.5f;
            habitat.resources.photonAbundance = static_cast<float>(genome[21]) / 255.0f;
            habitat.resources.crystallineResonance = static_cast<float>(genome[22]) / 255.0f;
            habitat.resources.volatileConcentration = static_cast<float>(genome[23]) / 255.0f;

            habitat.biome = classifyBiome(habitat);
            habitat.biomeName = biomeTypeToString(habitat.biome);
            habitat.updateHash();

            habitatCache_[envHash] = habitat;
            activeHabitat_ = habitat;

            stats_.totalHabitatsGenerated++;
            stats_.lastGeneratedTimestamp = static_cast<int64_t>(std::time(nullptr));
            stats_.biomeDistribution[habitat.biome]++;

            genDelegate = habitatGeneratedDelegate_;
        }

        if (genDelegate) {
            genDelegate(habitat);
        }

        return habitat;
    }

    FHabitatState transitionEpoch(const std::string& worldSeed, int newEpochId) {
        int oldEpoch = 0;
        EpochTransitionDelegate epochDelegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);
            oldEpoch = activeHabitat_.epochId;
            epochDelegate = epochTransitionDelegate_;
        }

        FHabitatState newHabitat = generateHabitat(worldSeed, newEpochId);

        {
            std::lock_guard<std::mutex> lock(mutex_);
            stats_.totalEpochTransitions++;
        }

        if (epochDelegate) {
            epochDelegate(oldEpoch, newEpochId, newHabitat);
        }

        return newHabitat;
    }

    FSynergyResult computeSynergy(const FVisualPhenotype& entity,
                                   const FHabitatState& habitat) {
        FSynergyResult result;
        SynergyCalculatedDelegate synDelegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            result.entityHash = entity.sourceHash;
            result.environmentHash = habitat.environmentHash;

            std::vector<uint8_t> entityGenome = GeneticGenomeParser::hashToBytes(entity.sourceHash);

            float genomicOverlap = computeGenomicOverlap(entityGenome, habitat.environmentGenome);

            float classAffinity = SynergyMatrix::getAffinityScore(entity.classification, habitat.biome);

            float thermalDelta = computeThermalDelta(entity, habitat.thermal);
            result.thermalStress = thermalDelta;

            float resourceFit = computeResourceFit(entity, habitat.resources);

            result.coefficient = (genomicOverlap * 0.35f) +
                                 (classAffinity * 0.30f) +
                                 ((1.0f - thermalDelta) * 0.20f) +
                                 (resourceFit * 0.15f);

            result.coefficient = std::max(-1.0f, std::min(1.0f, result.coefficient));

            result.grade = gradeFromCoefficient(result.coefficient);
            result.gradeName = synergyGradeToString(result.grade);

            computeStatModifiers(result);

            result.updateHash();

            stats_.totalSynergyCalculations++;
            stats_.synergyGradeDistribution[result.grade]++;

            synDelegate = synergyCalculatedDelegate_;
        }

        if (synDelegate) {
            synDelegate(result, entity.sourceHash);
        }

        return result;
    }

    FCombatStats applySynergy(const FCombatStats& baseStats, const FSynergyResult& synergy) const {
        FCombatStats modified = baseStats;
        modified.attackPower *= synergy.attackModifier;
        modified.defense *= synergy.defenseModifier;
        modified.speed *= synergy.speedModifier;
        modified.accuracy *= synergy.accuracyModifier;
        modified.evasion *= synergy.evasionModifier;

        modified.attackPower = std::max(0.0f, std::min(100.0f, modified.attackPower));
        modified.defense = std::max(0.0f, std::min(100.0f, modified.defense));
        modified.speed = std::max(0.0f, std::min(100.0f, modified.speed));
        modified.accuracy = std::max(0.0f, std::min(1.0f, modified.accuracy));
        modified.evasion = std::max(0.0f, std::min(1.0f, modified.evasion));

        return modified;
    }

    FHabitatState getActiveHabitat() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return activeHabitat_;
    }

    FHabitatState getCachedHabitat(const std::string& envHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = habitatCache_.find(envHash);
        if (it != habitatCache_.end()) return it->second;
        return FHabitatState{};
    }

    bool verifyHabitatDeterminism(const std::string& worldSeed, int epochId) {
        FHabitatState h1 = generateHabitat(worldSeed, epochId);
        {
            std::lock_guard<std::mutex> lock(mutex_);
            habitatCache_.erase(h1.environmentHash);
        }
        FHabitatState h2 = generateHabitat(worldSeed, epochId);
        return h1.habitatHash == h2.habitatHash &&
               h1.environmentHash == h2.environmentHash &&
               h1.biome == h2.biome;
    }

    bool verifySynergyDeterminism(const FVisualPhenotype& entity, const FHabitatState& habitat) {
        FSynergyResult s1 = computeSynergy(entity, habitat);
        FSynergyResult s2 = computeSynergy(entity, habitat);
        return s1.synergyHash == s2.synergyHash &&
               s1.coefficient == s2.coefficient &&
               s1.grade == s2.grade;
    }

    std::string generateUE5PostProcess(const FHabitatState& h) const {
        std::ostringstream oss;
        oss << "USTRUCT(BlueprintType)\n";
        oss << "struct FHabitatPostProcessOverride {\n";
        oss << "    GENERATED_BODY()\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float FogDensity = " << h.atmosphere.fogDensity << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float LightTemperature = " << h.atmosphere.lightTemperature << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float SkyboxEmission = " << h.atmosphere.skyboxEmission << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float GlobalHeatIndex = " << h.thermal.globalHeatIndex << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float GravityMultiplier = " << h.topography.gravityMultiplier << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float TerrainDisplacement = " << h.topography.displacementAmplitude << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    FString BiomeName = TEXT(\"" << h.biomeName << "\");\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    FString EnvironmentHash = TEXT(\"" << h.environmentHash << "\");\n";
        oss << "};\n";
        return oss.str();
    }

    HabitatArbiterStats stats() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    void onHabitatGenerated(HabitatGeneratedDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        habitatGeneratedDelegate_ = std::move(d);
    }
    void onSynergyCalculated(SynergyCalculatedDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        synergyCalculatedDelegate_ = std::move(d);
    }
    void onEpochTransition(EpochTransitionDelegate d) {
        std::lock_guard<std::mutex> lock(mutex_);
        epochTransitionDelegate_ = std::move(d);
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        activeHabitat_ = FHabitatState{};
        habitatCache_.clear();
        stats_ = HabitatArbiterStats{};
        habitatGeneratedDelegate_ = nullptr;
        synergyCalculatedDelegate_ = nullptr;
        epochTransitionDelegate_ = nullptr;
    }

private:
    SovereignHabitatArbiter() = default;
    mutable std::mutex mutex_;
    FHabitatState activeHabitat_;
    std::map<std::string, FHabitatState> habitatCache_;
    HabitatArbiterStats stats_;
    HabitatGeneratedDelegate habitatGeneratedDelegate_;
    SynergyCalculatedDelegate synergyCalculatedDelegate_;
    EpochTransitionDelegate epochTransitionDelegate_;

    static BiomeType classifyBiome(const FHabitatState& h) {
        float heat = h.thermal.globalHeatIndex;
        float mineral = h.resources.mineralDensity;
        float crystal = h.resources.crystallineResonance;
        float oxygen = h.resources.oxygenSaturation;
        float nourish = h.resources.nourishmentLevel;
        float volatile_ = h.resources.volatileConcentration;

        if (heat > 0.75f && volatile_ > 0.5f) return BiomeType::VOLCANIC;
        if (heat < 0.25f && crystal > 0.4f) return BiomeType::CRYSTALLINE;
        if (heat < 0.25f) return BiomeType::ARCTIC;
        if (oxygen < 0.65f && mineral > 0.5f) return BiomeType::ABYSSAL;
        if (nourish > 0.6f && oxygen > 0.75f) return BiomeType::VERDANT;
        if (h.atmosphere.fogDensity > 0.7f || h.atmosphere.skyboxEmission > 3.0f)
            return BiomeType::ETHEREAL_VOID;
        return BiomeType::VERDANT;
    }

    static float computeGenomicOverlap(const std::vector<uint8_t>& entityGenome,
                                        const std::vector<uint8_t>& envGenome) {
        int matchingBytes = 0;
        int totalBytes = std::min(static_cast<int>(entityGenome.size()),
                                  static_cast<int>(envGenome.size()));
        totalBytes = std::min(totalBytes, 24);

        for (int i = 0; i < totalBytes; i++) {
            int diff = std::abs(static_cast<int>(entityGenome[i]) - static_cast<int>(envGenome[i]));
            if (diff < 32) matchingBytes++;
        }

        return static_cast<float>(matchingBytes) / static_cast<float>(totalBytes) - 0.5f;
    }

    static float computeThermalDelta(const FVisualPhenotype& entity, const FThermalLocus& thermal) {
        float entityHeatAffinity = 0.5f;

        switch (entity.classification) {
            case PhenotypeClass::VOLCANIC:
                entityHeatAffinity = 0.9f;
                break;
            case PhenotypeClass::CRYSTALLINE:
                entityHeatAffinity = 0.1f;
                break;
            case PhenotypeClass::METALLIC:
                entityHeatAffinity = 0.7f;
                break;
            case PhenotypeClass::ETHEREAL:
                entityHeatAffinity = 0.5f;
                break;
            case PhenotypeClass::ORGANIC:
                entityHeatAffinity = 0.4f;
                break;
            case PhenotypeClass::AQUEOUS:
                entityHeatAffinity = 0.3f;
                break;
            default:
                entityHeatAffinity = 0.5f;
                break;
        }

        return std::abs(entityHeatAffinity - thermal.globalHeatIndex);
    }

    static float computeResourceFit(const FVisualPhenotype& entity, const FResourceLocus& resources) {
        float fit = 0.0f;

        fit += resources.nourishmentLevel * 0.3f;
        fit += (1.0f - resources.toxicity) * 0.2f;
        fit += resources.oxygenSaturation * 0.2f;

        switch (entity.classification) {
            case PhenotypeClass::CRYSTALLINE:
                fit += resources.crystallineResonance * 0.3f;
                break;
            case PhenotypeClass::METALLIC:
                fit += resources.mineralDensity * 0.3f;
                break;
            case PhenotypeClass::ETHEREAL:
                fit += resources.energyFlux / 10.0f * 0.3f;
                break;
            case PhenotypeClass::VOLCANIC:
                fit += resources.volatileConcentration * 0.3f;
                break;
            case PhenotypeClass::ORGANIC:
                fit += resources.photonAbundance * 0.3f;
                break;
            case PhenotypeClass::AQUEOUS:
                fit += (1.0f - resources.mineralDensity) * 0.15f +
                       resources.oxygenSaturation * 0.15f;
                break;
            default:
                break;
        }

        return std::max(0.0f, std::min(1.0f, fit));
    }

    static SynergyGrade gradeFromCoefficient(float coeff) {
        if (coeff >= 0.30f)  return SynergyGrade::PERFECT;
        if (coeff >= 0.10f)  return SynergyGrade::STRONG;
        if (coeff >= -0.10f) return SynergyGrade::NEUTRAL;
        if (coeff >= -0.25f) return SynergyGrade::WEAK;
        return SynergyGrade::HOSTILE;
    }

    static void computeStatModifiers(FSynergyResult& result) {
        float c = result.coefficient;

        result.attackModifier = 1.0f + c * 0.15f;
        result.defenseModifier = 1.0f + c * 0.10f;
        result.speedModifier = 1.0f - result.thermalStress * 0.20f + c * 0.10f;
        result.accuracyModifier = 1.0f + c * 0.05f;
        result.evasionModifier = 1.0f + c * 0.08f;

        result.attackModifier = std::max(0.70f, std::min(1.30f, result.attackModifier));
        result.defenseModifier = std::max(0.80f, std::min(1.20f, result.defenseModifier));
        result.speedModifier = std::max(0.60f, std::min(1.25f, result.speedModifier));
        result.accuracyModifier = std::max(0.85f, std::min(1.15f, result.accuracyModifier));
        result.evasionModifier = std::max(0.80f, std::min(1.20f, result.evasionModifier));
    }
};

}
