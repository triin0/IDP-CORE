#pragma once

#include "BiologicalForge.h"
#include "ChronosEngine.h"
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

namespace Sovereign {

enum class CameraPerspective {
    HERO,
    STANDARD,
    MACRO,
    CINEMATIC
};

inline std::string perspectiveToString(CameraPerspective p) {
    switch (p) {
        case CameraPerspective::HERO:      return "Hero";
        case CameraPerspective::STANDARD:  return "Standard";
        case CameraPerspective::MACRO:     return "Macro";
        case CameraPerspective::CINEMATIC: return "Cinematic";
    }
    return "Standard";
}

struct FCineRigConfig {
    float springArmLength = 300.0f;
    float focalLength = 35.0f;
    float aperture = 2.8f;
    float focusDistance = 200.0f;
    float fieldOfView = 60.0f;
    CameraPerspective perspective = CameraPerspective::STANDARD;
    std::string perspectiveName = "Standard";
    float dollySpeed = 1.0f;
    float orbitSpeed = 1.0f;
    float minZoom = 0.3f;
    float maxZoom = 3.0f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"aperture\":" << aperture
            << ",\"dollySpeed\":" << dollySpeed
            << ",\"fieldOfView\":" << fieldOfView
            << ",\"focalLength\":" << focalLength
            << ",\"focusDistance\":" << focusDistance
            << ",\"maxZoom\":" << maxZoom
            << ",\"minZoom\":" << minZoom
            << ",\"orbitSpeed\":" << orbitSpeed
            << ",\"perspective\":\"" << perspectiveName << "\""
            << ",\"springArmLength\":" << springArmLength
            << "}";
        return oss.str();
    }
};

struct FLightingProfile {
    float globalIlluminationIntensity = 1.0f;
    float bloomThreshold = 0.8f;
    float bloomIntensity = 0.5f;
    float lensFlareIntensity = 0.0f;
    float exposureBias = 0.0f;
    float chromaticAberrationIntensity = 0.0f;
    float refractionDepth = 0.0f;
    float ssrQuality = 0.5f;
    float causticsIntensity = 0.0f;
    float reflectionSamples = 4.0f;
    bool enableHDRISkybox = false;
    bool enableHighContrastHDRI = false;
    FLinearColor ambientTint = {1.0f, 1.0f, 1.0f, 1.0f};
    FLinearColor fogColor = {0.5f, 0.5f, 0.6f, 1.0f};
    float fogDensity = 0.01f;
    float vignetteIntensity = 0.2f;
    float filmGrainIntensity = 0.0f;
    float saturation = 1.0f;
    float contrast = 1.0f;
    float depthOfFieldFstop = 4.0f;
    float temperatureShift = 6500.0f;
    std::string profileName = "Default";

    bool allValuesClamped() const {
        auto in01 = [](float v) { return v >= 0.0f && v <= 1.0f; };
        auto in010 = [](float v) { return v >= 0.0f && v <= 10.0f; };
        return in01(globalIlluminationIntensity) && in01(bloomThreshold) &&
               in010(bloomIntensity) && in010(lensFlareIntensity) &&
               exposureBias >= -5.0f && exposureBias <= 5.0f &&
               in01(chromaticAberrationIntensity) && in010(refractionDepth) &&
               in01(ssrQuality) && in010(causticsIntensity) &&
               reflectionSamples >= 1.0f && reflectionSamples <= 64.0f &&
               in01(fogDensity) && in01(vignetteIntensity) &&
               in01(filmGrainIntensity) && saturation >= 0.0f && saturation <= 2.0f &&
               contrast >= 0.0f && contrast <= 2.0f;
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"bloomIntensity\":" << bloomIntensity
            << ",\"bloomThreshold\":" << bloomThreshold
            << ",\"causticsIntensity\":" << causticsIntensity
            << ",\"chromaticAberrationIntensity\":" << chromaticAberrationIntensity
            << ",\"contrast\":" << contrast
            << ",\"enableHDRISkybox\":" << (enableHDRISkybox ? "true" : "false")
            << ",\"enableHighContrastHDRI\":" << (enableHighContrastHDRI ? "true" : "false")
            << ",\"exposureBias\":" << exposureBias
            << ",\"filmGrainIntensity\":" << filmGrainIntensity
            << ",\"fogDensity\":" << fogDensity
            << ",\"globalIlluminationIntensity\":" << globalIlluminationIntensity
            << ",\"lensFlareIntensity\":" << lensFlareIntensity
            << ",\"profileName\":\"" << profileName << "\""
            << ",\"reflectionSamples\":" << reflectionSamples
            << ",\"refractionDepth\":" << refractionDepth
            << ",\"saturation\":" << saturation
            << ",\"ssrQuality\":" << ssrQuality
            << ",\"vignetteIntensity\":" << vignetteIntensity
            << "}";
        return oss.str();
    }
};

struct FInspectionState {
    float rotationYaw = 0.0f;
    float rotationPitch = 0.0f;
    float rotationRoll = 0.0f;
    float zoomLevel = 1.0f;
    float orbitRadius = 300.0f;
    int64_t timestamp = 0;
    std::string entityKey;
    std::string stateHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"entityKey\":\"" << entityKey << "\""
            << ",\"orbitRadius\":" << orbitRadius
            << ",\"rotationPitch\":" << rotationPitch
            << ",\"rotationRoll\":" << rotationRoll
            << ",\"rotationYaw\":" << rotationYaw
            << ",\"zoomLevel\":" << zoomLevel
            << "}";
        return oss.str();
    }

    std::string computeHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void updateHash() {
        stateHash = computeHash();
    }

    bool verifyHash() const {
        return !stateHash.empty() && stateHash == computeHash();
    }
};

struct FGeneLocus {
    std::string name;
    int byteOffset;
    int byteLength;
    uint32_t rawValue;
    float normalizedValue;
    std::string hexValue;
};

enum class VerificationStatus {
    UNVERIFIED,
    VERIFIED,
    MISMATCH,
    SERVER_UNREACHABLE,
    PENDING
};

inline std::string verificationStatusToString(VerificationStatus s) {
    switch (s) {
        case VerificationStatus::UNVERIFIED:        return "UNVERIFIED";
        case VerificationStatus::VERIFIED:          return "VERIFIED";
        case VerificationStatus::MISMATCH:          return "MISMATCH";
        case VerificationStatus::SERVER_UNREACHABLE: return "SERVER_UNREACHABLE";
        case VerificationStatus::PENDING:           return "PENDING";
    }
    return "UNVERIFIED";
}

struct FSovereignPedigree {
    std::string rawHash;
    std::vector<FGeneLocus> loci;
    bool serverVerified = false;
    VerificationStatus verificationStatus = VerificationStatus::UNVERIFIED;
    std::string verificationStatusName = "UNVERIFIED";
    std::string authoritySource;
    int64_t lastVerifiedTimestamp = 0;
    std::string phenotypeClassName;
    std::string meshFamilyName;
    FLinearColor primaryColor;
    FLinearColor accentColor;

    bool isVerifiedBadgeGreen() const {
        return serverVerified && verificationStatus == VerificationStatus::VERIFIED;
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"authoritySource\":\"" << authoritySource << "\""
            << ",\"meshFamily\":\"" << meshFamilyName << "\""
            << ",\"phenotypeClass\":\"" << phenotypeClassName << "\""
            << ",\"rawHash\":\"" << rawHash << "\""
            << ",\"verified\":" << (serverVerified ? "true" : "false")
            << ",\"verificationStatus\":\"" << verificationStatusName << "\""
            << "}";
        return oss.str();
    }
};

struct ShowroomStats {
    int totalInspections = 0;
    int totalStatesSaved = 0;
    int totalStatesRecovered = 0;
    int totalVerifications = 0;
    int totalVerificationsSucceeded = 0;
    int totalVerificationsFailed = 0;
    int totalLightingProfilesApplied = 0;
    int totalCameraAdjustments = 0;
    int64_t lastInspectionTimestamp = 0;
};

using ShowroomReadyDelegate = std::function<void(const FVisualPhenotype&, const FCineRigConfig&, const FLightingProfile&)>;
using InspectionStateChangedDelegate = std::function<void(const FInspectionState&)>;
using VerificationCompleteDelegate = std::function<void(const FSovereignPedigree&, bool success)>;
using LightingProfileChangedDelegate = std::function<void(const FLightingProfile&, PhenotypeClass)>;

class ASovereignCineCamera {
public:
    FCineRigConfig computeRig(const FVisualPhenotype& phenotype) const {
        FCineRigConfig rig;
        float avgScale = (phenotype.morphology.scaleX +
                          phenotype.morphology.scaleY +
                          phenotype.morphology.scaleZ) / 3.0f;

        if (avgScale > 2.0f) {
            rig.perspective = CameraPerspective::HERO;
            rig.perspectiveName = "Hero";
            rig.springArmLength = 600.0f + (avgScale - 2.0f) * 200.0f;
            rig.focalLength = 18.0f;
            rig.fieldOfView = 90.0f;
            rig.aperture = 5.6f;
            rig.focusDistance = rig.springArmLength * 0.8f;
            rig.dollySpeed = 0.5f;
            rig.orbitSpeed = 0.6f;
        } else if (avgScale < 1.0f) {
            rig.perspective = CameraPerspective::MACRO;
            rig.perspectiveName = "Macro";
            rig.springArmLength = 80.0f + avgScale * 60.0f;
            rig.focalLength = 100.0f;
            rig.fieldOfView = 25.0f;
            rig.aperture = 1.4f;
            rig.focusDistance = rig.springArmLength * 0.95f;
            rig.dollySpeed = 2.0f;
            rig.orbitSpeed = 1.5f;
        } else {
            float t = (avgScale - 1.0f) / 1.0f;
            if (phenotype.material.emissionIntensity > 3.0f ||
                phenotype.classification == PhenotypeClass::ETHEREAL) {
                rig.perspective = CameraPerspective::CINEMATIC;
                rig.perspectiveName = "Cinematic";
                rig.springArmLength = 250.0f + t * 150.0f;
                rig.focalLength = 50.0f;
                rig.fieldOfView = 45.0f;
                rig.aperture = 2.0f;
                rig.focusDistance = rig.springArmLength * 0.7f;
                rig.dollySpeed = 0.8f;
                rig.orbitSpeed = 0.7f;
            } else {
                rig.perspective = CameraPerspective::STANDARD;
                rig.perspectiveName = "Standard";
                rig.springArmLength = 200.0f + t * 200.0f;
                rig.focalLength = 35.0f;
                rig.fieldOfView = 60.0f;
                rig.aperture = 2.8f;
                rig.focusDistance = rig.springArmLength * 0.85f;
                rig.dollySpeed = 1.0f;
                rig.orbitSpeed = 1.0f;
            }
        }

        rig.springArmLength = clamp(rig.springArmLength, 50.0f, 1500.0f);
        rig.focalLength = clamp(rig.focalLength, 12.0f, 200.0f);
        rig.fieldOfView = clamp(rig.fieldOfView, 15.0f, 120.0f);
        rig.aperture = clamp(rig.aperture, 1.0f, 22.0f);
        rig.focusDistance = clamp(rig.focusDistance, 10.0f, 2000.0f);

        return rig;
    }

private:
    static float clamp(float v, float lo, float hi) {
        return std::max(lo, std::min(hi, v));
    }
};

class USovereignLightingRig {
public:
    static FLightingProfile computeProfile(PhenotypeClass cls, const FVisualPhenotype& phenotype) {
        FLightingProfile profile;

        switch (cls) {
            case PhenotypeClass::VOLCANIC:
                profile.profileName = "Volcanic";
                profile.globalIlluminationIntensity = 0.3f;
                profile.bloomThreshold = 0.1f;
                profile.bloomIntensity = 2.5f;
                profile.lensFlareIntensity = 3.0f;
                profile.exposureBias = 1.5f;
                profile.ambientTint = {1.0f, 0.3f, 0.1f, 1.0f};
                profile.fogColor = {0.8f, 0.2f, 0.05f, 1.0f};
                profile.fogDensity = 0.08f;
                profile.vignetteIntensity = 0.6f;
                profile.saturation = 1.3f;
                profile.contrast = 1.4f;
                profile.temperatureShift = 3500.0f;
                profile.filmGrainIntensity = 0.1f;
                profile.reflectionSamples = 8.0f;
                break;

            case PhenotypeClass::METALLIC:
                profile.profileName = "Metallic";
                profile.globalIlluminationIntensity = 0.8f;
                profile.bloomThreshold = 0.6f;
                profile.bloomIntensity = 0.8f;
                profile.reflectionSamples = 32.0f;
                profile.enableHDRISkybox = true;
                profile.enableHighContrastHDRI = true;
                profile.exposureBias = 0.5f;
                profile.ambientTint = {0.9f, 0.92f, 0.95f, 1.0f};
                profile.fogDensity = 0.005f;
                profile.vignetteIntensity = 0.15f;
                profile.saturation = 0.9f;
                profile.contrast = 1.2f;
                profile.temperatureShift = 7000.0f;
                profile.depthOfFieldFstop = 8.0f;
                break;

            case PhenotypeClass::CRYSTALLINE:
                profile.profileName = "Crystalline";
                profile.globalIlluminationIntensity = 0.9f;
                profile.bloomThreshold = 0.3f;
                profile.bloomIntensity = 1.2f;
                profile.chromaticAberrationIntensity = 0.6f;
                profile.refractionDepth = 3.0f;
                profile.reflectionSamples = 16.0f;
                profile.enableHDRISkybox = true;
                profile.exposureBias = 0.8f;
                profile.ambientTint = {0.85f, 0.9f, 1.0f, 1.0f};
                profile.fogColor = {0.7f, 0.75f, 0.9f, 1.0f};
                profile.fogDensity = 0.02f;
                profile.vignetteIntensity = 0.1f;
                profile.saturation = 1.1f;
                profile.contrast = 1.15f;
                profile.temperatureShift = 8000.0f;
                break;

            case PhenotypeClass::AQUEOUS:
                profile.profileName = "Aqueous";
                profile.globalIlluminationIntensity = 0.6f;
                profile.bloomThreshold = 0.5f;
                profile.bloomIntensity = 0.6f;
                profile.ssrQuality = 0.95f;
                profile.causticsIntensity = 4.0f;
                profile.reflectionSamples = 12.0f;
                profile.exposureBias = -0.3f;
                profile.ambientTint = {0.4f, 0.6f, 0.85f, 1.0f};
                profile.fogColor = {0.3f, 0.5f, 0.7f, 1.0f};
                profile.fogDensity = 0.06f;
                profile.vignetteIntensity = 0.3f;
                profile.saturation = 0.85f;
                profile.contrast = 0.9f;
                profile.temperatureShift = 5500.0f;
                profile.chromaticAberrationIntensity = 0.15f;
                break;

            case PhenotypeClass::ETHEREAL:
                profile.profileName = "Ethereal";
                profile.globalIlluminationIntensity = 0.5f;
                profile.bloomThreshold = 0.2f;
                profile.bloomIntensity = 2.0f;
                profile.lensFlareIntensity = 1.5f;
                profile.chromaticAberrationIntensity = 0.3f;
                profile.reflectionSamples = 8.0f;
                profile.exposureBias = 1.0f;
                profile.ambientTint = {0.8f, 0.7f, 1.0f, 1.0f};
                profile.fogColor = {0.6f, 0.5f, 0.8f, 1.0f};
                profile.fogDensity = 0.04f;
                profile.vignetteIntensity = 0.4f;
                profile.saturation = 1.2f;
                profile.contrast = 1.1f;
                profile.temperatureShift = 7500.0f;
                profile.filmGrainIntensity = 0.05f;
                break;

            case PhenotypeClass::ORGANIC:
            default:
                profile.profileName = "Organic";
                profile.globalIlluminationIntensity = 0.7f;
                profile.bloomThreshold = 0.7f;
                profile.bloomIntensity = 0.4f;
                profile.reflectionSamples = 4.0f;
                profile.exposureBias = 0.0f;
                profile.ambientTint = {0.95f, 0.98f, 0.9f, 1.0f};
                profile.fogColor = {0.6f, 0.65f, 0.55f, 1.0f};
                profile.fogDensity = 0.02f;
                profile.vignetteIntensity = 0.2f;
                profile.saturation = 1.0f;
                profile.contrast = 1.0f;
                profile.temperatureShift = 6500.0f;
                break;
        }

        tintFromPhenotype(profile, phenotype);

        profile.globalIlluminationIntensity = clamp01(profile.globalIlluminationIntensity);
        profile.bloomThreshold = clamp01(profile.bloomThreshold);
        profile.bloomIntensity = clamp(profile.bloomIntensity, 0.0f, 10.0f);
        profile.lensFlareIntensity = clamp(profile.lensFlareIntensity, 0.0f, 10.0f);
        profile.exposureBias = clamp(profile.exposureBias, -5.0f, 5.0f);
        profile.chromaticAberrationIntensity = clamp01(profile.chromaticAberrationIntensity);
        profile.refractionDepth = clamp(profile.refractionDepth, 0.0f, 10.0f);
        profile.ssrQuality = clamp01(profile.ssrQuality);
        profile.causticsIntensity = clamp(profile.causticsIntensity, 0.0f, 10.0f);
        profile.reflectionSamples = clamp(profile.reflectionSamples, 1.0f, 64.0f);
        profile.fogDensity = clamp01(profile.fogDensity);
        profile.vignetteIntensity = clamp01(profile.vignetteIntensity);
        profile.filmGrainIntensity = clamp01(profile.filmGrainIntensity);
        profile.saturation = clamp(profile.saturation, 0.0f, 2.0f);
        profile.contrast = clamp(profile.contrast, 0.0f, 2.0f);

        return profile;
    }

    static bool verifyZeroDrift(const FLightingProfile& a, const FLightingProfile& b) {
        return a.canonicalize() == b.canonicalize();
    }

private:
    static float clamp01(float v) { return std::max(0.0f, std::min(1.0f, v)); }
    static float clamp(float v, float lo, float hi) { return std::max(lo, std::min(hi, v)); }

    static void tintFromPhenotype(FLightingProfile& profile, const FVisualPhenotype& p) {
        float emitFactor = p.material.emissionIntensity / 10.0f;
        profile.ambientTint.R = clamp01(profile.ambientTint.R + p.primaryColor.R * 0.1f * emitFactor);
        profile.ambientTint.G = clamp01(profile.ambientTint.G + p.primaryColor.G * 0.1f * emitFactor);
        profile.ambientTint.B = clamp01(profile.ambientTint.B + p.primaryColor.B * 0.1f * emitFactor);
    }
};

class ASovereignShowroom {
public:
    static ASovereignShowroom& Get() {
        static ASovereignShowroom instance;
        return instance;
    }

    ASovereignShowroom(const ASovereignShowroom&) = delete;
    ASovereignShowroom& operator=(const ASovereignShowroom&) = delete;

    struct ShowroomScene {
        FVisualPhenotype phenotype;
        FCineRigConfig cineRig;
        FLightingProfile lighting;
        FInspectionState inspectionState;
        FSovereignPedigree pedigree;
        bool active = false;
    };

    ShowroomScene loadEntity(const std::string& entityKey, const FVisualPhenotype& phenotype) {
        std::lock_guard<std::mutex> lock(mutex_);

        ShowroomScene scene;
        scene.phenotype = phenotype;
        scene.active = true;

        scene.cineRig = camera_.computeRig(phenotype);
        stats_.totalCameraAdjustments++;

        scene.lighting = USovereignLightingRig::computeProfile(
            phenotype.classification, phenotype);
        stats_.totalLightingProfilesApplied++;

        scene.inspectionState.entityKey = entityKey;
        scene.inspectionState.zoomLevel = 1.0f;
        scene.inspectionState.orbitRadius = scene.cineRig.springArmLength;
        scene.inspectionState.timestamp = currentTimestamp();
        scene.inspectionState.updateHash();

        scene.pedigree = buildPedigree(phenotype);

        activeScene_ = scene;
        stats_.totalInspections++;
        stats_.lastInspectionTimestamp = currentTimestamp();

        if (showroomReadyDelegate_) {
            showroomReadyDelegate_(scene.phenotype, scene.cineRig, scene.lighting);
        }

        return scene;
    }

    void updateInspectionRotation(float yaw, float pitch, float roll, float zoom) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!activeScene_.active) return;

        activeScene_.inspectionState.rotationYaw = yaw;
        activeScene_.inspectionState.rotationPitch = pitch;
        activeScene_.inspectionState.rotationRoll = roll;
        activeScene_.inspectionState.zoomLevel = std::max(activeScene_.cineRig.minZoom,
                                                          std::min(activeScene_.cineRig.maxZoom, zoom));
        activeScene_.inspectionState.orbitRadius =
            activeScene_.cineRig.springArmLength * activeScene_.inspectionState.zoomLevel;
        activeScene_.inspectionState.timestamp = currentTimestamp();
        activeScene_.inspectionState.updateHash();

        if (inspectionChangedDelegate_) {
            inspectionChangedDelegate_(activeScene_.inspectionState);
        }
    }

    bool persistInspectionState() {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!activeScene_.active) return false;

        auto& chronos = ChronosEngine::Get();
        JsonValue statePayload(std::map<std::string, JsonValue>{
            {"rotationYaw", JsonValue(static_cast<double>(activeScene_.inspectionState.rotationYaw))},
            {"rotationPitch", JsonValue(static_cast<double>(activeScene_.inspectionState.rotationPitch))},
            {"rotationRoll", JsonValue(static_cast<double>(activeScene_.inspectionState.rotationRoll))},
            {"zoomLevel", JsonValue(static_cast<double>(activeScene_.inspectionState.zoomLevel))},
            {"orbitRadius", JsonValue(static_cast<double>(activeScene_.inspectionState.orbitRadius))},
            {"entityKey", JsonValue(activeScene_.inspectionState.entityKey)},
            {"stateHash", JsonValue(activeScene_.inspectionState.stateHash)}
        });

        std::string chronosKey = "inspection:" + activeScene_.inspectionState.entityKey;
        chronos.enqueue(chronosKey, statePayload, inspectionVersion_++, "showroom-system");
        stats_.totalStatesSaved++;

        return true;
    }

    FInspectionState recoverInspectionState(const std::string& entityKey) {
        std::lock_guard<std::mutex> lock(mutex_);

        auto& chronos = ChronosEngine::Get();
        const auto& entries = chronos.getEntries();

        std::string chronosKey = "inspection:" + entityKey;
        const ChronosQueueEntry* latest = nullptr;

        for (const auto& entry : entries) {
            if (entry.entityKey == chronosKey) {
                if (!latest || entry.timestamp > latest->timestamp) {
                    latest = &entry;
                }
            }
        }

        FInspectionState recovered;
        recovered.entityKey = entityKey;

        if (latest) {
            recovered = parseInspectionFromJson(latest->payloadJson, entityKey);
            stats_.totalStatesRecovered++;
        }

        return recovered;
    }

    FSovereignPedigree verifyWithServer(const FVisualPhenotype& phenotype,
                                         const std::string& serverManifestJson) {
        std::lock_guard<std::mutex> lock(mutex_);

        FSovereignPedigree pedigree = buildPedigree(phenotype);
        stats_.totalVerifications++;

        if (serverManifestJson.empty()) {
            pedigree.verificationStatus = VerificationStatus::SERVER_UNREACHABLE;
            pedigree.verificationStatusName = "SERVER_UNREACHABLE";
            pedigree.serverVerified = false;
            stats_.totalVerificationsFailed++;
        } else {
            AuthoritativeManifest manifest = AuthoritativeManifest::fromJson(serverManifestJson);

            bool hashMatch = serverManifestJson.find(phenotype.sourceHash) != std::string::npos;
            if (hashMatch) {
                pedigree.verificationStatus = VerificationStatus::VERIFIED;
                pedigree.verificationStatusName = "VERIFIED";
                pedigree.serverVerified = true;
                pedigree.authoritySource = "SovereignTransport";
                pedigree.lastVerifiedTimestamp = currentTimestamp();
                stats_.totalVerificationsSucceeded++;
            } else {
                pedigree.verificationStatus = VerificationStatus::MISMATCH;
                pedigree.verificationStatusName = "MISMATCH";
                pedigree.serverVerified = false;
                stats_.totalVerificationsFailed++;
            }
        }

        if (verificationDelegate_) {
            verificationDelegate_(pedigree, pedigree.serverVerified);
        }

        return pedigree;
    }

    const ShowroomScene& activeScene() const { return activeScene_; }
    const ShowroomStats& stats() const { return stats_; }

    void onShowroomReady(ShowroomReadyDelegate d) { showroomReadyDelegate_ = std::move(d); }
    void onInspectionChanged(InspectionStateChangedDelegate d) { inspectionChangedDelegate_ = std::move(d); }
    void onVerificationComplete(VerificationCompleteDelegate d) { verificationDelegate_ = std::move(d); }
    void onLightingProfileChanged(LightingProfileChangedDelegate d) { lightingChangedDelegate_ = std::move(d); }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        activeScene_ = ShowroomScene{};
        stats_ = ShowroomStats{};
        inspectionVersion_ = 0;
        showroomReadyDelegate_ = nullptr;
        inspectionChangedDelegate_ = nullptr;
        verificationDelegate_ = nullptr;
        lightingChangedDelegate_ = nullptr;
    }

    const std::vector<ChronosQueueEntry>& getChronosEntries() const {
        return ChronosEngine::Get().getEntries();
    }

private:
    ASovereignShowroom() = default;
    mutable std::mutex mutex_;
    ASovereignCineCamera camera_;
    ShowroomScene activeScene_;
    ShowroomStats stats_;
    int32_t inspectionVersion_ = 0;

    ShowroomReadyDelegate showroomReadyDelegate_;
    InspectionStateChangedDelegate inspectionChangedDelegate_;
    VerificationCompleteDelegate verificationDelegate_;
    LightingProfileChangedDelegate lightingChangedDelegate_;

    static int64_t currentTimestamp() {
        return static_cast<int64_t>(std::time(nullptr));
    }

    FSovereignPedigree buildPedigree(const FVisualPhenotype& phenotype) const {
        FSovereignPedigree pedigree;
        pedigree.rawHash = phenotype.sourceHash;
        pedigree.phenotypeClassName = phenotype.classificationName;
        pedigree.meshFamilyName = phenotype.morphology.meshFamilyName();
        pedigree.primaryColor = phenotype.primaryColor;
        pedigree.accentColor = phenotype.accentColor;

        auto genome = GeneticGenomeParser::hashToBytes(phenotype.sourceHash);

        struct LocusDef { std::string name; int offset; int length; };
        std::vector<LocusDef> defs = {
            {"primaryR",      0, 1}, {"primaryG",      1, 1}, {"primaryB",      2, 1},
            {"accentR",       3, 1}, {"accentG",       4, 1}, {"accentB",       5, 1},
            {"metallic",      6, 1}, {"roughness",     7, 1},
            {"emission",      8, 1}, {"opacity",       9, 1},
            {"meshIndex",    10, 2}, {"scaleX",       12, 2},
            {"scaleY",       14, 2}, {"scaleZ",       16, 2},
            {"uvTilingU",    18, 2}, {"uvTilingV",    20, 2}
        };

        for (const auto& def : defs) {
            auto locus = GeneticGenomeParser::extractLocus(genome, def.name, def.offset, def.length);
            FGeneLocus gl;
            gl.name = locus.name;
            gl.byteOffset = locus.byteOffset;
            gl.byteLength = locus.byteLength;
            gl.rawValue = locus.rawValue;
            gl.normalizedValue = locus.normalizedValue;

            std::ostringstream hex;
            hex << "0x" << std::hex << std::setfill('0')
                << std::setw(def.length * 2) << locus.rawValue;
            gl.hexValue = hex.str();

            pedigree.loci.push_back(gl);
        }

        return pedigree;
    }

    FInspectionState parseInspectionFromJson(const std::string& json, const std::string& entityKey) const {
        FInspectionState state;
        state.entityKey = entityKey;

        auto findFloat = [&](const std::string& key) -> float {
            std::string search = "\"" + key + "\":";
            size_t pos = json.find(search);
            if (pos == std::string::npos) {
                search = "\"" + key + "\": ";
                pos = json.find(search);
            }
            if (pos != std::string::npos) {
                size_t start = pos + search.size();
                while (start < json.size() && (json[start] == ' ' || json[start] == '\t')) start++;
                std::string num;
                while (start < json.size() && (json[start] >= '0' && json[start] <= '9' ||
                       json[start] == '.' || json[start] == '-' || json[start] == 'e' || json[start] == 'E')) {
                    num += json[start++];
                }
                if (!num.empty()) return std::stof(num);
            }
            return 0.0f;
        };

        auto findString = [&](const std::string& key) -> std::string {
            std::string search = "\"" + key + "\":\"";
            size_t pos = json.find(search);
            if (pos == std::string::npos) {
                search = "\"" + key + "\": \"";
                pos = json.find(search);
            }
            if (pos != std::string::npos) {
                size_t start = pos + search.size();
                size_t end = json.find('"', start);
                if (end != std::string::npos) return json.substr(start, end - start);
            }
            return "";
        };

        state.rotationYaw = findFloat("rotationYaw");
        state.rotationPitch = findFloat("rotationPitch");
        state.rotationRoll = findFloat("rotationRoll");
        state.zoomLevel = findFloat("zoomLevel");
        state.orbitRadius = findFloat("orbitRadius");
        state.stateHash = findString("stateHash");
        state.timestamp = currentTimestamp();

        return state;
    }
};

}
