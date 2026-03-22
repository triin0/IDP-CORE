#pragma once

#include "SovereignIntel.h"
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
#include <sstream>
#include <iomanip>

namespace Sovereign {

enum class ShaderType {
    STANDARD_PBR,
    ANISOTROPIC_GLASS,
    SUBSURFACE_SCATTER,
    EMISSIVE_PULSE,
    METALLIC_FLAKE,
    ETHEREAL_TRANSLUCENT,
    VOLCANIC_LAVA,
    AQUEOUS_CAUSTIC
};

inline std::string shaderTypeToString(ShaderType s) {
    switch (s) {
        case ShaderType::STANDARD_PBR:         return "STANDARD_PBR";
        case ShaderType::ANISOTROPIC_GLASS:    return "ANISOTROPIC_GLASS";
        case ShaderType::SUBSURFACE_SCATTER:   return "SUBSURFACE_SCATTER";
        case ShaderType::EMISSIVE_PULSE:       return "EMISSIVE_PULSE";
        case ShaderType::METALLIC_FLAKE:       return "METALLIC_FLAKE";
        case ShaderType::ETHEREAL_TRANSLUCENT: return "ETHEREAL_TRANSLUCENT";
        case ShaderType::VOLCANIC_LAVA:        return "VOLCANIC_LAVA";
        case ShaderType::AQUEOUS_CAUSTIC:      return "AQUEOUS_CAUSTIC";
        default:                               return "STANDARD_PBR";
    }
}

enum class MeshArchetype {
    SMOOTH_ORB,
    ANGULAR_SHARD,
    JAGGED_CRYSTAL,
    FLOWING_TENDRIL,
    DENSE_MONOLITH,
    HOLLOW_SHELL,
    COMPOUND_CLUSTER,
    ORGANIC_BLOOM
};

inline std::string meshArchetypeToString(MeshArchetype m) {
    switch (m) {
        case MeshArchetype::SMOOTH_ORB:        return "SMOOTH_ORB";
        case MeshArchetype::ANGULAR_SHARD:     return "ANGULAR_SHARD";
        case MeshArchetype::JAGGED_CRYSTAL:    return "JAGGED_CRYSTAL";
        case MeshArchetype::FLOWING_TENDRIL:   return "FLOWING_TENDRIL";
        case MeshArchetype::DENSE_MONOLITH:    return "DENSE_MONOLITH";
        case MeshArchetype::HOLLOW_SHELL:      return "HOLLOW_SHELL";
        case MeshArchetype::COMPOUND_CLUSTER:  return "COMPOUND_CLUSTER";
        case MeshArchetype::ORGANIC_BLOOM:     return "ORGANIC_BLOOM";
        default:                               return "SMOOTH_ORB";
    }
}

struct FMaterialManifest {
    ShaderType shaderType       = ShaderType::STANDARD_PBR;
    std::string shaderTypeName  = "STANDARD_PBR";
    float roughness             = 0.5f;
    float metalness             = 0.0f;
    float refractionIndex       = 1.0f;
    float emissionIntensity     = 0.0f;
    float emissionPulseHz       = 0.0f;
    float glowIntensity         = 0.0f;
    float opacity               = 1.0f;
    float subsurfaceStrength    = 0.0f;
    std::string subsurfaceColor;
    std::string primaryColor;
    std::string accentColor;
    float fresnelPower          = 5.0f;
    float anisotropyStrength    = 0.0f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"accentColor\":\"" << accentColor << "\""
            << ",\"anisotropyStrength\":" << anisotropyStrength
            << ",\"emissionIntensity\":" << emissionIntensity
            << ",\"emissionPulseHz\":" << emissionPulseHz
            << ",\"fresnelPower\":" << fresnelPower
            << ",\"glowIntensity\":" << glowIntensity
            << ",\"metalness\":" << metalness
            << ",\"opacity\":" << opacity
            << ",\"primaryColor\":\"" << primaryColor << "\""
            << ",\"refractionIndex\":" << refractionIndex
            << ",\"roughness\":" << roughness
            << ",\"shaderType\":\"" << shaderTypeName << "\""
            << ",\"subsurfaceColor\":\"" << subsurfaceColor << "\""
            << ",\"subsurfaceStrength\":" << subsurfaceStrength << "}";
        return oss.str();
    }
};

struct FGeometryManifest {
    MeshArchetype meshArchetype     = MeshArchetype::SMOOTH_ORB;
    std::string meshArchetypeName   = "SMOOTH_ORB";
    std::string baseMeshFamily;
    float scaleX = 1.0f;
    float scaleY = 1.0f;
    float scaleZ = 1.0f;
    float animationFrequency = 0.0f;
    float uvTilingU = 1.0f;
    float uvTilingV = 1.0f;
    int lodLevels = 0;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"animationFrequency\":" << animationFrequency
            << ",\"baseMeshFamily\":\"" << baseMeshFamily << "\""
            << ",\"lodLevels\":" << lodLevels
            << ",\"meshArchetype\":\"" << meshArchetypeName << "\""
            << ",\"scaleX\":" << scaleX
            << ",\"scaleY\":" << scaleY
            << ",\"scaleZ\":" << scaleZ
            << ",\"uvTilingU\":" << uvTilingU
            << ",\"uvTilingV\":" << uvTilingV << "}";
        return oss.str();
    }
};

struct FBehaviorManifest {
    std::string archetypeName;
    float aggressionBias    = 0.0f;
    float defenseBias       = 0.0f;
    float elusivenessBias   = 0.0f;
    float confidenceLevel   = 0.0f;
    std::string preferredAction;
    std::string secondaryAction;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"aggressionBias\":" << aggressionBias
            << ",\"archetypeName\":\"" << archetypeName << "\""
            << ",\"confidenceLevel\":" << confidenceLevel
            << ",\"defenseBias\":" << defenseBias
            << ",\"elusivenessBias\":" << elusivenessBias
            << ",\"preferredAction\":\"" << preferredAction << "\""
            << ",\"secondaryAction\":\"" << secondaryAction << "\"}";
        return oss.str();
    }
};

struct FEnvironmentManifest {
    std::string biomeName;
    std::string synergyGrade;
    float synergyCoefficient    = 0.0f;
    float thermalStress         = 0.0f;
    std::vector<std::string> activeBuffs;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"activeBuffs\":[";
        for (size_t i = 0; i < activeBuffs.size(); i++) {
            if (i > 0) oss << ",";
            oss << "\"" << activeBuffs[i] << "\"";
        }
        oss << "],\"biomeName\":\"" << biomeName << "\""
            << ",\"synergyCoefficient\":" << synergyCoefficient
            << ",\"synergyGrade\":\"" << synergyGrade << "\""
            << ",\"thermalStress\":" << thermalStress << "}";
        return oss.str();
    }
};

struct FVisualManifestObject {
    std::string version         = "1.0.0";
    std::string genomeHash;
    std::string entityKey;
    std::string phenotypeClass;

    FMaterialManifest material;
    FGeometryManifest geometry;
    FBehaviorManifest behavior;
    FEnvironmentManifest environment;

    std::string manifestHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"behavior\":" << behavior.canonicalize()
            << ",\"entityKey\":\"" << entityKey << "\""
            << ",\"environment\":" << environment.canonicalize()
            << ",\"genomeHash\":\"" << genomeHash << "\""
            << ",\"geometry\":" << geometry.canonicalize()
            << ",\"material\":" << material.canonicalize()
            << ",\"phenotypeClass\":\"" << phenotypeClass << "\""
            << ",\"version\":\"" << version << "\"}";
        return oss.str();
    }

    std::string computeHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void updateHash() {
        manifestHash = computeHash();
    }

    bool verifyIntegrity() const {
        return !manifestHash.empty() && manifestHash == computeHash();
    }
};

struct FSovereignPassport {
    std::string passportVersion = "1.0.0";
    std::string genomeHash;
    std::string entityKey;
    std::string phenotypeHash;
    std::string profileHash;
    std::string phenotypeClass;
    std::string archetypeName;

    FVisualManifestObject vmo;

    std::string passportSignature;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"archetypeName\":\"" << archetypeName << "\""
            << ",\"entityKey\":\"" << entityKey << "\""
            << ",\"genomeHash\":\"" << genomeHash << "\""
            << ",\"passportVersion\":\"" << passportVersion << "\""
            << ",\"phenotypeClass\":\"" << phenotypeClass << "\""
            << ",\"phenotypeHash\":\"" << phenotypeHash << "\""
            << ",\"profileHash\":\"" << profileHash << "\""
            << ",\"vmo\":" << vmo.canonicalize() << "}";
        return oss.str();
    }

    std::string computeSignature() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void sign() {
        vmo.updateHash();
        passportSignature = computeSignature();
    }

    bool verifySignature() const {
        return !passportSignature.empty() && passportSignature == computeSignature();
    }

    bool verifyFull() const {
        return verifySignature() && vmo.verifyIntegrity();
    }
};

struct FPassportStats {
    int totalPassportsIssued = 0;
    int totalVerified = 0;
    int totalTampered = 0;
    int64_t lastIssuedTimestamp = 0;
    std::unordered_map<std::string, int> classDistribution;
    std::unordered_map<std::string, int> archetypeDistribution;
};

using PassportIssuedDelegate = std::function<void(const FSovereignPassport&, const std::string& entityKey)>;

class SovereignPassportAuthority {
public:
    static SovereignPassportAuthority& Get() {
        static SovereignPassportAuthority instance;
        return instance;
    }

    SovereignPassportAuthority(const SovereignPassportAuthority&) = delete;
    SovereignPassportAuthority& operator=(const SovereignPassportAuthority&) = delete;

    static ShaderType classifyShader(const FOrganicMaterialProfile& mat, PhenotypeClass pc) {
        if (pc == PhenotypeClass::VOLCANIC && mat.emissionIntensity > 2.0f) {
            return ShaderType::VOLCANIC_LAVA;
        }
        if (pc == PhenotypeClass::AQUEOUS && mat.subsurfaceScattering > 0.5f) {
            return ShaderType::AQUEOUS_CAUSTIC;
        }
        if (pc == PhenotypeClass::ETHEREAL && mat.opacity < 0.7f) {
            return ShaderType::ETHEREAL_TRANSLUCENT;
        }
        if (mat.anisotropy > 0.5f && mat.opacity < 0.8f) {
            return ShaderType::ANISOTROPIC_GLASS;
        }
        if (mat.subsurfaceScattering > 0.4f) {
            return ShaderType::SUBSURFACE_SCATTER;
        }
        if (mat.emissionIntensity > 3.0f) {
            return ShaderType::EMISSIVE_PULSE;
        }
        if (mat.metallic > 0.6f) {
            return ShaderType::METALLIC_FLAKE;
        }
        return ShaderType::STANDARD_PBR;
    }

    static MeshArchetype classifyMeshArchetype(const FMorphologyDescriptor& morph, PhenotypeClass pc) {
        const std::string& family = const_cast<FMorphologyDescriptor&>(morph).meshFamilyName();

        if (pc == PhenotypeClass::CRYSTALLINE) {
            return MeshArchetype::JAGGED_CRYSTAL;
        }
        if (pc == PhenotypeClass::ORGANIC) {
            return MeshArchetype::ORGANIC_BLOOM;
        }
        if (family == "Sphere" || family == "Icosphere" || family == "Geodesic") {
            return MeshArchetype::SMOOTH_ORB;
        }
        if (family == "Cube" || family == "Prism" || family == "Octahedron" || family == "Tetrahedron") {
            return MeshArchetype::ANGULAR_SHARD;
        }
        if (family == "Torus" || family == "Helix" || family == "Trefoil" || family == "Mobius" || family == "Klein") {
            return MeshArchetype::FLOWING_TENDRIL;
        }
        if (family == "Cylinder" || family == "Capsule") {
            return MeshArchetype::DENSE_MONOLITH;
        }
        if (family == "Cone" || family == "Dodecahedron") {
            return MeshArchetype::COMPOUND_CLUSTER;
        }
        if (morph.scaleX > 2.0f || morph.scaleY > 2.0f || morph.scaleZ > 2.0f) {
            return MeshArchetype::DENSE_MONOLITH;
        }
        return MeshArchetype::SMOOTH_ORB;
    }

    static std::vector<std::string> computeActiveBuffs(const FSynergyResult& synergy) {
        std::vector<std::string> buffs;
        if (synergy.attackModifier > 1.05f) buffs.push_back("ATTACK_BOOST");
        if (synergy.defenseModifier > 1.05f) buffs.push_back("DEFENSE_BOOST");
        if (synergy.speedModifier > 1.05f) buffs.push_back("SPEED_BOOST");
        if (synergy.accuracyModifier > 1.05f) buffs.push_back("ACCURACY_BOOST");
        if (synergy.evasionModifier > 1.05f) buffs.push_back("EVASION_BOOST");
        if (synergy.thermalStress > 0.3f) buffs.push_back("THERMAL_RESISTANCE");
        if (synergy.coefficient > 0.5f) buffs.push_back("HABITAT_AFFINITY");
        return buffs;
    }

    static std::string computeSubsurfaceColor(const FLinearColor& primary, PhenotypeClass pc) {
        float r = primary.R, g = primary.G, b = primary.B;
        switch (pc) {
            case PhenotypeClass::ORGANIC:
                r = std::min(1.0f, r * 1.2f);
                g = std::min(1.0f, g * 0.8f);
                break;
            case PhenotypeClass::VOLCANIC:
                r = 1.0f; g = 0.27f; b = 0.0f;
                break;
            case PhenotypeClass::AQUEOUS:
                r *= 0.5f; g = std::min(1.0f, g * 1.3f); b = std::min(1.0f, b * 1.4f);
                break;
            case PhenotypeClass::ETHEREAL:
                r = std::min(1.0f, r * 1.1f);
                g = std::min(1.0f, g * 1.1f);
                b = std::min(1.0f, b * 1.3f);
                break;
            default: break;
        }
        FLinearColor sub;
        sub.R = r; sub.G = g; sub.B = b; sub.A = 1.0f;
        return sub.toHex();
    }

    FVisualManifestObject buildVMO(
        const FVisualPhenotype& phenotype,
        const FBehavioralProfile& profile,
        const FHabitatState& habitat,
        const FSynergyResult& synergy,
        const std::string& entityKey
    ) {
        FVisualManifestObject vmo;
        vmo.genomeHash = phenotype.sourceHash;
        vmo.entityKey = entityKey;
        vmo.phenotypeClass = phenotype.classificationName;

        vmo.material.shaderType = classifyShader(phenotype.material, phenotype.classification);
        vmo.material.shaderTypeName = shaderTypeToString(vmo.material.shaderType);
        vmo.material.roughness = phenotype.material.roughness;
        vmo.material.metalness = phenotype.material.metallic;
        vmo.material.refractionIndex = 1.0f + phenotype.material.anisotropy * 0.5f;
        vmo.material.emissionIntensity = phenotype.material.emissionIntensity;
        vmo.material.emissionPulseHz = phenotype.morphology.animationFrequency * 0.2f;
        vmo.material.glowIntensity = phenotype.material.emissionIntensity * 0.3f;
        vmo.material.opacity = phenotype.material.opacity;
        vmo.material.subsurfaceStrength = phenotype.material.subsurfaceScattering;
        vmo.material.subsurfaceColor = computeSubsurfaceColor(phenotype.primaryColor, phenotype.classification);
        vmo.material.primaryColor = phenotype.primaryColor.toHex();
        vmo.material.accentColor = phenotype.accentColor.toHex();
        vmo.material.fresnelPower = phenotype.material.fresnelPower;
        vmo.material.anisotropyStrength = phenotype.material.anisotropy;

        vmo.geometry.meshArchetype = classifyMeshArchetype(phenotype.morphology, phenotype.classification);
        vmo.geometry.meshArchetypeName = meshArchetypeToString(vmo.geometry.meshArchetype);
        vmo.geometry.baseMeshFamily = const_cast<FMorphologyDescriptor&>(phenotype.morphology).meshFamilyName();
        vmo.geometry.scaleX = phenotype.morphology.scaleX;
        vmo.geometry.scaleY = phenotype.morphology.scaleY;
        vmo.geometry.scaleZ = phenotype.morphology.scaleZ;
        vmo.geometry.animationFrequency = phenotype.morphology.animationFrequency;
        vmo.geometry.uvTilingU = phenotype.morphology.uvTilingU;
        vmo.geometry.uvTilingV = phenotype.morphology.uvTilingV;
        vmo.geometry.lodLevels = static_cast<int>(phenotype.lodChain.size());

        vmo.behavior.archetypeName = profile.archetypeName;
        vmo.behavior.aggressionBias = profile.weights.aggression;
        vmo.behavior.defenseBias = profile.weights.defenseBias;
        vmo.behavior.elusivenessBias = profile.weights.elusiveness;
        vmo.behavior.confidenceLevel = profile.weights.confidence;

        FSituationalContext defaultCtx;
        auto decision = SovereignIntelKernel::Get().decide(profile, defaultCtx);
        vmo.behavior.preferredAction = decision.chosenActionName;
        if (decision.utilityVector.size() >= 2) {
            float secondBest = -1e9f;
            std::string secondAction = "HOLD";
            for (const auto& au : decision.utilityVector) {
                if (au.actionName != decision.chosenActionName && au.utility > secondBest) {
                    secondBest = au.utility;
                    secondAction = au.actionName;
                }
            }
            vmo.behavior.secondaryAction = secondAction;
        } else {
            vmo.behavior.secondaryAction = "HOLD";
        }

        vmo.environment.biomeName = habitat.biomeName;
        vmo.environment.synergyGrade = synergy.gradeName;
        vmo.environment.synergyCoefficient = synergy.coefficient;
        vmo.environment.thermalStress = synergy.thermalStress;
        vmo.environment.activeBuffs = computeActiveBuffs(synergy);

        vmo.updateHash();
        return vmo;
    }

    FSovereignPassport issuePassport(
        const FVisualPhenotype& phenotype,
        const FBehavioralProfile& profile,
        const FHabitatState& habitat,
        const FSynergyResult& synergy,
        const std::string& entityKey
    ) {
        FSovereignPassport passport;
        PassportIssuedDelegate delegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            passport.genomeHash = phenotype.sourceHash;
            passport.entityKey = entityKey;
            passport.phenotypeHash = phenotype.phenotypeHash;
            passport.profileHash = profile.profileHash;
            passport.phenotypeClass = phenotype.classificationName;
            passport.archetypeName = profile.archetypeName;

            passport.vmo = buildVMO(phenotype, profile, habitat, synergy, entityKey);
            passport.sign();

            passportCache_[phenotype.sourceHash] = passport;

            stats_.totalPassportsIssued++;
            stats_.lastIssuedTimestamp = static_cast<int64_t>(std::time(nullptr));
            stats_.classDistribution[phenotype.classificationName]++;
            stats_.archetypeDistribution[profile.archetypeName]++;

            delegate = passportIssuedDelegate_;
        }

        if (delegate) {
            delegate(passport, entityKey);
        }

        return passport;
    }

    bool verifyPassport(const FSovereignPassport& passport) const {
        return passport.verifyFull();
    }

    bool detectTampering(FSovereignPassport& passport) {
        bool valid = passport.verifyFull();
        std::lock_guard<std::mutex> lock(mutex_);
        if (!valid) {
            stats_.totalTampered++;
        } else {
            stats_.totalVerified++;
        }
        return !valid;
    }

    std::string generateUE5PassportStruct() const {
        std::ostringstream oss;
        oss << "USTRUCT(BlueprintType)\n"
            << "struct FSovereignEntityPassport {\n"
            << "    GENERATED_BODY()\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FString GenomeHash;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FString EntityKey;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FString PhenotypeClass;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FString ArchetypeName;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FString ShaderType;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FString MeshArchetype;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FLinearColor PrimaryColor;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FLinearColor AccentColor;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FVector Scale;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    float EmissionIntensity;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    float GlowIntensity;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    float AnimationFrequency;\n\n"
            << "    UPROPERTY(EditAnywhere, BlueprintReadWrite)\n"
            << "    FString PassportSignature;\n"
            << "};\n";
        return oss.str();
    }

    std::string exportPassportJSON(const FSovereignPassport& passport) const {
        std::ostringstream oss;
        oss << "{\"passportVersion\":\"" << passport.passportVersion << "\""
            << ",\"genomeHash\":\"" << passport.genomeHash << "\""
            << ",\"entityKey\":\"" << passport.entityKey << "\""
            << ",\"phenotypeClass\":\"" << passport.phenotypeClass << "\""
            << ",\"archetypeName\":\"" << passport.archetypeName << "\""
            << ",\"phenotypeHash\":\"" << passport.phenotypeHash << "\""
            << ",\"profileHash\":\"" << passport.profileHash << "\""
            << ",\"vmo\":" << passport.vmo.canonicalize()
            << ",\"manifestHash\":\"" << passport.vmo.manifestHash << "\""
            << ",\"passportSignature\":\"" << passport.passportSignature << "\"}";
        return oss.str();
    }

    void onPassportIssued(PassportIssuedDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        passportIssuedDelegate_ = delegate;
    }

    FPassportStats getStats() {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    void resetStats() {
        std::lock_guard<std::mutex> lock(mutex_);
        stats_ = FPassportStats{};
        passportCache_.clear();
    }

private:
    SovereignPassportAuthority() = default;

    std::mutex mutex_;
    FPassportStats stats_;
    std::unordered_map<std::string, FSovereignPassport> passportCache_;
    PassportIssuedDelegate passportIssuedDelegate_;
};

}
