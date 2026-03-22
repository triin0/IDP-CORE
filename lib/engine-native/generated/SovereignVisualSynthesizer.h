#pragma once

#include "SovereignPassport.h"
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
#include <numeric>

namespace Sovereign {

struct FSDFPrimitive {
    enum class Shape { SPHERE, BOX, CYLINDER, TORUS, CONE, CAPSULE };

    Shape shape         = Shape::SPHERE;
    float posX = 0.0f, posY = 0.0f, posZ = 0.0f;
    float sizeX = 1.0f, sizeY = 1.0f, sizeZ = 1.0f;
    float blendRadius   = 0.2f;
    float weight        = 1.0f;

    std::string shapeName() const {
        switch (shape) {
            case Shape::SPHERE:   return "SPHERE";
            case Shape::BOX:      return "BOX";
            case Shape::CYLINDER: return "CYLINDER";
            case Shape::TORUS:    return "TORUS";
            case Shape::CONE:     return "CONE";
            case Shape::CAPSULE:  return "CAPSULE";
            default: return "SPHERE";
        }
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"blendRadius\":" << blendRadius
            << ",\"posX\":" << posX << ",\"posY\":" << posY << ",\"posZ\":" << posZ
            << ",\"shape\":\"" << shapeName() << "\""
            << ",\"sizeX\":" << sizeX << ",\"sizeY\":" << sizeY << ",\"sizeZ\":" << sizeZ
            << ",\"weight\":" << weight << "}";
        return oss.str();
    }
};

struct FSDFComposition {
    std::vector<FSDFPrimitive> primitives;
    float globalBlendFactor     = 0.3f;
    MeshArchetype archetype     = MeshArchetype::SMOOTH_ORB;
    std::string archetypeName   = "SMOOTH_ORB";
    float boundingRadius        = 1.0f;

    int primitiveCount() const { return static_cast<int>(primitives.size()); }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"archetype\":\"" << archetypeName << "\""
            << ",\"boundingRadius\":" << boundingRadius
            << ",\"globalBlendFactor\":" << globalBlendFactor
            << ",\"primitiveCount\":" << primitiveCount()
            << ",\"primitives\":[";
        for (size_t i = 0; i < primitives.size(); i++) {
            if (i > 0) oss << ",";
            oss << primitives[i].canonicalize();
        }
        oss << "]}";
        return oss.str();
    }
};

struct FSynthesizedVertex {
    float x, y, z;
    float nx, ny, nz;
    float u, v;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"n\":[" << nx << "," << ny << "," << nz << "]"
            << ",\"p\":[" << x << "," << y << "," << z << "]"
            << ",\"uv\":[" << u << "," << v << "]}";
        return oss.str();
    }
};

struct FSynthesizedMesh {
    std::vector<FSynthesizedVertex> vertices;
    std::vector<uint32_t> indices;
    std::string genomeHash;
    std::string meshHash;
    MeshArchetype archetype     = MeshArchetype::SMOOTH_ORB;
    std::string archetypeName   = "SMOOTH_ORB";
    float boundingRadius        = 1.0f;
    int lodLevel                = 0;

    int vertexCount() const { return static_cast<int>(vertices.size()); }
    int triangleCount() const { return static_cast<int>(indices.size() / 3); }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"archetype\":\"" << archetypeName << "\""
            << ",\"genomeHash\":\"" << genomeHash << "\""
            << ",\"lodLevel\":" << lodLevel
            << ",\"triangleCount\":" << triangleCount()
            << ",\"vertexCount\":" << vertexCount() << "}";
        return oss.str();
    }

    std::string computeHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void updateHash() {
        meshHash = computeHash();
    }

    bool verifyIntegrity() const {
        return !meshHash.empty() && meshHash == computeHash();
    }
};

enum class VFXType {
    EMISSION_PULSE,
    IMPACT_SHOCKWAVE,
    SHIELD_FLARE,
    DODGE_AFTERIMAGE,
    CHARGE_BUILDUP,
    COUNTER_FLASH,
    FEINT_SHIMMER,
    IDLE_AMBIENT
};

inline std::string vfxTypeToString(VFXType v) {
    switch (v) {
        case VFXType::EMISSION_PULSE:    return "EMISSION_PULSE";
        case VFXType::IMPACT_SHOCKWAVE:  return "IMPACT_SHOCKWAVE";
        case VFXType::SHIELD_FLARE:      return "SHIELD_FLARE";
        case VFXType::DODGE_AFTERIMAGE:  return "DODGE_AFTERIMAGE";
        case VFXType::CHARGE_BUILDUP:    return "CHARGE_BUILDUP";
        case VFXType::COUNTER_FLASH:     return "COUNTER_FLASH";
        case VFXType::FEINT_SHIMMER:     return "FEINT_SHIMMER";
        case VFXType::IDLE_AMBIENT:      return "IDLE_AMBIENT";
        default: return "IDLE_AMBIENT";
    }
}

struct FVFXDescriptor {
    VFXType type            = VFXType::IDLE_AMBIENT;
    std::string typeName    = "IDLE_AMBIENT";
    float intensity         = 1.0f;
    float durationMs        = 500.0f;
    float pulseHz           = 0.0f;
    std::string emissionColor;
    float particleScale     = 1.0f;
    float particleCount     = 100.0f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"durationMs\":" << durationMs
            << ",\"emissionColor\":\"" << emissionColor << "\""
            << ",\"intensity\":" << intensity
            << ",\"particleCount\":" << particleCount
            << ",\"particleScale\":" << particleScale
            << ",\"pulseHz\":" << pulseHz
            << ",\"type\":\"" << typeName << "\"}";
        return oss.str();
    }
};

struct FShaderParameters {
    ShaderType shaderType       = ShaderType::STANDARD_PBR;
    std::string shaderTypeName  = "STANDARD_PBR";

    float baseColorR = 0.5f, baseColorG = 0.5f, baseColorB = 0.5f, baseColorA = 1.0f;
    float emissiveR = 0.0f, emissiveG = 0.0f, emissiveB = 0.0f;
    float roughness             = 0.5f;
    float metallic              = 0.0f;
    float opacity               = 1.0f;
    float refractionIndex       = 1.0f;
    float subsurfaceStrength    = 0.0f;
    float subsurfaceR = 0.0f, subsurfaceG = 0.0f, subsurfaceB = 0.0f;
    float anisotropy            = 0.0f;
    float fresnelPower          = 5.0f;
    float displacementScale     = 0.0f;
    float emissionPulseHz       = 0.0f;
    float glowIntensity         = 0.0f;
    float weatheringIntensity   = 0.0f;
    float microDisplacementFreq = 0.0f;

    bool isValid() const {
        if (refractionIndex < 1.0f || refractionIndex > 3.0f) return false;
        if (roughness < 0.0f || roughness > 1.0f) return false;
        if (metallic < 0.0f || metallic > 1.0f) return false;
        if (opacity < 0.0f || opacity > 1.0f) return false;
        if (fresnelPower < 0.0f || fresnelPower > 20.0f) return false;
        return true;
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"anisotropy\":" << anisotropy
            << ",\"baseColor\":[" << baseColorR << "," << baseColorG << "," << baseColorB << "," << baseColorA << "]"
            << ",\"displacementScale\":" << displacementScale
            << ",\"emissionPulseHz\":" << emissionPulseHz
            << ",\"emissive\":[" << emissiveR << "," << emissiveG << "," << emissiveB << "]"
            << ",\"fresnelPower\":" << fresnelPower
            << ",\"glowIntensity\":" << glowIntensity
            << ",\"metallic\":" << metallic
            << ",\"microDisplacementFreq\":" << microDisplacementFreq
            << ",\"opacity\":" << opacity
            << ",\"refractionIndex\":" << refractionIndex
            << ",\"roughness\":" << roughness
            << ",\"shaderType\":\"" << shaderTypeName << "\""
            << ",\"subsurface\":[" << subsurfaceR << "," << subsurfaceG << "," << subsurfaceB << "]"
            << ",\"subsurfaceStrength\":" << subsurfaceStrength
            << ",\"weatheringIntensity\":" << weatheringIntensity << "}";
        return oss.str();
    }
};

struct FSynthesisResult {
    FSynthesizedMesh mesh;
    FShaderParameters shaderParams;
    FSDFComposition sdfComposition;
    FVFXDescriptor idleVFX;
    std::string genomeHash;
    std::string entityKey;
    std::string synthesisHash;
    int64_t synthesisTimestamp = 0;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"entityKey\":\"" << entityKey << "\""
            << ",\"genomeHash\":\"" << genomeHash << "\""
            << ",\"idleVFX\":" << idleVFX.canonicalize()
            << ",\"mesh\":" << mesh.canonicalize()
            << ",\"sdfComposition\":" << sdfComposition.canonicalize()
            << ",\"shaderParams\":" << shaderParams.canonicalize() << "}";
        return oss.str();
    }

    std::string computeHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void updateHash() {
        synthesisHash = computeHash();
    }

    bool verifyIntegrity() const {
        return !synthesisHash.empty() && synthesisHash == computeHash();
    }
};

struct FSynthesizerStats {
    int totalSynthesized = 0;
    int totalVerticesGenerated = 0;
    int totalTrianglesGenerated = 0;
    int totalVFXGenerated = 0;
    int64_t lastSynthesisTimestamp = 0;
    std::unordered_map<std::string, int> archetypeCounts;
    std::unordered_map<std::string, int> shaderCounts;
};

using SynthesisCompleteDelegate = std::function<void(const FSynthesisResult&, const std::string& entityKey)>;
using VFXTriggeredDelegate = std::function<void(const FVFXDescriptor&, const std::string& entityKey)>;

class SovereignVisualSynthesizer {
public:
    static SovereignVisualSynthesizer& Get() {
        static SovereignVisualSynthesizer instance;
        return instance;
    }

    SovereignVisualSynthesizer(const SovereignVisualSynthesizer&) = delete;
    SovereignVisualSynthesizer& operator=(const SovereignVisualSynthesizer&) = delete;

    FSDFComposition buildSDFComposition(const FVisualManifestObject& vmo) {
        FSDFComposition comp;
        comp.archetype = vmo.geometry.meshArchetype;
        comp.archetypeName = vmo.geometry.meshArchetypeName;

        switch (vmo.geometry.meshArchetype) {
            case MeshArchetype::SMOOTH_ORB:
                comp.primitives = buildSmoothOrb(vmo);
                comp.globalBlendFactor = 0.5f;
                break;
            case MeshArchetype::ANGULAR_SHARD:
                comp.primitives = buildAngularShard(vmo);
                comp.globalBlendFactor = 0.05f;
                break;
            case MeshArchetype::JAGGED_CRYSTAL:
                comp.primitives = buildJaggedCrystal(vmo);
                comp.globalBlendFactor = 0.1f;
                break;
            case MeshArchetype::FLOWING_TENDRIL:
                comp.primitives = buildFlowingTendril(vmo);
                comp.globalBlendFactor = 0.6f;
                break;
            case MeshArchetype::DENSE_MONOLITH:
                comp.primitives = buildDenseMonolith(vmo);
                comp.globalBlendFactor = 0.15f;
                break;
            case MeshArchetype::HOLLOW_SHELL:
                comp.primitives = buildHollowShell(vmo);
                comp.globalBlendFactor = 0.3f;
                break;
            case MeshArchetype::COMPOUND_CLUSTER:
                comp.primitives = buildCompoundCluster(vmo);
                comp.globalBlendFactor = 0.25f;
                break;
            case MeshArchetype::ORGANIC_BLOOM:
                comp.primitives = buildOrganicBloom(vmo);
                comp.globalBlendFactor = 0.7f;
                break;
        }

        float maxDist = 0.0f;
        for (const auto& p : comp.primitives) {
            float dist = std::sqrt(p.posX * p.posX + p.posY * p.posY + p.posZ * p.posZ)
                         + std::max({p.sizeX, p.sizeY, p.sizeZ});
            maxDist = std::max(maxDist, dist);
        }
        comp.boundingRadius = maxDist;

        return comp;
    }

    FShaderParameters buildShaderParameters(const FVisualManifestObject& vmo) {
        FShaderParameters params;
        params.shaderType = vmo.material.shaderType;
        params.shaderTypeName = vmo.material.shaderTypeName;
        params.roughness = std::max(0.0f, std::min(1.0f, vmo.material.roughness));
        params.metallic = std::max(0.0f, std::min(1.0f, vmo.material.metalness));
        params.opacity = std::max(0.0f, std::min(1.0f, vmo.material.opacity));
        params.refractionIndex = std::max(1.0f, std::min(3.0f, vmo.material.refractionIndex));
        params.subsurfaceStrength = std::max(0.0f, std::min(1.0f, vmo.material.subsurfaceStrength));
        params.anisotropy = std::max(0.0f, std::min(1.0f, vmo.material.anisotropyStrength));
        params.fresnelPower = std::max(0.0f, std::min(20.0f, vmo.material.fresnelPower));
        params.emissionPulseHz = vmo.material.emissionPulseHz;
        params.glowIntensity = vmo.material.glowIntensity;

        parseHexColor(vmo.material.primaryColor, params.baseColorR, params.baseColorG, params.baseColorB);
        params.baseColorA = vmo.material.opacity;

        float emScale = std::min(1.0f, vmo.material.emissionIntensity / 10.0f);
        params.emissiveR = params.baseColorR * emScale;
        params.emissiveG = params.baseColorG * emScale;
        params.emissiveB = params.baseColorB * emScale;

        parseHexColor(vmo.material.subsurfaceColor, params.subsurfaceR, params.subsurfaceG, params.subsurfaceB);

        applyWeatheringFromArchetype(params, vmo);

        return params;
    }

    FSynthesizedMesh synthesizeMesh(const FSDFComposition& sdf, const FVisualManifestObject& vmo, int lodLevel = 0) {
        FSynthesizedMesh mesh;
        mesh.genomeHash = vmo.genomeHash;
        mesh.archetype = sdf.archetype;
        mesh.archetypeName = sdf.archetypeName;
        mesh.boundingRadius = sdf.boundingRadius;
        mesh.lodLevel = lodLevel;

        int resolution = computeResolution(lodLevel);
        generateMarchingCubesMesh(mesh, sdf, resolution, vmo);

        mesh.updateHash();
        return mesh;
    }

    FVFXDescriptor mapActionToVFX(const std::string& actionName, const FVisualManifestObject& vmo) {
        FVFXDescriptor vfx;

        if (actionName == "STRIKE") {
            vfx.type = VFXType::EMISSION_PULSE;
            vfx.typeName = "EMISSION_PULSE";
            vfx.intensity = 2.0f + vmo.material.emissionIntensity * 0.5f;
            vfx.durationMs = 300.0f;
            vfx.pulseHz = vmo.material.emissionPulseHz > 0.0f ? vmo.material.emissionPulseHz : 2.0f;
        } else if (actionName == "GUARD") {
            vfx.type = VFXType::SHIELD_FLARE;
            vfx.typeName = "SHIELD_FLARE";
            vfx.intensity = 1.5f;
            vfx.durationMs = 800.0f;
        } else if (actionName == "CHARGE") {
            vfx.type = VFXType::CHARGE_BUILDUP;
            vfx.typeName = "CHARGE_BUILDUP";
            vfx.intensity = 3.0f;
            vfx.durationMs = 1200.0f;
            vfx.pulseHz = 1.0f;
        } else if (actionName == "RETREAT") {
            vfx.type = VFXType::DODGE_AFTERIMAGE;
            vfx.typeName = "DODGE_AFTERIMAGE";
            vfx.intensity = 0.8f;
            vfx.durationMs = 400.0f;
            vfx.particleCount = 50.0f;
        } else if (actionName == "COUNTER") {
            vfx.type = VFXType::COUNTER_FLASH;
            vfx.typeName = "COUNTER_FLASH";
            vfx.intensity = 2.5f;
            vfx.durationMs = 200.0f;
        } else if (actionName == "FEINT") {
            vfx.type = VFXType::FEINT_SHIMMER;
            vfx.typeName = "FEINT_SHIMMER";
            vfx.intensity = 0.6f;
            vfx.durationMs = 600.0f;
            vfx.particleCount = 30.0f;
        } else if (actionName == "FLANK") {
            vfx.type = VFXType::DODGE_AFTERIMAGE;
            vfx.typeName = "DODGE_AFTERIMAGE";
            vfx.intensity = 1.2f;
            vfx.durationMs = 500.0f;
            vfx.particleCount = 75.0f;
        } else {
            vfx.type = VFXType::IDLE_AMBIENT;
            vfx.typeName = "IDLE_AMBIENT";
            vfx.intensity = 0.3f;
            vfx.durationMs = 2000.0f;
        }

        vfx.emissionColor = vmo.material.primaryColor;
        vfx.particleScale = std::max(0.5f, vmo.geometry.scaleX * 0.5f);

        return vfx;
    }

    FSynthesisResult synthesize(const FSovereignPassport& passport) {
        FSynthesisResult result;
        SynthesisCompleteDelegate delegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            result.genomeHash = passport.genomeHash;
            result.entityKey = passport.entityKey;

            auto sdf = buildSDFComposition(passport.vmo);
            result.sdfComposition = sdf;
            result.shaderParams = buildShaderParameters(passport.vmo);
            result.mesh = synthesizeMesh(sdf, passport.vmo, 0);
            result.idleVFX = mapActionToVFX("HOLD", passport.vmo);

            result.synthesisTimestamp = static_cast<int64_t>(std::time(nullptr));
            result.updateHash();

            synthesisCache_[passport.genomeHash] = result;

            stats_.totalSynthesized++;
            stats_.totalVerticesGenerated += result.mesh.vertexCount();
            stats_.totalTrianglesGenerated += result.mesh.triangleCount();
            stats_.totalVFXGenerated++;
            stats_.lastSynthesisTimestamp = result.synthesisTimestamp;
            stats_.archetypeCounts[result.mesh.archetypeName]++;
            stats_.shaderCounts[result.shaderParams.shaderTypeName]++;

            delegate = synthesisCompleteDelegate_;
        }

        if (delegate) {
            delegate(result, passport.entityKey);
        }

        return result;
    }

    FVFXDescriptor triggerActionVFX(const FSovereignPassport& passport, const std::string& actionName) {
        auto vfx = mapActionToVFX(actionName, passport.vmo);
        VFXTriggeredDelegate delegate;

        {
            std::lock_guard<std::mutex> lock(mutex_);
            stats_.totalVFXGenerated++;
            delegate = vfxTriggeredDelegate_;
        }

        if (delegate) {
            delegate(vfx, passport.entityKey);
        }

        return vfx;
    }

    bool verifySynthesisDeterminism(const FSovereignPassport& passport) {
        auto r1 = buildSDFComposition(passport.vmo);
        auto r2 = buildSDFComposition(passport.vmo);
        if (r1.canonicalize() != r2.canonicalize()) return false;

        auto s1 = buildShaderParameters(passport.vmo);
        auto s2 = buildShaderParameters(passport.vmo);
        if (s1.canonicalize() != s2.canonicalize()) return false;

        auto m1 = synthesizeMesh(r1, passport.vmo, 0);
        auto m2 = synthesizeMesh(r2, passport.vmo, 0);
        return m1.meshHash == m2.meshHash;
    }

    std::string generateUE5SynthesizerCode() const {
        std::ostringstream oss;
        oss << "UCLASS(BlueprintType)\n"
            << "class USovereignVisualSynthesizer : public UObject {\n"
            << "    GENERATED_BODY()\n\n"
            << "public:\n"
            << "    UFUNCTION(BlueprintCallable)\n"
            << "    UProceduralMeshComponent* SynthesizeMesh(\n"
            << "        const FSovereignEntityPassport& Passport,\n"
            << "        int32 LODLevel = 0);\n\n"
            << "    UFUNCTION(BlueprintCallable)\n"
            << "    UMaterialInstanceDynamic* CreateMaterialInstance(\n"
            << "        const FSovereignEntityPassport& Passport);\n\n"
            << "    UFUNCTION(BlueprintCallable)\n"
            << "    UNiagaraComponent* TriggerActionVFX(\n"
            << "        const FSovereignEntityPassport& Passport,\n"
            << "        const FString& ActionName);\n\n"
            << "    UFUNCTION(BlueprintCallable)\n"
            << "    static USovereignVisualSynthesizer* GetInstance();\n"
            << "};\n";
        return oss.str();
    }

    std::string generateHLSLShaderStub(ShaderType type) const {
        std::string name = shaderTypeToString(type);
        std::ostringstream oss;
        oss << "// Sovereign Master Material: " << name << "\n"
            << "// Auto-generated by SovereignVisualSynthesizer\n\n"
            << "MaterialFloat3 BaseColor;\n"
            << "MaterialFloat Roughness;\n"
            << "MaterialFloat Metallic;\n"
            << "MaterialFloat Opacity;\n\n";

        switch (type) {
            case ShaderType::VOLCANIC_LAVA:
                oss << "MaterialFloat3 EmissiveColor = BaseColor * EmissionIntensity;\n"
                    << "MaterialFloat LavaPulse = sin(Time * EmissionPulseHz * 6.28318) * 0.5 + 0.5;\n"
                    << "EmissiveColor *= (1.0 + LavaPulse * GlowIntensity);\n"
                    << "MaterialFloat CrackDisplacement = FractalNoise(WorldPosition * MicroDisplacementFreq) * WeatheringIntensity;\n"
                    << "WorldPositionOffset = VertexNormal * CrackDisplacement;\n";
                break;
            case ShaderType::AQUEOUS_CAUSTIC:
                oss << "MaterialFloat CausticPattern = VoronoiNoise(WorldPosition * 3.0 + Time * 0.5);\n"
                    << "MaterialFloat3 SubsurfaceColor = MaterialFloat3(SubsurfaceR, SubsurfaceG, SubsurfaceB);\n"
                    << "Opacity *= lerp(0.6, 1.0, CausticPattern);\n"
                    << "EmissiveColor = SubsurfaceColor * CausticPattern * SubsurfaceStrength;\n";
                break;
            case ShaderType::ETHEREAL_TRANSLUCENT:
                oss << "MaterialFloat FresnelTerm = pow(1.0 - dot(CameraVector, VertexNormal), FresnelPower);\n"
                    << "Opacity = lerp(Opacity * 0.3, Opacity, FresnelTerm);\n"
                    << "EmissiveColor = BaseColor * FresnelTerm * GlowIntensity;\n";
                break;
            case ShaderType::ANISOTROPIC_GLASS:
                oss << "MaterialFloat AnisotropicHighlight = AnisotropyFunction(Tangent, HalfVector, Anisotropy);\n"
                    << "Roughness *= (1.0 - Anisotropy * 0.5);\n"
                    << "Refraction = RefractionIndex;\n"
                    << "Opacity *= 0.85;\n";
                break;
            case ShaderType::SUBSURFACE_SCATTER:
                oss << "MaterialFloat3 SSS = SubsurfaceColor * SubsurfaceStrength;\n"
                    << "SubsurfaceProfile = SSS;\n"
                    << "ShadingModel = MSM_Subsurface;\n";
                break;
            case ShaderType::EMISSIVE_PULSE:
                oss << "MaterialFloat Pulse = sin(Time * EmissionPulseHz * 6.28318) * 0.5 + 0.5;\n"
                    << "EmissiveColor = BaseColor * EmissionIntensity * (0.5 + Pulse * 0.5);\n"
                    << "EmissiveColor *= GlowIntensity;\n";
                break;
            case ShaderType::METALLIC_FLAKE:
                oss << "MaterialFloat FlakePattern = VoronoiNoise(WorldPosition * 50.0);\n"
                    << "Metallic = lerp(Metallic, 1.0, FlakePattern * 0.3);\n"
                    << "Roughness *= lerp(0.8, 1.0, FlakePattern);\n"
                    << "Normal = lerp(VertexNormal, FlakeNormal, FlakePattern * 0.2);\n";
                break;
            default:
                oss << "// Standard PBR — no special effects\n";
                break;
        }

        oss << "\n// GPU Safety: Clamp all outputs\n"
            << "Roughness = clamp(Roughness, 0.04, 1.0);\n"
            << "Metallic = clamp(Metallic, 0.0, 1.0);\n"
            << "Opacity = clamp(Opacity, 0.0, 1.0);\n";

        return oss.str();
    }

    void onSynthesisComplete(SynthesisCompleteDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        synthesisCompleteDelegate_ = delegate;
    }

    void onVFXTriggered(VFXTriggeredDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        vfxTriggeredDelegate_ = delegate;
    }

    FSynthesizerStats getStats() {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    void resetStats() {
        std::lock_guard<std::mutex> lock(mutex_);
        stats_ = FSynthesizerStats{};
        synthesisCache_.clear();
    }

private:
    SovereignVisualSynthesizer() = default;

    std::mutex mutex_;
    FSynthesizerStats stats_;
    std::unordered_map<std::string, FSynthesisResult> synthesisCache_;
    SynthesisCompleteDelegate synthesisCompleteDelegate_;
    VFXTriggeredDelegate vfxTriggeredDelegate_;

    static void parseHexColor(const std::string& hex, float& r, float& g, float& b) {
        if (hex.size() != 7 || hex[0] != '#') { r = g = b = 0.5f; return; }
        auto parseHex = [](char hi, char lo) -> float {
            auto val = [](char c) -> int {
                if (c >= '0' && c <= '9') return c - '0';
                if (c >= 'A' && c <= 'F') return 10 + c - 'A';
                if (c >= 'a' && c <= 'f') return 10 + c - 'a';
                return 0;
            };
            return (val(hi) * 16 + val(lo)) / 255.0f;
        };
        r = parseHex(hex[1], hex[2]);
        g = parseHex(hex[3], hex[4]);
        b = parseHex(hex[5], hex[6]);
    }

    static int computeResolution(int lodLevel) {
        switch (lodLevel) {
            case 0: return 32;
            case 1: return 16;
            case 2: return 8;
            default: return 4;
        }
    }

    void applyWeatheringFromArchetype(FShaderParameters& params, const FVisualManifestObject& vmo) {
        if (vmo.material.shaderType == ShaderType::VOLCANIC_LAVA) {
            params.weatheringIntensity = 0.8f;
            params.microDisplacementFreq = 5.0f;
            params.displacementScale = 0.1f;
        } else if (vmo.material.shaderType == ShaderType::AQUEOUS_CAUSTIC) {
            params.weatheringIntensity = 0.3f;
            params.microDisplacementFreq = 2.0f;
            params.displacementScale = 0.05f;
        } else if (vmo.geometry.meshArchetype == MeshArchetype::JAGGED_CRYSTAL) {
            params.weatheringIntensity = 0.5f;
            params.microDisplacementFreq = 8.0f;
            params.displacementScale = 0.15f;
        } else if (vmo.geometry.meshArchetype == MeshArchetype::ORGANIC_BLOOM) {
            params.weatheringIntensity = 0.2f;
            params.microDisplacementFreq = 1.5f;
            params.displacementScale = 0.03f;
        } else {
            params.weatheringIntensity = 0.0f;
            params.microDisplacementFreq = 0.0f;
            params.displacementScale = 0.0f;
        }
    }

    static std::vector<FSDFPrimitive> buildSmoothOrb(const FVisualManifestObject& vmo) {
        std::vector<FSDFPrimitive> prims;
        FSDFPrimitive core;
        core.shape = FSDFPrimitive::Shape::SPHERE;
        core.sizeX = vmo.geometry.scaleX;
        core.sizeY = vmo.geometry.scaleY;
        core.sizeZ = vmo.geometry.scaleZ;
        core.weight = 1.0f;
        core.blendRadius = 0.5f;
        prims.push_back(core);

        FSDFPrimitive cap;
        cap.shape = FSDFPrimitive::Shape::SPHERE;
        cap.posY = vmo.geometry.scaleY * 0.6f;
        cap.sizeX = vmo.geometry.scaleX * 0.5f;
        cap.sizeY = vmo.geometry.scaleY * 0.4f;
        cap.sizeZ = vmo.geometry.scaleZ * 0.5f;
        cap.blendRadius = 0.4f;
        prims.push_back(cap);

        return prims;
    }

    static std::vector<FSDFPrimitive> buildAngularShard(const FVisualManifestObject& vmo) {
        std::vector<FSDFPrimitive> prims;
        FSDFPrimitive base;
        base.shape = FSDFPrimitive::Shape::BOX;
        base.sizeX = vmo.geometry.scaleX;
        base.sizeY = vmo.geometry.scaleY * 1.5f;
        base.sizeZ = vmo.geometry.scaleZ * 0.6f;
        base.blendRadius = 0.05f;
        prims.push_back(base);

        FSDFPrimitive spike;
        spike.shape = FSDFPrimitive::Shape::CONE;
        spike.posY = vmo.geometry.scaleY;
        spike.sizeX = vmo.geometry.scaleX * 0.3f;
        spike.sizeY = vmo.geometry.scaleY * 0.8f;
        spike.sizeZ = vmo.geometry.scaleZ * 0.3f;
        spike.blendRadius = 0.02f;
        prims.push_back(spike);

        FSDFPrimitive wing;
        wing.shape = FSDFPrimitive::Shape::BOX;
        wing.posX = vmo.geometry.scaleX * 0.8f;
        wing.sizeX = vmo.geometry.scaleX * 0.5f;
        wing.sizeY = vmo.geometry.scaleY * 0.3f;
        wing.sizeZ = vmo.geometry.scaleZ * 0.1f;
        wing.blendRadius = 0.03f;
        prims.push_back(wing);

        return prims;
    }

    static std::vector<FSDFPrimitive> buildJaggedCrystal(const FVisualManifestObject& vmo) {
        std::vector<FSDFPrimitive> prims;
        for (int i = 0; i < 5; i++) {
            FSDFPrimitive crystal;
            crystal.shape = FSDFPrimitive::Shape::CONE;
            float angle = static_cast<float>(i) * 1.2566f;
            crystal.posX = std::cos(angle) * vmo.geometry.scaleX * 0.4f;
            crystal.posZ = std::sin(angle) * vmo.geometry.scaleZ * 0.4f;
            crystal.posY = (i % 2 == 0) ? 0.0f : vmo.geometry.scaleY * 0.3f;
            crystal.sizeX = vmo.geometry.scaleX * 0.2f;
            crystal.sizeY = vmo.geometry.scaleY * (0.8f + static_cast<float>(i) * 0.15f);
            crystal.sizeZ = vmo.geometry.scaleZ * 0.2f;
            crystal.blendRadius = 0.08f;
            prims.push_back(crystal);
        }
        return prims;
    }

    static std::vector<FSDFPrimitive> buildFlowingTendril(const FVisualManifestObject& vmo) {
        std::vector<FSDFPrimitive> prims;
        FSDFPrimitive core;
        core.shape = FSDFPrimitive::Shape::TORUS;
        core.sizeX = vmo.geometry.scaleX;
        core.sizeY = vmo.geometry.scaleY * 0.3f;
        core.sizeZ = vmo.geometry.scaleZ;
        core.blendRadius = 0.5f;
        prims.push_back(core);

        for (int i = 0; i < 3; i++) {
            FSDFPrimitive tendril;
            tendril.shape = FSDFPrimitive::Shape::CAPSULE;
            float angle = static_cast<float>(i) * 2.094f;
            tendril.posX = std::cos(angle) * vmo.geometry.scaleX * 0.6f;
            tendril.posZ = std::sin(angle) * vmo.geometry.scaleZ * 0.6f;
            tendril.posY = vmo.geometry.scaleY * 0.2f * static_cast<float>(i);
            tendril.sizeX = 0.15f;
            tendril.sizeY = vmo.geometry.scaleY * 0.8f;
            tendril.sizeZ = 0.15f;
            tendril.blendRadius = 0.4f;
            prims.push_back(tendril);
        }
        return prims;
    }

    static std::vector<FSDFPrimitive> buildDenseMonolith(const FVisualManifestObject& vmo) {
        std::vector<FSDFPrimitive> prims;
        FSDFPrimitive slab;
        slab.shape = FSDFPrimitive::Shape::BOX;
        slab.sizeX = vmo.geometry.scaleX * 0.8f;
        slab.sizeY = vmo.geometry.scaleY * 2.0f;
        slab.sizeZ = vmo.geometry.scaleZ * 0.8f;
        slab.blendRadius = 0.1f;
        prims.push_back(slab);

        FSDFPrimitive cap;
        cap.shape = FSDFPrimitive::Shape::SPHERE;
        cap.posY = vmo.geometry.scaleY * 1.8f;
        cap.sizeX = vmo.geometry.scaleX * 0.6f;
        cap.sizeY = vmo.geometry.scaleY * 0.4f;
        cap.sizeZ = vmo.geometry.scaleZ * 0.6f;
        cap.blendRadius = 0.2f;
        prims.push_back(cap);

        return prims;
    }

    static std::vector<FSDFPrimitive> buildHollowShell(const FVisualManifestObject& vmo) {
        std::vector<FSDFPrimitive> prims;
        FSDFPrimitive outer;
        outer.shape = FSDFPrimitive::Shape::SPHERE;
        outer.sizeX = vmo.geometry.scaleX;
        outer.sizeY = vmo.geometry.scaleY;
        outer.sizeZ = vmo.geometry.scaleZ;
        outer.blendRadius = 0.2f;
        outer.weight = 1.0f;
        prims.push_back(outer);

        FSDFPrimitive inner;
        inner.shape = FSDFPrimitive::Shape::SPHERE;
        inner.sizeX = vmo.geometry.scaleX * 0.7f;
        inner.sizeY = vmo.geometry.scaleY * 0.7f;
        inner.sizeZ = vmo.geometry.scaleZ * 0.7f;
        inner.blendRadius = 0.15f;
        inner.weight = -1.0f;
        prims.push_back(inner);

        FSDFPrimitive opening;
        opening.shape = FSDFPrimitive::Shape::CYLINDER;
        opening.posY = vmo.geometry.scaleY * 0.5f;
        opening.sizeX = vmo.geometry.scaleX * 0.3f;
        opening.sizeY = vmo.geometry.scaleY * 0.5f;
        opening.sizeZ = vmo.geometry.scaleZ * 0.3f;
        opening.weight = -1.0f;
        prims.push_back(opening);

        return prims;
    }

    static std::vector<FSDFPrimitive> buildCompoundCluster(const FVisualManifestObject& vmo) {
        std::vector<FSDFPrimitive> prims;
        for (int i = 0; i < 4; i++) {
            FSDFPrimitive node;
            node.shape = (i % 2 == 0) ? FSDFPrimitive::Shape::SPHERE : FSDFPrimitive::Shape::BOX;
            float angle = static_cast<float>(i) * 1.5708f;
            node.posX = std::cos(angle) * vmo.geometry.scaleX * 0.5f;
            node.posZ = std::sin(angle) * vmo.geometry.scaleZ * 0.5f;
            node.posY = (i < 2) ? 0.0f : vmo.geometry.scaleY * 0.5f;
            node.sizeX = vmo.geometry.scaleX * 0.4f;
            node.sizeY = vmo.geometry.scaleY * 0.4f;
            node.sizeZ = vmo.geometry.scaleZ * 0.4f;
            node.blendRadius = 0.2f;
            prims.push_back(node);
        }
        return prims;
    }

    static std::vector<FSDFPrimitive> buildOrganicBloom(const FVisualManifestObject& vmo) {
        std::vector<FSDFPrimitive> prims;
        FSDFPrimitive bulb;
        bulb.shape = FSDFPrimitive::Shape::SPHERE;
        bulb.sizeX = vmo.geometry.scaleX * 0.8f;
        bulb.sizeY = vmo.geometry.scaleY * 0.6f;
        bulb.sizeZ = vmo.geometry.scaleZ * 0.8f;
        bulb.blendRadius = 0.6f;
        prims.push_back(bulb);

        for (int i = 0; i < 5; i++) {
            FSDFPrimitive petal;
            petal.shape = FSDFPrimitive::Shape::SPHERE;
            float angle = static_cast<float>(i) * 1.2566f;
            petal.posX = std::cos(angle) * vmo.geometry.scaleX * 0.5f;
            petal.posZ = std::sin(angle) * vmo.geometry.scaleZ * 0.5f;
            petal.posY = vmo.geometry.scaleY * 0.2f;
            petal.sizeX = vmo.geometry.scaleX * 0.35f;
            petal.sizeY = vmo.geometry.scaleY * 0.15f;
            petal.sizeZ = vmo.geometry.scaleZ * 0.35f;
            petal.blendRadius = 0.5f;
            prims.push_back(petal);
        }

        FSDFPrimitive stem;
        stem.shape = FSDFPrimitive::Shape::CAPSULE;
        stem.posY = -vmo.geometry.scaleY * 0.8f;
        stem.sizeX = vmo.geometry.scaleX * 0.1f;
        stem.sizeY = vmo.geometry.scaleY * 0.6f;
        stem.sizeZ = vmo.geometry.scaleZ * 0.1f;
        stem.blendRadius = 0.4f;
        prims.push_back(stem);

        return prims;
    }

    static float evaluateSDF(const FSDFComposition& comp, float px, float py, float pz) {
        float result = 1e9f;
        for (const auto& prim : comp.primitives) {
            float dx = px - prim.posX;
            float dy = py - prim.posY;
            float dz = pz - prim.posZ;

            float dist = 0.0f;
            switch (prim.shape) {
                case FSDFPrimitive::Shape::SPHERE:
                    dist = std::sqrt(dx*dx/(prim.sizeX*prim.sizeX) + dy*dy/(prim.sizeY*prim.sizeY) + dz*dz/(prim.sizeZ*prim.sizeZ)) - 1.0f;
                    break;
                case FSDFPrimitive::Shape::BOX: {
                    float qx = std::abs(dx) - prim.sizeX;
                    float qy = std::abs(dy) - prim.sizeY;
                    float qz = std::abs(dz) - prim.sizeZ;
                    dist = std::sqrt(std::max(qx,0.0f)*std::max(qx,0.0f) + std::max(qy,0.0f)*std::max(qy,0.0f) + std::max(qz,0.0f)*std::max(qz,0.0f))
                           + std::min(std::max({qx,qy,qz}), 0.0f);
                    break;
                }
                case FSDFPrimitive::Shape::CYLINDER: {
                    float radialDist = std::sqrt(dx*dx/(prim.sizeX*prim.sizeX) + dz*dz/(prim.sizeZ*prim.sizeZ)) - 1.0f;
                    float heightDist = std::abs(dy) - prim.sizeY;
                    dist = std::max(radialDist, heightDist);
                    break;
                }
                case FSDFPrimitive::Shape::TORUS: {
                    float q1 = std::sqrt(dx*dx + dz*dz) - prim.sizeX;
                    dist = std::sqrt(q1*q1 + dy*dy) - prim.sizeY;
                    break;
                }
                case FSDFPrimitive::Shape::CONE: {
                    float radial = std::sqrt(dx*dx + dz*dz);
                    float coneAngle = std::atan2(prim.sizeX, prim.sizeY);
                    float projDist = radial * std::cos(coneAngle) - (prim.sizeY - dy) * std::sin(coneAngle);
                    dist = std::max(projDist, dy - prim.sizeY);
                    dist = std::max(dist, -dy);
                    break;
                }
                case FSDFPrimitive::Shape::CAPSULE: {
                    float clampedY = std::max(-prim.sizeY, std::min(prim.sizeY, dy));
                    float ddx = dx, ddy = dy - clampedY, ddz = dz;
                    dist = std::sqrt(ddx*ddx + ddy*ddy + ddz*ddz) - prim.sizeX;
                    break;
                }
            }

            if (prim.weight < 0) {
                result = std::max(result, -dist);
            } else {
                float k = comp.globalBlendFactor;
                if (k > 0.01f) {
                    float h = std::max(k - std::abs(result - dist), 0.0f) / k;
                    result = std::min(result, dist) - h * h * k * 0.25f;
                } else {
                    result = std::min(result, dist);
                }
            }
        }
        return result;
    }

    static void generateMarchingCubesMesh(FSynthesizedMesh& mesh, const FSDFComposition& sdf, int resolution, const FVisualManifestObject& vmo) {
        float extent = sdf.boundingRadius * 1.5f;
        if (extent < 0.1f) extent = 2.0f;
        float step = (2.0f * extent) / static_cast<float>(resolution);

        for (int iz = 0; iz < resolution; iz++) {
            for (int ix = 0; ix < resolution; ix++) {
                float px = -extent + (static_cast<float>(ix) + 0.5f) * step;
                float pz = -extent + (static_cast<float>(iz) + 0.5f) * step;

                for (int iy = 0; iy < resolution; iy++) {
                    float py = -extent + (static_cast<float>(iy) + 0.5f) * step;

                    float d = evaluateSDF(sdf, px, py, pz);
                    if (d < 0.0f) {
                        float eps = step * 0.1f;
                        float gx = evaluateSDF(sdf, px + eps, py, pz) - evaluateSDF(sdf, px - eps, py, pz);
                        float gy = evaluateSDF(sdf, px, py + eps, pz) - evaluateSDF(sdf, px, py - eps, pz);
                        float gz = evaluateSDF(sdf, px, py, pz + eps) - evaluateSDF(sdf, px, py, pz - eps);
                        float glen = std::sqrt(gx*gx + gy*gy + gz*gz);
                        if (glen > 1e-6f) { gx /= glen; gy /= glen; gz /= glen; }

                        FSynthesizedVertex vert;
                        vert.x = px; vert.y = py; vert.z = pz;
                        vert.nx = gx; vert.ny = gy; vert.nz = gz;
                        vert.u = (px + extent) / (2.0f * extent) * vmo.geometry.uvTilingU;
                        vert.v = (pz + extent) / (2.0f * extent) * vmo.geometry.uvTilingV;
                        mesh.vertices.push_back(vert);
                    }
                }
            }
        }

        for (size_t i = 0; i + 2 < mesh.vertices.size(); i += 3) {
            mesh.indices.push_back(static_cast<uint32_t>(i));
            mesh.indices.push_back(static_cast<uint32_t>(i + 1));
            mesh.indices.push_back(static_cast<uint32_t>(i + 2));
        }
    }
};

}
