#pragma once

#include "SovereignSerializer.h"
#include <string>
#include <vector>
#include <map>
#include <cstdint>
#include <cmath>
#include <algorithm>
#include <functional>
#include <sstream>
#include <iomanip>
#include <mutex>

namespace Sovereign {

enum class PhenotypeClass {
    ORGANIC,
    CRYSTALLINE,
    METALLIC,
    ETHEREAL,
    VOLCANIC,
    AQUEOUS,
    UNKNOWN
};

inline std::string phenotypeClassToString(PhenotypeClass pc) {
    switch (pc) {
        case PhenotypeClass::ORGANIC:     return "ORGANIC";
        case PhenotypeClass::CRYSTALLINE: return "CRYSTALLINE";
        case PhenotypeClass::METALLIC:    return "METALLIC";
        case PhenotypeClass::ETHEREAL:    return "ETHEREAL";
        case PhenotypeClass::VOLCANIC:    return "VOLCANIC";
        case PhenotypeClass::AQUEOUS:     return "AQUEOUS";
        default:                          return "UNKNOWN";
    }
}

struct FLinearColor {
    float R = 0.0f;
    float G = 0.0f;
    float B = 0.0f;
    float A = 1.0f;

    bool operator==(const FLinearColor& o) const {
        return R == o.R && G == o.G && B == o.B && A == o.A;
    }

    std::string toHex() const {
        auto clamp = [](float v) -> uint8_t {
            return static_cast<uint8_t>(std::max(0.0f, std::min(255.0f, v * 255.0f)));
        };
        char buf[8];
        snprintf(buf, sizeof(buf), "#%02X%02X%02X", clamp(R), clamp(G), clamp(B));
        return std::string(buf);
    }

    float luminance() const {
        return 0.2126f * R + 0.7152f * G + 0.0722f * B;
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"R\":" << R << ",\"G\":" << G << ",\"B\":" << B << ",\"A\":" << A << "}";
        return oss.str();
    }
};

struct FOrganicMaterialProfile {
    float metallic = 0.0f;
    float roughness = 0.5f;
    float emissionIntensity = 0.0f;
    float opacity = 1.0f;
    float subsurfaceScattering = 0.0f;
    float anisotropy = 0.0f;
    float fresnelPower = 5.0f;
    float normalIntensity = 1.0f;
    float displacementHeight = 0.0f;
    float specular = 0.5f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"anisotropy\":" << anisotropy
            << ",\"displacementHeight\":" << displacementHeight
            << ",\"emissionIntensity\":" << emissionIntensity
            << ",\"fresnelPower\":" << fresnelPower
            << ",\"metallic\":" << metallic
            << ",\"normalIntensity\":" << normalIntensity
            << ",\"opacity\":" << opacity
            << ",\"roughness\":" << roughness
            << ",\"specular\":" << specular
            << ",\"subsurfaceScattering\":" << subsurfaceScattering
            << "}";
        return oss.str();
    }
};

struct FMorphologyDescriptor {
    uint16_t baseMeshIndex = 0;
    float scaleX = 1.0f;
    float scaleY = 1.0f;
    float scaleZ = 1.0f;
    float uvTilingU = 1.0f;
    float uvTilingV = 1.0f;
    float animationFrequency = 0.0f;

    std::string meshFamilyName() const {
        static const char* families[] = {
            "Sphere", "Cube", "Cylinder", "Torus",
            "Cone", "Capsule", "Icosphere", "Prism",
            "Helix", "Mobius", "Klein", "Trefoil",
            "Dodecahedron", "Octahedron", "Tetrahedron", "Geodesic"
        };
        return families[baseMeshIndex % 16];
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"animationFrequency\":" << animationFrequency
            << ",\"baseMeshIndex\":" << baseMeshIndex
            << ",\"scaleX\":" << scaleX
            << ",\"scaleY\":" << scaleY
            << ",\"scaleZ\":" << scaleZ
            << ",\"uvTilingU\":" << uvTilingU
            << ",\"uvTilingV\":" << uvTilingV
            << "}";
        return oss.str();
    }
};

struct FLODProfile {
    int lodLevel;
    float screenSizeThreshold;
    float triangleReductionFactor;
    bool castsShadow;
    bool hasEmission;
};

struct FVisualPhenotype {
    std::string sourceHash;
    FLinearColor primaryColor;
    FLinearColor accentColor;
    FOrganicMaterialProfile material;
    FMorphologyDescriptor morphology;
    PhenotypeClass classification = PhenotypeClass::UNKNOWN;
    std::string classificationName;
    std::vector<FLODProfile> lodChain;
    std::string phenotypeHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"accentColor\":" << accentColor.canonicalize()
            << ",\"classification\":\"" << classificationName << "\""
            << ",\"material\":" << material.canonicalize()
            << ",\"morphology\":" << morphology.canonicalize()
            << ",\"primaryColor\":" << primaryColor.canonicalize()
            << ",\"sourceHash\":\"" << sourceHash << "\""
            << "}";
        return oss.str();
    }

    std::string computePhenotypeHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return phenotypeHash == computePhenotypeHash();
    }
};

struct ForgeAuditEntry {
    std::string inputHash;
    std::string outputPhenotypeHash;
    std::string entityKey;
    int64_t forgedTimestamp;
    PhenotypeClass classification;
    bool verified;
};

struct ForgeStats {
    int totalForged = 0;
    int totalVerified = 0;
    int totalFailed = 0;
    int totalBatchesProcessed = 0;
    int64_t lastForgeTimestamp = 0;
    std::map<PhenotypeClass, int> classificationDistribution;
};

using ForgeCompleteDelegate = std::function<void(const FVisualPhenotype& phenotype, const std::string& entityKey)>;
using BatchForgeProgressDelegate = std::function<void(int current, int total, const std::string& entityKey)>;
using ForgeIntegrityFailureDelegate = std::function<void(const std::string& entityKey, const std::string& expectedHash, const std::string& actualHash)>;

class GeneticGenomeParser {
public:
    struct GenomeLocus {
        std::string name;
        int byteOffset;
        int byteLength;
        uint32_t rawValue;
        float normalizedValue;
    };

    static std::vector<uint8_t> hashToBytes(const std::string& hexHash) {
        std::vector<uint8_t> bytes;
        bytes.reserve(32);
        for (size_t i = 0; i + 1 < hexHash.size() && bytes.size() < 32; i += 2) {
            uint8_t hi = hexCharToNibble(hexHash[i]);
            uint8_t lo = hexCharToNibble(hexHash[i + 1]);
            bytes.push_back((hi << 4) | lo);
        }
        while (bytes.size() < 32) bytes.push_back(0);
        return bytes;
    }

    static GenomeLocus extractLocus(const std::vector<uint8_t>& genome,
                                     const std::string& name, int offset, int length) {
        GenomeLocus locus;
        locus.name = name;
        locus.byteOffset = offset;
        locus.byteLength = length;
        locus.rawValue = 0;
        for (int i = 0; i < length && (offset + i) < static_cast<int>(genome.size()); i++) {
            locus.rawValue = (locus.rawValue << 8) | genome[offset + i];
        }
        uint32_t maxVal = (1u << (length * 8)) - 1;
        locus.normalizedValue = static_cast<float>(locus.rawValue) / static_cast<float>(maxVal);
        return locus;
    }

    static FLinearColor extractColor(const std::vector<uint8_t>& genome, int offset) {
        FLinearColor c;
        c.R = (offset < static_cast<int>(genome.size())) ? genome[offset] / 255.0f : 0.0f;
        c.G = (offset + 1 < static_cast<int>(genome.size())) ? genome[offset + 1] / 255.0f : 0.0f;
        c.B = (offset + 2 < static_cast<int>(genome.size())) ? genome[offset + 2] / 255.0f : 0.0f;
        c.A = 1.0f;
        return c;
    }

private:
    static uint8_t hexCharToNibble(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
        if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
        return 0;
    }
};

class BiologicalForge {
public:
    static BiologicalForge& Get() {
        static BiologicalForge instance;
        return instance;
    }

    BiologicalForge(const BiologicalForge&) = delete;
    BiologicalForge& operator=(const BiologicalForge&) = delete;

    FVisualPhenotype forge(const std::string& sha256Hash, const std::string& entityKey = "") {
        std::lock_guard<std::mutex> lock(mutex_);

        auto it = phenotypeCache_.find(sha256Hash);
        if (it != phenotypeCache_.end()) {
            stats_.totalForged++;
            stats_.lastForgeTimestamp = static_cast<int64_t>(std::time(nullptr));
            return it->second;
        }

        std::vector<uint8_t> genome = GeneticGenomeParser::hashToBytes(sha256Hash);

        FVisualPhenotype phenotype;
        phenotype.sourceHash = sha256Hash;

        phenotype.primaryColor = GeneticGenomeParser::extractColor(genome, 0);
        phenotype.accentColor = GeneticGenomeParser::extractColor(genome, 3);

        auto metallic = GeneticGenomeParser::extractLocus(genome, "metallic", 6, 1);
        auto roughness = GeneticGenomeParser::extractLocus(genome, "roughness", 7, 1);
        auto emission = GeneticGenomeParser::extractLocus(genome, "emission", 8, 1);
        auto opacity = GeneticGenomeParser::extractLocus(genome, "opacity", 9, 1);
        auto subsurface = GeneticGenomeParser::extractLocus(genome, "subsurface", 22, 1);
        auto anisotropy = GeneticGenomeParser::extractLocus(genome, "anisotropy", 23, 1);
        auto fresnel = GeneticGenomeParser::extractLocus(genome, "fresnel", 24, 2);
        auto normalInt = GeneticGenomeParser::extractLocus(genome, "normalIntensity", 26, 1);
        auto displace = GeneticGenomeParser::extractLocus(genome, "displacement", 27, 1);

        phenotype.material.metallic = metallic.normalizedValue;
        phenotype.material.roughness = roughness.normalizedValue;
        phenotype.material.emissionIntensity = emission.normalizedValue * 10.0f;
        phenotype.material.opacity = 0.3f + opacity.normalizedValue * 0.7f;
        phenotype.material.subsurfaceScattering = subsurface.normalizedValue;
        phenotype.material.anisotropy = anisotropy.normalizedValue;
        phenotype.material.fresnelPower = 1.0f + fresnel.normalizedValue * 9.0f;
        phenotype.material.normalIntensity = normalInt.normalizedValue * 2.0f;
        phenotype.material.displacementHeight = displace.normalizedValue * 0.5f;
        phenotype.material.specular = 0.2f + metallic.normalizedValue * 0.6f;

        auto meshIdx = GeneticGenomeParser::extractLocus(genome, "meshIndex", 10, 2);
        auto scaleX = GeneticGenomeParser::extractLocus(genome, "scaleX", 12, 2);
        auto scaleY = GeneticGenomeParser::extractLocus(genome, "scaleY", 14, 2);
        auto scaleZ = GeneticGenomeParser::extractLocus(genome, "scaleZ", 16, 2);
        auto uvU = GeneticGenomeParser::extractLocus(genome, "uvTilingU", 18, 2);
        auto uvV = GeneticGenomeParser::extractLocus(genome, "uvTilingV", 20, 2);
        auto animFreq = GeneticGenomeParser::extractLocus(genome, "animFreq", 28, 2);

        phenotype.morphology.baseMeshIndex = static_cast<uint16_t>(meshIdx.rawValue % 16);
        phenotype.morphology.scaleX = 0.5f + scaleX.normalizedValue * 2.0f;
        phenotype.morphology.scaleY = 0.5f + scaleY.normalizedValue * 2.0f;
        phenotype.morphology.scaleZ = 0.5f + scaleZ.normalizedValue * 2.0f;
        phenotype.morphology.uvTilingU = 0.5f + uvU.normalizedValue * 4.0f;
        phenotype.morphology.uvTilingV = 0.5f + uvV.normalizedValue * 4.0f;
        phenotype.morphology.animationFrequency = animFreq.normalizedValue * 5.0f;

        phenotype.classification = classify(phenotype);
        phenotype.classificationName = phenotypeClassToString(phenotype.classification);
        phenotype.lodChain = generateLODChain(phenotype);
        phenotype.phenotypeHash = phenotype.computePhenotypeHash();

        phenotypeCache_[sha256Hash] = phenotype;

        ForgeAuditEntry audit;
        audit.inputHash = sha256Hash;
        audit.outputPhenotypeHash = phenotype.phenotypeHash;
        audit.entityKey = entityKey;
        audit.forgedTimestamp = static_cast<int64_t>(std::time(nullptr));
        audit.classification = phenotype.classification;
        audit.verified = phenotype.verifyIntegrity();
        auditTrail_.push_back(audit);

        stats_.totalForged++;
        stats_.lastForgeTimestamp = audit.forgedTimestamp;
        stats_.classificationDistribution[phenotype.classification]++;

        if (audit.verified) {
            stats_.totalVerified++;
        } else {
            stats_.totalFailed++;
            if (integrityFailureDelegate_) {
                integrityFailureDelegate_(entityKey, phenotype.phenotypeHash,
                                          phenotype.computePhenotypeHash());
            }
        }

        if (forgeCompleteDelegate_) {
            forgeCompleteDelegate_(phenotype, entityKey);
        }

        return phenotype;
    }

    std::vector<FVisualPhenotype> forgeBatch(
        const std::vector<std::pair<std::string, std::string>>& hashEntityPairs) {
        std::vector<FVisualPhenotype> results;
        results.reserve(hashEntityPairs.size());
        int idx = 0;
        for (const auto& [hash, entityKey] : hashEntityPairs) {
            FVisualPhenotype p = forge(hash, entityKey);
            results.push_back(p);
            idx++;
            if (batchProgressDelegate_) {
                batchProgressDelegate_(idx, static_cast<int>(hashEntityPairs.size()), entityKey);
            }
        }
        stats_.totalBatchesProcessed++;
        return results;
    }

    FVisualPhenotype forgeFromPayload(const JsonValue& payload, const std::string& entityKey = "") {
        std::string canonical = payload.canonicalize();
        std::string hash = SovereignSHA256::hash(canonical);
        return forge(hash, entityKey);
    }

    bool verifyPhenotype(const FVisualPhenotype& phenotype) const {
        return phenotype.verifyIntegrity();
    }

    bool verifyForgeReproducibility(const std::string& sha256Hash) {
        std::lock_guard<std::mutex> lock(mutex_);

        auto saved = phenotypeCache_;
        phenotypeCache_.erase(sha256Hash);
        std::lock_guard<std::mutex>* dummy = nullptr;
        (void)dummy;

        FVisualPhenotype first;
        {
            std::vector<uint8_t> genome = GeneticGenomeParser::hashToBytes(sha256Hash);
            first = forgeUnlocked(sha256Hash, genome);
        }

        phenotypeCache_.erase(sha256Hash);

        FVisualPhenotype second;
        {
            std::vector<uint8_t> genome = GeneticGenomeParser::hashToBytes(sha256Hash);
            second = forgeUnlocked(sha256Hash, genome);
        }

        phenotypeCache_ = saved;

        return first.phenotypeHash == second.phenotypeHash &&
               first.primaryColor == second.primaryColor &&
               first.classification == second.classification;
    }

    std::string generateUE5MaterialInstance(const FVisualPhenotype& p) const {
        std::ostringstream oss;
        oss << "// Auto-generated by BiologicalForge — DO NOT EDIT\n";
        oss << "// Source Hash: " << p.sourceHash << "\n";
        oss << "// Phenotype Hash: " << p.phenotypeHash << "\n";
        oss << "// Classification: " << p.classificationName << "\n\n";
        oss << "USTRUCT(BlueprintType)\n";
        oss << "struct FForgedMaterial_" << p.sourceHash.substr(0, 8) << " {\n";
        oss << "    GENERATED_BODY()\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    FLinearColor PrimaryColor = FLinearColor("
            << p.primaryColor.R << "f, " << p.primaryColor.G << "f, "
            << p.primaryColor.B << "f, " << p.primaryColor.A << "f);\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    FLinearColor AccentColor = FLinearColor("
            << p.accentColor.R << "f, " << p.accentColor.G << "f, "
            << p.accentColor.B << "f, " << p.accentColor.A << "f);\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin=\"0.0\", ClampMax=\"1.0\"))\n";
        oss << "    float Metallic = " << p.material.metallic << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin=\"0.0\", ClampMax=\"1.0\"))\n";
        oss << "    float Roughness = " << p.material.roughness << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float EmissionIntensity = " << p.material.emissionIntensity << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin=\"0.0\", ClampMax=\"1.0\"))\n";
        oss << "    float Opacity = " << p.material.opacity << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float SubsurfaceScattering = " << p.material.subsurfaceScattering << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float Anisotropy = " << p.material.anisotropy << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float FresnelPower = " << p.material.fresnelPower << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float NormalIntensity = " << p.material.normalIntensity << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float DisplacementHeight = " << p.material.displacementHeight << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float Specular = " << p.material.specular << "f;\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    FString MeshFamily = TEXT(\"" << p.morphology.meshFamilyName() << "\");\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    FVector Scale = FVector("
            << p.morphology.scaleX << "f, " << p.morphology.scaleY << "f, "
            << p.morphology.scaleZ << "f);\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    FVector2D UVTiling = FVector2D("
            << p.morphology.uvTilingU << "f, " << p.morphology.uvTilingV << "f);\n\n";
        oss << "    UPROPERTY(EditAnywhere, BlueprintReadOnly)\n";
        oss << "    float AnimationFrequency = " << p.morphology.animationFrequency << "f;\n\n";
        oss << "    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)\n";
        oss << "    FString PhenotypeClass = TEXT(\"" << p.classificationName << "\");\n";
        oss << "};\n";
        return oss.str();
    }

    const ForgeStats& stats() const { return stats_; }
    const std::vector<ForgeAuditEntry>& auditTrail() const { return auditTrail_; }
    size_t cacheSize() const { std::lock_guard<std::mutex> lock(mutex_); return phenotypeCache_.size(); }

    void onForgeComplete(ForgeCompleteDelegate d) { forgeCompleteDelegate_ = std::move(d); }
    void onBatchProgress(BatchForgeProgressDelegate d) { batchProgressDelegate_ = std::move(d); }
    void onIntegrityFailure(ForgeIntegrityFailureDelegate d) { integrityFailureDelegate_ = std::move(d); }

    void clearCache() {
        std::lock_guard<std::mutex> lock(mutex_);
        phenotypeCache_.clear();
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        phenotypeCache_.clear();
        auditTrail_.clear();
        stats_ = ForgeStats{};
        forgeCompleteDelegate_ = nullptr;
        batchProgressDelegate_ = nullptr;
        integrityFailureDelegate_ = nullptr;
    }

private:
    BiologicalForge() = default;
    mutable std::mutex mutex_;
    std::map<std::string, FVisualPhenotype> phenotypeCache_;
    std::vector<ForgeAuditEntry> auditTrail_;
    ForgeStats stats_;
    ForgeCompleteDelegate forgeCompleteDelegate_;
    BatchForgeProgressDelegate batchProgressDelegate_;
    ForgeIntegrityFailureDelegate integrityFailureDelegate_;

    FVisualPhenotype forgeUnlocked(const std::string& sha256Hash, const std::vector<uint8_t>& genome) {
        FVisualPhenotype phenotype;
        phenotype.sourceHash = sha256Hash;
        phenotype.primaryColor = GeneticGenomeParser::extractColor(genome, 0);
        phenotype.accentColor = GeneticGenomeParser::extractColor(genome, 3);

        auto metallic = GeneticGenomeParser::extractLocus(genome, "metallic", 6, 1);
        auto roughness = GeneticGenomeParser::extractLocus(genome, "roughness", 7, 1);
        auto emission = GeneticGenomeParser::extractLocus(genome, "emission", 8, 1);
        auto opacity = GeneticGenomeParser::extractLocus(genome, "opacity", 9, 1);
        auto subsurface = GeneticGenomeParser::extractLocus(genome, "subsurface", 22, 1);
        auto anisotropy = GeneticGenomeParser::extractLocus(genome, "anisotropy", 23, 1);
        auto fresnel = GeneticGenomeParser::extractLocus(genome, "fresnel", 24, 2);
        auto normalInt = GeneticGenomeParser::extractLocus(genome, "normalIntensity", 26, 1);
        auto displace = GeneticGenomeParser::extractLocus(genome, "displacement", 27, 1);

        phenotype.material.metallic = metallic.normalizedValue;
        phenotype.material.roughness = roughness.normalizedValue;
        phenotype.material.emissionIntensity = emission.normalizedValue * 10.0f;
        phenotype.material.opacity = 0.3f + opacity.normalizedValue * 0.7f;
        phenotype.material.subsurfaceScattering = subsurface.normalizedValue;
        phenotype.material.anisotropy = anisotropy.normalizedValue;
        phenotype.material.fresnelPower = 1.0f + fresnel.normalizedValue * 9.0f;
        phenotype.material.normalIntensity = normalInt.normalizedValue * 2.0f;
        phenotype.material.displacementHeight = displace.normalizedValue * 0.5f;
        phenotype.material.specular = 0.2f + metallic.normalizedValue * 0.6f;

        auto meshIdx = GeneticGenomeParser::extractLocus(genome, "meshIndex", 10, 2);
        auto scaleX = GeneticGenomeParser::extractLocus(genome, "scaleX", 12, 2);
        auto scaleY = GeneticGenomeParser::extractLocus(genome, "scaleY", 14, 2);
        auto scaleZ = GeneticGenomeParser::extractLocus(genome, "scaleZ", 16, 2);
        auto uvU = GeneticGenomeParser::extractLocus(genome, "uvTilingU", 18, 2);
        auto uvV = GeneticGenomeParser::extractLocus(genome, "uvTilingV", 20, 2);
        auto animFreq = GeneticGenomeParser::extractLocus(genome, "animFreq", 28, 2);

        phenotype.morphology.baseMeshIndex = static_cast<uint16_t>(meshIdx.rawValue % 16);
        phenotype.morphology.scaleX = 0.5f + scaleX.normalizedValue * 2.0f;
        phenotype.morphology.scaleY = 0.5f + scaleY.normalizedValue * 2.0f;
        phenotype.morphology.scaleZ = 0.5f + scaleZ.normalizedValue * 2.0f;
        phenotype.morphology.uvTilingU = 0.5f + uvU.normalizedValue * 4.0f;
        phenotype.morphology.uvTilingV = 0.5f + uvV.normalizedValue * 4.0f;
        phenotype.morphology.animationFrequency = animFreq.normalizedValue * 5.0f;

        phenotype.classification = classify(phenotype);
        phenotype.classificationName = phenotypeClassToString(phenotype.classification);
        phenotype.lodChain = generateLODChain(phenotype);
        phenotype.phenotypeHash = phenotype.computePhenotypeHash();

        return phenotype;
    }

    static PhenotypeClass classify(const FVisualPhenotype& p) {
        float met = p.material.metallic;
        float rough = p.material.roughness;
        float emit = p.material.emissionIntensity;
        float sss = p.material.subsurfaceScattering;
        float lum = p.primaryColor.luminance();

        if (met > 0.7f && rough < 0.3f) return PhenotypeClass::METALLIC;
        if (met < 0.2f && rough < 0.2f && emit < 1.0f) return PhenotypeClass::CRYSTALLINE;
        if (emit > 5.0f && lum > 0.5f) return PhenotypeClass::ETHEREAL;
        if (emit > 3.0f && p.primaryColor.R > 0.6f && p.primaryColor.B < 0.3f)
            return PhenotypeClass::VOLCANIC;
        if (sss > 0.5f && met < 0.3f) return PhenotypeClass::ORGANIC;
        if (p.primaryColor.B > 0.5f && rough > 0.3f && met < 0.4f)
            return PhenotypeClass::AQUEOUS;

        return PhenotypeClass::ORGANIC;
    }

    static std::vector<FLODProfile> generateLODChain(const FVisualPhenotype& p) {
        std::vector<FLODProfile> lods;

        FLODProfile lod0;
        lod0.lodLevel = 0;
        lod0.screenSizeThreshold = 1.0f;
        lod0.triangleReductionFactor = 1.0f;
        lod0.castsShadow = true;
        lod0.hasEmission = p.material.emissionIntensity > 0.1f;
        lods.push_back(lod0);

        FLODProfile lod1;
        lod1.lodLevel = 1;
        lod1.screenSizeThreshold = 0.5f;
        lod1.triangleReductionFactor = 0.5f;
        lod1.castsShadow = true;
        lod1.hasEmission = p.material.emissionIntensity > 2.0f;
        lods.push_back(lod1);

        FLODProfile lod2;
        lod2.lodLevel = 2;
        lod2.screenSizeThreshold = 0.25f;
        lod2.triangleReductionFactor = 0.25f;
        lod2.castsShadow = false;
        lod2.hasEmission = false;
        lods.push_back(lod2);

        FLODProfile lod3;
        lod3.lodLevel = 3;
        lod3.screenSizeThreshold = 0.1f;
        lod3.triangleReductionFactor = 0.1f;
        lod3.castsShadow = false;
        lod3.hasEmission = false;
        lods.push_back(lod3);

        return lods;
    }
};

}
