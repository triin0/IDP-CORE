#include "../generated/SovereignShowroom.h"
#include <iostream>
#include <cassert>
#include <cmath>
#include <set>

static int passed = 0;
static int failed = 0;

#define ASSERT(cond, msg) do { \
    if (cond) { std::cout << "  PASS: " << msg << std::endl; passed++; } \
    else { std::cout << "  FAIL: " << msg << std::endl; failed++; } \
} while(0)

static Sovereign::FVisualPhenotype makeTestPhenotype(const std::string& seed) {
    auto& forge = Sovereign::BiologicalForge::Get();
    std::string hash = Sovereign::SovereignSHA256::hash(seed);
    return forge.forge(hash, seed);
}

static Sovereign::FVisualPhenotype makeScaledPhenotype(float sx, float sy, float sz,
                                                        Sovereign::PhenotypeClass cls = Sovereign::PhenotypeClass::ORGANIC) {
    Sovereign::FVisualPhenotype p;
    p.sourceHash = Sovereign::SovereignSHA256::hash("scaled-test");
    p.morphology.scaleX = sx;
    p.morphology.scaleY = sy;
    p.morphology.scaleZ = sz;
    p.classification = cls;
    p.classificationName = Sovereign::phenotypeClassToString(cls);
    p.material.emissionIntensity = 0.5f;
    p.primaryColor = {0.5f, 0.5f, 0.5f, 1.0f};
    p.accentColor = {0.3f, 0.3f, 0.3f, 1.0f};
    return p;
}

void testShowroomSingleton() {
    std::cout << "\n=== Sovereign Showroom Singleton ===" << std::endl;
    auto& s1 = Sovereign::ASovereignShowroom::Get();
    auto& s2 = Sovereign::ASovereignShowroom::Get();
    ASSERT(&s1 == &s2, "Singleton — same instance");
    s1.reset();
}

void testCineRigHeroPerspective() {
    std::cout << "\n=== Cine-Rig: Hero Perspective (Large Entities) ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();

    auto large = makeScaledPhenotype(2.5f, 2.5f, 2.5f);
    Sovereign::ASovereignCineCamera cam;
    auto rig = cam.computeRig(large);

    ASSERT(rig.perspective == Sovereign::CameraPerspective::HERO, "Hero — perspective = HERO");
    ASSERT(rig.perspectiveName == "Hero", "Hero — perspectiveName = Hero");
    ASSERT(rig.springArmLength >= 600.0f, "Hero — springArmLength >= 600 (wide pullback)");
    ASSERT(rig.focalLength <= 24.0f, "Hero — focalLength <= 24mm (wide angle)");
    ASSERT(rig.fieldOfView >= 80.0f, "Hero — FOV >= 80 (wide)");
    ASSERT(rig.aperture >= 4.0f, "Hero — aperture >= f/4 (deep DOF)");
    ASSERT(rig.dollySpeed <= 0.6f, "Hero — slow dolly for large subjects");
    ASSERT(rig.orbitSpeed <= 0.7f, "Hero — slow orbit for large subjects");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
}

void testCineRigMacroPerspective() {
    std::cout << "\n=== Cine-Rig: Macro Perspective (Small Entities) ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();

    auto small = makeScaledPhenotype(0.6f, 0.6f, 0.6f);
    Sovereign::ASovereignCineCamera cam;
    auto rig = cam.computeRig(small);

    ASSERT(rig.perspective == Sovereign::CameraPerspective::MACRO, "Macro — perspective = MACRO");
    ASSERT(rig.perspectiveName == "Macro", "Macro — perspectiveName = Macro");
    ASSERT(rig.springArmLength <= 150.0f, "Macro — springArmLength <= 150 (close-up)");
    ASSERT(rig.focalLength >= 80.0f, "Macro — focalLength >= 80mm (telephoto)");
    ASSERT(rig.fieldOfView <= 30.0f, "Macro — FOV <= 30 (narrow)");
    ASSERT(rig.aperture <= 2.0f, "Macro — aperture <= f/2 (shallow DOF)");
    ASSERT(rig.dollySpeed >= 1.5f, "Macro — fast dolly for small subjects");
    ASSERT(rig.orbitSpeed >= 1.2f, "Macro — faster orbit for small subjects");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
}

void testCineRigStandardPerspective() {
    std::cout << "\n=== Cine-Rig: Standard Perspective ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();

    auto mid = makeScaledPhenotype(1.5f, 1.5f, 1.5f);
    Sovereign::ASovereignCineCamera cam;
    auto rig = cam.computeRig(mid);

    ASSERT(rig.perspective == Sovereign::CameraPerspective::STANDARD, "Standard — perspective = STANDARD");
    ASSERT(rig.perspectiveName == "Standard", "Standard — perspectiveName = Standard");
    ASSERT(rig.springArmLength >= 200.0f && rig.springArmLength <= 500.0f, "Standard — arm in [200,500]");
    ASSERT(rig.focalLength >= 30.0f && rig.focalLength <= 50.0f, "Standard — focal in [30,50]mm");
    ASSERT(rig.fieldOfView >= 45.0f && rig.fieldOfView <= 70.0f, "Standard — FOV in [45,70]");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
}

void testCineRigCinematicPerspective() {
    std::cout << "\n=== Cine-Rig: Cinematic Perspective (Ethereal) ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();

    auto ethereal = makeScaledPhenotype(1.5f, 1.5f, 1.5f, Sovereign::PhenotypeClass::ETHEREAL);
    ethereal.material.emissionIntensity = 5.0f;
    Sovereign::ASovereignCineCamera cam;
    auto rig = cam.computeRig(ethereal);

    ASSERT(rig.perspective == Sovereign::CameraPerspective::CINEMATIC, "Cinematic — perspective = CINEMATIC");
    ASSERT(rig.perspectiveName == "Cinematic", "Cinematic — perspectiveName = Cinematic");
    ASSERT(rig.focalLength >= 45.0f, "Cinematic — focalLength >= 45mm");
    ASSERT(rig.fieldOfView <= 50.0f, "Cinematic — narrow FOV for drama");
    ASSERT(rig.aperture <= 2.5f, "Cinematic — wide aperture for bokeh");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
}

void testCineRigClamping() {
    std::cout << "\n=== Cine-Rig: Value Clamping ===" << std::endl;
    Sovereign::ASovereignCineCamera cam;

    auto extreme = makeScaledPhenotype(2.5f, 2.5f, 2.5f);
    extreme.morphology.scaleX = 100.0f;
    extreme.morphology.scaleY = 100.0f;
    extreme.morphology.scaleZ = 100.0f;
    auto rig = cam.computeRig(extreme);

    ASSERT(rig.springArmLength <= 1500.0f, "Clamp — springArmLength <= 1500");
    ASSERT(rig.springArmLength >= 50.0f, "Clamp — springArmLength >= 50");
    ASSERT(rig.focalLength >= 12.0f && rig.focalLength <= 200.0f, "Clamp — focalLength in [12,200]");
    ASSERT(rig.fieldOfView >= 15.0f && rig.fieldOfView <= 120.0f, "Clamp — FOV in [15,120]");
    ASSERT(rig.aperture >= 1.0f && rig.aperture <= 22.0f, "Clamp — aperture in [1,22]");
    ASSERT(rig.focusDistance >= 10.0f && rig.focusDistance <= 2000.0f, "Clamp — focusDistance in [10,2000]");

    std::string canonical = rig.canonicalize();
    ASSERT(canonical.find("\"springArmLength\"") != std::string::npos, "Clamp — canonicalize has springArmLength");
    ASSERT(canonical.find("\"perspective\"") != std::string::npos, "Clamp — canonicalize has perspective");
}

void testVolcanicLighting() {
    std::cout << "\n=== Lighting: Volcanic Profile ===" << std::endl;
    auto p = makeScaledPhenotype(1.5f, 1.5f, 1.5f, Sovereign::PhenotypeClass::VOLCANIC);
    auto profile = Sovereign::USovereignLightingRig::computeProfile(Sovereign::PhenotypeClass::VOLCANIC, p);

    ASSERT(profile.profileName == "Volcanic", "Volcanic — profile name");
    ASSERT(profile.globalIlluminationIntensity < 0.5f, "Volcanic — decreased GI");
    ASSERT(profile.bloomThreshold <= 0.15f, "Volcanic — low bloom threshold (0.1)");
    ASSERT(profile.bloomIntensity > 2.0f, "Volcanic — high bloom intensity");
    ASSERT(profile.lensFlareIntensity > 2.0f, "Volcanic — high lens flare");
    ASSERT(profile.ambientTint.R > 0.7f, "Volcanic — warm red ambient tint");
    ASSERT(profile.ambientTint.B < 0.3f, "Volcanic — minimal blue ambient");
    ASSERT(profile.contrast > 1.2f, "Volcanic — high contrast");
    ASSERT(profile.temperatureShift < 4000.0f, "Volcanic — warm color temperature");
    ASSERT(profile.allValuesClamped(), "Volcanic — all values clamped");
}

void testMetallicLighting() {
    std::cout << "\n=== Lighting: Metallic Profile ===" << std::endl;
    auto p = makeScaledPhenotype(1.5f, 1.5f, 1.5f, Sovereign::PhenotypeClass::METALLIC);
    auto profile = Sovereign::USovereignLightingRig::computeProfile(Sovereign::PhenotypeClass::METALLIC, p);

    ASSERT(profile.profileName == "Metallic", "Metallic — profile name");
    ASSERT(profile.reflectionSamples >= 32.0f, "Metallic — high ray-traced reflection samples");
    ASSERT(profile.enableHDRISkybox == true, "Metallic — HDRI skybox enabled");
    ASSERT(profile.enableHighContrastHDRI == true, "Metallic — high-contrast HDRI");
    ASSERT(profile.contrast > 1.0f, "Metallic — elevated contrast");
    ASSERT(profile.temperatureShift > 6500.0f, "Metallic — cool temperature");
    ASSERT(profile.allValuesClamped(), "Metallic — all values clamped");
}

void testCrystallineLighting() {
    std::cout << "\n=== Lighting: Crystalline Profile ===" << std::endl;
    auto p = makeScaledPhenotype(1.5f, 1.5f, 1.5f, Sovereign::PhenotypeClass::CRYSTALLINE);
    auto profile = Sovereign::USovereignLightingRig::computeProfile(Sovereign::PhenotypeClass::CRYSTALLINE, p);

    ASSERT(profile.profileName == "Crystalline", "Crystalline — profile name");
    ASSERT(profile.chromaticAberrationIntensity > 0.4f, "Crystalline — high chromatic aberration");
    ASSERT(profile.refractionDepth > 2.0f, "Crystalline — deep refraction");
    ASSERT(profile.reflectionSamples >= 16.0f, "Crystalline — elevated reflection samples");
    ASSERT(profile.enableHDRISkybox == true, "Crystalline — HDRI skybox for refractions");
    ASSERT(profile.bloomIntensity > 1.0f, "Crystalline — elevated bloom");
    ASSERT(profile.allValuesClamped(), "Crystalline — all values clamped");
}

void testAqueousLighting() {
    std::cout << "\n=== Lighting: Aqueous Profile ===" << std::endl;
    auto p = makeScaledPhenotype(1.5f, 1.5f, 1.5f, Sovereign::PhenotypeClass::AQUEOUS);
    auto profile = Sovereign::USovereignLightingRig::computeProfile(Sovereign::PhenotypeClass::AQUEOUS, p);

    ASSERT(profile.profileName == "Aqueous", "Aqueous — profile name");
    ASSERT(profile.ssrQuality > 0.9f, "Aqueous — high SSR quality");
    ASSERT(profile.causticsIntensity > 3.0f, "Aqueous — high caustics intensity");
    ASSERT(profile.ambientTint.B > 0.6f, "Aqueous — blue ambient tint");
    ASSERT(profile.fogDensity > 0.04f, "Aqueous — dense fog");
    ASSERT(profile.saturation < 1.0f, "Aqueous — slightly desaturated");
    ASSERT(profile.allValuesClamped(), "Aqueous — all values clamped");
}

void testEtherealLighting() {
    std::cout << "\n=== Lighting: Ethereal Profile ===" << std::endl;
    auto p = makeScaledPhenotype(1.5f, 1.5f, 1.5f, Sovereign::PhenotypeClass::ETHEREAL);
    auto profile = Sovereign::USovereignLightingRig::computeProfile(Sovereign::PhenotypeClass::ETHEREAL, p);

    ASSERT(profile.profileName == "Ethereal", "Ethereal — profile name");
    ASSERT(profile.bloomIntensity > 1.5f, "Ethereal — heavy bloom");
    ASSERT(profile.lensFlareIntensity > 1.0f, "Ethereal — lens flare active");
    ASSERT(profile.chromaticAberrationIntensity > 0.2f, "Ethereal — chromatic aberration");
    ASSERT(profile.ambientTint.B > 0.7f, "Ethereal — purple/blue ambient");
    ASSERT(profile.vignetteIntensity > 0.3f, "Ethereal — strong vignette");
    ASSERT(profile.allValuesClamped(), "Ethereal — all values clamped");
}

void testOrganicLighting() {
    std::cout << "\n=== Lighting: Organic Profile ===" << std::endl;
    auto p = makeScaledPhenotype(1.5f, 1.5f, 1.5f, Sovereign::PhenotypeClass::ORGANIC);
    auto profile = Sovereign::USovereignLightingRig::computeProfile(Sovereign::PhenotypeClass::ORGANIC, p);

    ASSERT(profile.profileName == "Organic", "Organic — profile name");
    ASSERT(profile.globalIlluminationIntensity > 0.5f, "Organic — natural GI");
    ASSERT(profile.saturation >= 0.9f && profile.saturation <= 1.1f, "Organic — neutral saturation");
    ASSERT(profile.contrast >= 0.9f && profile.contrast <= 1.1f, "Organic — neutral contrast");
    ASSERT(std::abs(profile.temperatureShift - 6500.0f) < 100.0f, "Organic — daylight temperature");
    ASSERT(profile.allValuesClamped(), "Organic — all values clamped");
}

void testLightingZeroDrift() {
    std::cout << "\n=== Lighting: Zero-Drift Verification ===" << std::endl;
    auto p = makeScaledPhenotype(1.5f, 1.5f, 1.5f, Sovereign::PhenotypeClass::VOLCANIC);
    auto profile1 = Sovereign::USovereignLightingRig::computeProfile(Sovereign::PhenotypeClass::VOLCANIC, p);
    auto profile2 = Sovereign::USovereignLightingRig::computeProfile(Sovereign::PhenotypeClass::VOLCANIC, p);

    ASSERT(Sovereign::USovereignLightingRig::verifyZeroDrift(profile1, profile2),
           "ZeroDrift — identical profiles on same input");

    ASSERT(profile1.allValuesClamped(), "ZeroDrift — profile 1 clamped");
    ASSERT(profile2.allValuesClamped(), "ZeroDrift — profile 2 clamped");

    std::string c1 = profile1.canonicalize();
    std::string c2 = profile2.canonicalize();
    ASSERT(c1 == c2, "ZeroDrift — canonical strings match");
    ASSERT(c1.find("\"bloomThreshold\"") != std::string::npos, "ZeroDrift — canonical has bloomThreshold");
    ASSERT(c1.find("\"profileName\"") != std::string::npos, "ZeroDrift — canonical has profileName");
}

void testLightingAllProfilesClamped() {
    std::cout << "\n=== Lighting: All Profiles Clamped ===" << std::endl;
    auto p = makeScaledPhenotype(1.5f, 1.5f, 1.5f);
    Sovereign::PhenotypeClass classes[] = {
        Sovereign::PhenotypeClass::ORGANIC,
        Sovereign::PhenotypeClass::CRYSTALLINE,
        Sovereign::PhenotypeClass::METALLIC,
        Sovereign::PhenotypeClass::ETHEREAL,
        Sovereign::PhenotypeClass::VOLCANIC,
        Sovereign::PhenotypeClass::AQUEOUS,
    };
    for (auto cls : classes) {
        auto profile = Sovereign::USovereignLightingRig::computeProfile(cls, p);
        ASSERT(profile.allValuesClamped(),
               "AllClamped — " + Sovereign::phenotypeClassToString(cls) + " values clamped");
    }
}

void testShowroomLoadEntity() {
    std::cout << "\n=== Showroom: Load Entity ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    auto phenotype = makeTestPhenotype("lexus-rx300-midnight");

    int readyFired = 0;
    showroom.onShowroomReady([&](const Sovereign::FVisualPhenotype& p,
                                  const Sovereign::FCineRigConfig& c,
                                  const Sovereign::FLightingProfile& l) {
        readyFired++;
    });

    auto scene = showroom.loadEntity("lexus-rx300", phenotype);

    ASSERT(scene.active, "LoadEntity — scene is active");
    ASSERT(scene.phenotype.sourceHash == phenotype.sourceHash, "LoadEntity — phenotype preserved");
    ASSERT(!scene.cineRig.perspectiveName.empty(), "LoadEntity — cine rig computed");
    ASSERT(!scene.lighting.profileName.empty(), "LoadEntity — lighting profile computed");
    ASSERT(scene.inspectionState.entityKey == "lexus-rx300", "LoadEntity — entity key set");
    ASSERT(!scene.inspectionState.stateHash.empty(), "LoadEntity — initial state hash computed");
    ASSERT(scene.inspectionState.zoomLevel == 1.0f, "LoadEntity — default zoom = 1.0");
    ASSERT(readyFired == 1, "LoadEntity — showroomReady delegate fired");
    ASSERT(showroom.stats().totalInspections == 1, "LoadEntity — inspection counted");
    ASSERT(showroom.stats().totalCameraAdjustments == 1, "LoadEntity — camera adjustment counted");
    ASSERT(showroom.stats().totalLightingProfilesApplied == 1, "LoadEntity — lighting profile counted");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testShowroomPedigree() {
    std::cout << "\n=== Showroom: Sovereign Pedigree ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    auto phenotype = makeTestPhenotype("pedigree-test-entity");
    auto scene = showroom.loadEntity("pedigree-entity", phenotype);

    ASSERT(scene.pedigree.rawHash == phenotype.sourceHash, "Pedigree — raw hash matches");
    ASSERT(scene.pedigree.rawHash.size() == 64, "Pedigree — 64 hex chars");
    ASSERT(scene.pedigree.loci.size() == 16, "Pedigree — 16 gene loci");
    ASSERT(scene.pedigree.phenotypeClassName == phenotype.classificationName, "Pedigree — class name matches");
    ASSERT(!scene.pedigree.meshFamilyName.empty(), "Pedigree — mesh family resolved");

    ASSERT(scene.pedigree.loci[0].name == "primaryR", "Pedigree — locus 0 = primaryR");
    ASSERT(scene.pedigree.loci[1].name == "primaryG", "Pedigree — locus 1 = primaryG");
    ASSERT(scene.pedigree.loci[2].name == "primaryB", "Pedigree — locus 2 = primaryB");
    ASSERT(scene.pedigree.loci[6].name == "metallic", "Pedigree — locus 6 = metallic");
    ASSERT(scene.pedigree.loci[7].name == "roughness", "Pedigree — locus 7 = roughness");
    ASSERT(scene.pedigree.loci[10].name == "meshIndex", "Pedigree — locus 10 = meshIndex");
    ASSERT(scene.pedigree.loci[15].name == "uvTilingV", "Pedigree — locus 15 = uvTilingV");

    for (const auto& locus : scene.pedigree.loci) {
        ASSERT(locus.normalizedValue >= 0.0f && locus.normalizedValue <= 1.0f,
               "Pedigree — " + locus.name + " normalized in [0,1]");
    }

    ASSERT(scene.pedigree.loci[0].hexValue.substr(0, 2) == "0x", "Pedigree — hex value starts with 0x");
    ASSERT(!scene.pedigree.isVerifiedBadgeGreen(), "Pedigree — badge NOT green (unverified)");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testInspectionRotation() {
    std::cout << "\n=== Showroom: Inspection Rotation ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    auto phenotype = makeTestPhenotype("rotation-test");
    showroom.loadEntity("rotate-entity", phenotype);

    int stateChanges = 0;
    showroom.onInspectionChanged([&](const Sovereign::FInspectionState& state) {
        stateChanges++;
    });

    showroom.updateInspectionRotation(45.0f, -15.0f, 0.0f, 1.2f);

    auto& scene = showroom.activeScene();
    ASSERT(scene.inspectionState.rotationYaw == 45.0f, "Rotation — yaw = 45");
    ASSERT(scene.inspectionState.rotationPitch == -15.0f, "Rotation — pitch = -15");
    ASSERT(scene.inspectionState.rotationRoll == 0.0f, "Rotation — roll = 0");
    ASSERT(scene.inspectionState.zoomLevel == 1.2f, "Rotation — zoom = 1.2");
    ASSERT(!scene.inspectionState.stateHash.empty(), "Rotation — state hash updated");
    ASSERT(scene.inspectionState.verifyHash(), "Rotation — hash verifies");
    ASSERT(stateChanges == 1, "Rotation — delegate fired");

    std::string hash1 = scene.inspectionState.stateHash;
    showroom.updateInspectionRotation(90.0f, 0.0f, 0.0f, 1.5f);
    std::string hash2 = showroom.activeScene().inspectionState.stateHash;
    ASSERT(hash1 != hash2, "Rotation — different rotation = different hash");
    ASSERT(stateChanges == 2, "Rotation — delegate fired again");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testInspectionZoomClamping() {
    std::cout << "\n=== Showroom: Zoom Clamping ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    auto phenotype = makeTestPhenotype("zoom-clamp-test");
    showroom.loadEntity("zoom-entity", phenotype);

    showroom.updateInspectionRotation(0.0f, 0.0f, 0.0f, 10.0f);
    ASSERT(showroom.activeScene().inspectionState.zoomLevel <= 3.0f, "ZoomClamp — max zoom clamped to 3.0");

    showroom.updateInspectionRotation(0.0f, 0.0f, 0.0f, 0.01f);
    ASSERT(showroom.activeScene().inspectionState.zoomLevel >= 0.3f, "ZoomClamp — min zoom clamped to 0.3");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testChronosPersistence() {
    std::cout << "\n=== Showroom: Chronos State Persistence ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/showroom_chronos_test.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto phenotype = makeTestPhenotype("persistence-test");
    showroom.loadEntity("persist-entity", phenotype);
    showroom.updateInspectionRotation(135.0f, -30.0f, 5.0f, 1.7f);

    bool saved = showroom.persistInspectionState();
    ASSERT(saved, "Persist — state saved to Chronos");
    ASSERT(showroom.stats().totalStatesSaved == 1, "Persist — totalStatesSaved = 1");

    ASSERT(Sovereign::ChronosEngine::Get().pendingCount() > 0, "Persist — Chronos has pending entry");

    showroom.updateInspectionRotation(180.0f, 10.0f, 0.0f, 2.0f);
    showroom.persistInspectionState();
    ASSERT(showroom.stats().totalStatesSaved == 2, "Persist — totalStatesSaved = 2");

    auto recovered = showroom.recoverInspectionState("persist-entity");
    ASSERT(recovered.entityKey == "persist-entity", "Recover — entity key matches");
    ASSERT(showroom.stats().totalStatesRecovered == 1, "Recover — totalStatesRecovered = 1");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testChronosCrashRecovery() {
    std::cout << "\n=== Showroom: Crash → Recovery → Restore ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/showroom_crash_test.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    auto phenotype = makeTestPhenotype("crash-test-entity");
    showroom.loadEntity("crash-entity", phenotype);
    showroom.updateInspectionRotation(270.0f, -45.0f, 10.0f, 0.8f);
    showroom.persistInspectionState();

    std::string preHash = showroom.activeScene().inspectionState.stateHash;

    Sovereign::ChronosEngine::Get().reset();
    Sovereign::ChronosEngine::Get().configure(cfg);
    showroom.reset();

    Sovereign::ChronosEngine::Get().recoverFromCrash();
    ASSERT(Sovereign::ChronosEngine::Get().pendingCount() > 0, "CrashRecover — entries recovered from disk");

    auto recovered = showroom.recoverInspectionState("crash-entity");
    ASSERT(recovered.entityKey == "crash-entity", "CrashRecover — entity key restored");
    ASSERT(std::abs(recovered.rotationYaw - 270.0f) < 0.1f, "CrashRecover — yaw restored (270)");
    ASSERT(std::abs(recovered.rotationPitch - (-45.0f)) < 0.1f, "CrashRecover — pitch restored (-45)");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testVerificationWithServer() {
    std::cout << "\n=== Showroom: Server Verification ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();

    auto phenotype = makeTestPhenotype("verify-test");

    int verifyFired = 0;
    bool lastSuccess = false;
    showroom.onVerificationComplete([&](const Sovereign::FSovereignPedigree& p, bool success) {
        verifyFired++;
        lastSuccess = success;
    });

    std::string fakeManifest = "{\"sourceHash\":\"" + phenotype.sourceHash +
                                "\",\"serverVersion\":5,\"bidCount\":12}";
    auto pedigree = showroom.verifyWithServer(phenotype, fakeManifest);

    ASSERT(pedigree.serverVerified == true, "Verify — server verified = true");
    ASSERT(pedigree.verificationStatus == Sovereign::VerificationStatus::VERIFIED, "Verify — status = VERIFIED");
    ASSERT(pedigree.isVerifiedBadgeGreen(), "Verify — badge is GREEN");
    ASSERT(pedigree.authoritySource == "SovereignTransport", "Verify — authority = SovereignTransport");
    ASSERT(verifyFired == 1, "Verify — delegate fired");
    ASSERT(lastSuccess == true, "Verify — delegate received success");
    ASSERT(showroom.stats().totalVerificationsSucceeded == 1, "Verify — success counted");

    auto mismatch = showroom.verifyWithServer(phenotype, "{\"sourceHash\":\"wrong_hash\"}");
    ASSERT(mismatch.serverVerified == false, "Mismatch — not verified");
    ASSERT(mismatch.verificationStatus == Sovereign::VerificationStatus::MISMATCH, "Mismatch — status = MISMATCH");
    ASSERT(!mismatch.isVerifiedBadgeGreen(), "Mismatch — badge NOT green");
    ASSERT(showroom.stats().totalVerificationsFailed == 1, "Mismatch — failure counted");

    auto unreachable = showroom.verifyWithServer(phenotype, "");
    ASSERT(unreachable.verificationStatus == Sovereign::VerificationStatus::SERVER_UNREACHABLE,
           "Unreachable — status = SERVER_UNREACHABLE");
    ASSERT(!unreachable.isVerifiedBadgeGreen(), "Unreachable — badge NOT green");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
}

void testInspectionStateHashing() {
    std::cout << "\n=== Inspection State: Hash Integrity ===" << std::endl;
    Sovereign::FInspectionState state;
    state.entityKey = "hash-test-entity";
    state.rotationYaw = 90.0f;
    state.rotationPitch = -30.0f;
    state.rotationRoll = 0.0f;
    state.zoomLevel = 1.5f;
    state.orbitRadius = 400.0f;

    state.updateHash();
    ASSERT(!state.stateHash.empty(), "StateHash — computed");
    ASSERT(state.stateHash.size() == 64, "StateHash — 64 hex chars");
    ASSERT(state.verifyHash(), "StateHash — verifies");

    std::string h1 = state.stateHash;
    state.rotationYaw = 91.0f;
    state.updateHash();
    ASSERT(state.stateHash != h1, "StateHash — changes with rotation");
    ASSERT(state.verifyHash(), "StateHash — still verifies after update");

    std::string canonical = state.canonicalize();
    ASSERT(canonical.find("\"rotationYaw\"") != std::string::npos, "StateHash — canonical has rotationYaw");
    ASSERT(canonical.find("\"entityKey\"") != std::string::npos, "StateHash — canonical has entityKey");
    ASSERT(canonical.find("\"zoomLevel\"") != std::string::npos, "StateHash — canonical has zoomLevel");
}

void testShowroomStats() {
    std::cout << "\n=== Showroom: Statistics ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    ASSERT(showroom.stats().totalInspections == 0, "Stats — initial inspections = 0");
    ASSERT(showroom.stats().totalStatesSaved == 0, "Stats — initial states saved = 0");

    auto p1 = makeTestPhenotype("stats-1");
    auto p2 = makeTestPhenotype("stats-2");

    showroom.loadEntity("e1", p1);
    showroom.loadEntity("e2", p2);

    ASSERT(showroom.stats().totalInspections == 2, "Stats — 2 inspections");
    ASSERT(showroom.stats().totalCameraAdjustments == 2, "Stats — 2 camera adjustments");
    ASSERT(showroom.stats().totalLightingProfilesApplied == 2, "Stats — 2 lighting profiles");
    ASSERT(showroom.stats().lastInspectionTimestamp > 0, "Stats — timestamp recorded");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testPedigreeCanonicalForm() {
    std::cout << "\n=== Pedigree: Canonical Form ===" << std::endl;
    Sovereign::BiologicalForge::Get().reset();

    auto phenotype = makeTestPhenotype("canonical-pedigree-test");

    Sovereign::FSovereignPedigree ped;
    ped.rawHash = phenotype.sourceHash;
    ped.phenotypeClassName = phenotype.classificationName;
    ped.meshFamilyName = phenotype.morphology.meshFamilyName();
    ped.serverVerified = true;
    ped.verificationStatus = Sovereign::VerificationStatus::VERIFIED;
    ped.verificationStatusName = "VERIFIED";
    ped.authoritySource = "SovereignTransport";

    std::string canonical = ped.canonicalize();
    ASSERT(canonical.find("\"rawHash\"") != std::string::npos, "PedCanonical — has rawHash");
    ASSERT(canonical.find("\"phenotypeClass\"") != std::string::npos, "PedCanonical — has phenotypeClass");
    ASSERT(canonical.find("\"meshFamily\"") != std::string::npos, "PedCanonical — has meshFamily");
    ASSERT(canonical.find("\"verified\":true") != std::string::npos, "PedCanonical — verified = true");
    ASSERT(canonical.find("\"verificationStatus\":\"VERIFIED\"") != std::string::npos, "PedCanonical — status VERIFIED");

    Sovereign::BiologicalForge::Get().reset();
}

void testVerificationStatusEnum() {
    std::cout << "\n=== Verification Status Enum ===" << std::endl;
    ASSERT(Sovereign::verificationStatusToString(Sovereign::VerificationStatus::UNVERIFIED) == "UNVERIFIED",
           "VerifEnum — UNVERIFIED");
    ASSERT(Sovereign::verificationStatusToString(Sovereign::VerificationStatus::VERIFIED) == "VERIFIED",
           "VerifEnum — VERIFIED");
    ASSERT(Sovereign::verificationStatusToString(Sovereign::VerificationStatus::MISMATCH) == "MISMATCH",
           "VerifEnum — MISMATCH");
    ASSERT(Sovereign::verificationStatusToString(Sovereign::VerificationStatus::SERVER_UNREACHABLE) == "SERVER_UNREACHABLE",
           "VerifEnum — SERVER_UNREACHABLE");
    ASSERT(Sovereign::verificationStatusToString(Sovereign::VerificationStatus::PENDING) == "PENDING",
           "VerifEnum — PENDING");
}

void testResetClearsAll() {
    std::cout << "\n=== Reset Clears Everything ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    auto phenotype = makeTestPhenotype("reset-test");
    showroom.loadEntity("reset-entity", phenotype);
    showroom.reset();

    ASSERT(!showroom.activeScene().active, "Reset — scene not active");
    ASSERT(showroom.stats().totalInspections == 0, "Reset — inspections cleared");
    ASSERT(showroom.stats().totalCameraAdjustments == 0, "Reset — camera cleared");
    ASSERT(showroom.stats().totalStatesSaved == 0, "Reset — states saved cleared");

    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

void testCrossModuleIntegration() {
    std::cout << "\n=== Cross-Module Integration ===" << std::endl;
    auto& showroom = Sovereign::ASovereignShowroom::Get();
    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();

    Sovereign::ChronosConfig cfg;
    cfg.persistencePath = "/tmp/showroom_crossmod.bin";
    cfg.autoSaveOnEnqueue = true;
    Sovereign::ChronosEngine::Get().configure(cfg);

    Sovereign::JsonValue bidPayload(std::map<std::string, Sovereign::JsonValue>{
        {"make", Sovereign::JsonValue("Lexus")},
        {"model", Sovereign::JsonValue("RX300")},
        {"price", Sovereign::JsonValue(52000.0)}
    });

    auto phenotype = Sovereign::BiologicalForge::Get().forgeFromPayload(bidPayload, "lexus-rx300");

    auto scene = showroom.loadEntity("lexus-rx300", phenotype);

    ASSERT(scene.active, "CrossMod — scene active");
    ASSERT(scene.phenotype.verifyIntegrity(), "CrossMod — Forge integrity holds in Showroom");
    ASSERT(scene.lighting.allValuesClamped(), "CrossMod — lighting clamped");
    ASSERT(!scene.cineRig.perspectiveName.empty(), "CrossMod — camera perspective set");
    ASSERT(scene.pedigree.loci.size() == 16, "CrossMod — pedigree has 16 loci");

    showroom.updateInspectionRotation(45.0f, -20.0f, 0.0f, 1.3f);
    showroom.persistInspectionState();

    ASSERT(Sovereign::ChronosEngine::Get().pendingCount() > 0, "CrossMod — Chronos has pending entries");

    std::string manifest = "{\"sourceHash\":\"" + phenotype.sourceHash + "\",\"serverVersion\":1}";
    auto pedigree = showroom.verifyWithServer(phenotype, manifest);
    ASSERT(pedigree.isVerifiedBadgeGreen(), "CrossMod — verification badge GREEN");

    showroom.reset();
    Sovereign::BiologicalForge::Get().reset();
    Sovereign::ChronosEngine::Get().reset();
}

int main() {
    std::cout << "=== The Sovereign Showroom: Cinematic Layer ===" << std::endl;

    testShowroomSingleton();
    testCineRigHeroPerspective();
    testCineRigMacroPerspective();
    testCineRigStandardPerspective();
    testCineRigCinematicPerspective();
    testCineRigClamping();
    testVolcanicLighting();
    testMetallicLighting();
    testCrystallineLighting();
    testAqueousLighting();
    testEtherealLighting();
    testOrganicLighting();
    testLightingZeroDrift();
    testLightingAllProfilesClamped();
    testShowroomLoadEntity();
    testShowroomPedigree();
    testInspectionRotation();
    testInspectionZoomClamping();
    testChronosPersistence();
    testChronosCrashRecovery();
    testVerificationWithServer();
    testInspectionStateHashing();
    testShowroomStats();
    testPedigreeCanonicalForm();
    testVerificationStatusEnum();
    testResetClearsAll();
    testCrossModuleIntegration();

    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "SHOWROOM RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;

    return failed > 0 ? 1 : 0;
}
