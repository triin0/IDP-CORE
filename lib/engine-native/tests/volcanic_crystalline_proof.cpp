#include "../generated/SovereignSpawner.h"
#include <iostream>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <ctime>

using namespace Sovereign;

static std::string bytesToHex(const std::vector<uint8_t>& bytes) {
    std::ostringstream oss;
    for (uint8_t b : bytes) {
        oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(b);
    }
    return oss.str();
}

static std::string locusHex(const std::vector<uint8_t>& genome, int offset, int length) {
    std::ostringstream oss;
    for (int i = 0; i < length && (offset + i) < static_cast<int>(genome.size()); i++) {
        oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(genome[offset + i]);
    }
    return oss.str();
}

static float locusNormalized(const std::vector<uint8_t>& genome, int offset, int length) {
    uint32_t val = 0;
    for (int i = 0; i < length && (offset + i) < static_cast<int>(genome.size()); i++) {
        val = (val << 8) | genome[offset + i];
    }
    uint32_t maxVal = (1u << (length * 8)) - 1;
    return static_cast<float>(val) / static_cast<float>(maxVal);
}

static std::string inhModeStr(InheritanceMode m) {
    switch (m) {
        case InheritanceMode::PARENT_A: return "PARENT_A";
        case InheritanceMode::PARENT_B: return "PARENT_B";
        case InheritanceMode::BLEND: return "BLEND";
        case InheritanceMode::MUTATION: return "MUTATION";
    }
    return "UNKNOWN";
}

static std::string domStr(GeneDominance d) {
    switch (d) {
        case GeneDominance::DOMINANT: return "DOMINANT";
        case GeneDominance::RECESSIVE: return "RECESSIVE";
        case GeneDominance::CODOMINANT: return "CODOMINANT";
    }
    return "UNKNOWN";
}

static std::string escapeJson(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else out += c;
    }
    return out;
}

void generateGeneticsAuditJson(const std::string& outputPath,
                                 const std::string& parentAHash,
                                 const std::string& parentBHash,
                                 const FSpawnLineage& lineage,
                                 const FVisualPhenotype& parentAPhenotype,
                                 const FVisualPhenotype& parentBPhenotype,
                                 const FVisualPhenotype& childPhenotype) {

    auto genomeA = GeneticGenomeParser::hashToBytes(parentAHash);
    auto genomeB = GeneticGenomeParser::hashToBytes(parentBHash);

    std::vector<uint8_t> genomeC(32, 0);
    const auto& table2 = GeneticDominanceTable::table();
    for (int i = 0; i < 16; i++) {
        const auto& entry = table2[i];
        uint32_t val = lineage.inheritanceMap[i].childValue;
        if (entry.byteLength == 1) {
            genomeC[entry.byteOffset] = static_cast<uint8_t>(val & 0xFF);
        } else {
            genomeC[entry.byteOffset] = static_cast<uint8_t>((val >> 8) & 0xFF);
            genomeC[entry.byteOffset + 1] = static_cast<uint8_t>(val & 0xFF);
        }
    }

    std::ofstream f(outputPath);

    f << "{\n";
    f << "  \"title\": \"Sovereign Spawner Genetics Audit: Volcanic x Crystalline\",\n";
    f << "  \"module\": \"Module 9: The Sovereign Spawner\",\n";
    f << "  \"crossType\": \"VOLCANIC x CRYSTALLINE\",\n";
    f << "  \"sovereignSeed\": \"" << escapeJson(lineage.sovereignSeed) << "\",\n";
    f << "  \"parentA\": {\n";
    f << "    \"hash\": \"" << parentAHash << "\",\n";
    f << "    \"classification\": \"" << parentAPhenotype.classificationName << "\",\n";
    f << "    \"genome\": \"" << bytesToHex(genomeA) << "\"\n";
    f << "  },\n";
    f << "  \"parentB\": {\n";
    f << "    \"hash\": \"" << parentBHash << "\",\n";
    f << "    \"classification\": \"" << parentBPhenotype.classificationName << "\",\n";
    f << "    \"genome\": \"" << bytesToHex(genomeB) << "\"\n";
    f << "  },\n";
    f << "  \"child\": {\n";
    f << "    \"hash\": \"" << lineage.childHash << "\",\n";
    f << "    \"classification\": \"" << childPhenotype.classificationName << "\",\n";
    f << "    \"generation\": " << lineage.generation << ",\n";
    f << "    \"totalMutations\": " << lineage.totalMutations << ",\n";
    f << "    \"lineageHash\": \"" << lineage.lineageHash << "\",\n";
    f << "    \"entityKey\": \"" << lineage.childEntityKey << "\",\n";
    f << "    \"recombinedGenome\": \"" << bytesToHex(genomeC) << "\",\n";
    f << "    \"note\": \"recombinedGenome is the actual genome bytes from crossover; hash = SHA256(hex(recombinedGenome) + ':' + seed)\"\n";
    f << "  },\n";

    f << "  \"locusInheritance\": [\n";
    const auto& table = GeneticDominanceTable::table();
    for (int i = 0; i < 16; i++) {
        const auto& entry = table[i];
        const auto& inh = lineage.inheritanceMap[i];
        f << "    {\n";
        f << "      \"index\": " << i << ",\n";
        f << "      \"locusName\": \"" << entry.locusName << "\",\n";
        f << "      \"byteOffset\": " << entry.byteOffset << ",\n";
        f << "      \"byteLength\": " << entry.byteLength << ",\n";
        f << "      \"dominanceType\": \"" << domStr(entry.dominance) << "\",\n";
        f << "      \"mutationSensitivity\": " << std::fixed << std::setprecision(4) << entry.mutationSensitivity << ",\n";
        f << "      \"parentA\": {\n";
        f << "        \"hexValue\": \"" << locusHex(genomeA, entry.byteOffset, entry.byteLength) << "\",\n";
        f << "        \"rawValue\": " << inh.parentAValue << ",\n";
        f << "        \"normalized\": " << std::fixed << std::setprecision(6) << locusNormalized(genomeA, entry.byteOffset, entry.byteLength) << "\n";
        f << "      },\n";
        f << "      \"parentB\": {\n";
        f << "        \"hexValue\": \"" << locusHex(genomeB, entry.byteOffset, entry.byteLength) << "\",\n";
        f << "        \"rawValue\": " << inh.parentBValue << ",\n";
        f << "        \"normalized\": " << std::fixed << std::setprecision(6) << locusNormalized(genomeB, entry.byteOffset, entry.byteLength) << "\n";
        f << "      },\n";
        f << "      \"child\": {\n";
        f << "        \"hexValue\": \"" << locusHex(genomeC, entry.byteOffset, entry.byteLength) << "\",\n";
        f << "        \"rawValue\": " << inh.childValue << ",\n";
        f << "        \"normalized\": " << std::fixed << std::setprecision(6) << locusNormalized(genomeC, entry.byteOffset, entry.byteLength) << "\n";
        f << "      },\n";
        f << "      \"inheritanceMode\": \"" << inhModeStr(inh.mode) << "\",\n";
        f << "      \"mutated\": " << (inh.mutated ? "true" : "false") << ",\n";
        f << "      \"mutationRoll\": " << std::fixed << std::setprecision(8) << inh.mutationRoll << ",\n";
        f << "      \"mutationThreshold\": " << std::fixed << std::setprecision(8) << inh.mutationThreshold << "\n";
        f << "    }" << (i < 15 ? "," : "") << "\n";
    }
    f << "  ],\n";

    f << "  \"phenotypeComparison\": {\n";
    f << "    \"parentA\": {\n";
    f << "      \"primaryColor\": {\"R\": " << parentAPhenotype.primaryColor.R << ", \"G\": " << parentAPhenotype.primaryColor.G << ", \"B\": " << parentAPhenotype.primaryColor.B << "},\n";
    f << "      \"accentColor\": {\"R\": " << parentAPhenotype.accentColor.R << ", \"G\": " << parentAPhenotype.accentColor.G << ", \"B\": " << parentAPhenotype.accentColor.B << "},\n";
    f << "      \"metallic\": " << parentAPhenotype.material.metallic << ",\n";
    f << "      \"roughness\": " << parentAPhenotype.material.roughness << ",\n";
    f << "      \"emission\": " << parentAPhenotype.material.emissionIntensity << ",\n";
    f << "      \"opacity\": " << parentAPhenotype.material.opacity << ",\n";
    f << "      \"meshIndex\": " << parentAPhenotype.morphology.baseMeshIndex << ",\n";
    f << "      \"classification\": \"" << parentAPhenotype.classificationName << "\"\n";
    f << "    },\n";
    f << "    \"parentB\": {\n";
    f << "      \"primaryColor\": {\"R\": " << parentBPhenotype.primaryColor.R << ", \"G\": " << parentBPhenotype.primaryColor.G << ", \"B\": " << parentBPhenotype.primaryColor.B << "},\n";
    f << "      \"accentColor\": {\"R\": " << parentBPhenotype.accentColor.R << ", \"G\": " << parentBPhenotype.accentColor.G << ", \"B\": " << parentBPhenotype.accentColor.B << "},\n";
    f << "      \"metallic\": " << parentBPhenotype.material.metallic << ",\n";
    f << "      \"roughness\": " << parentBPhenotype.material.roughness << ",\n";
    f << "      \"emission\": " << parentBPhenotype.material.emissionIntensity << ",\n";
    f << "      \"opacity\": " << parentBPhenotype.material.opacity << ",\n";
    f << "      \"meshIndex\": " << parentBPhenotype.morphology.baseMeshIndex << ",\n";
    f << "      \"classification\": \"" << parentBPhenotype.classificationName << "\"\n";
    f << "    },\n";
    f << "    \"child\": {\n";
    f << "      \"primaryColor\": {\"R\": " << childPhenotype.primaryColor.R << ", \"G\": " << childPhenotype.primaryColor.G << ", \"B\": " << childPhenotype.primaryColor.B << "},\n";
    f << "      \"accentColor\": {\"R\": " << childPhenotype.accentColor.R << ", \"G\": " << childPhenotype.accentColor.G << ", \"B\": " << childPhenotype.accentColor.B << "},\n";
    f << "      \"metallic\": " << childPhenotype.material.metallic << ",\n";
    f << "      \"roughness\": " << childPhenotype.material.roughness << ",\n";
    f << "      \"emission\": " << childPhenotype.material.emissionIntensity << ",\n";
    f << "      \"opacity\": " << childPhenotype.material.opacity << ",\n";
    f << "      \"meshIndex\": " << childPhenotype.morphology.baseMeshIndex << ",\n";
    f << "      \"classification\": \"" << childPhenotype.classificationName << "\"\n";
    f << "    }\n";
    f << "  },\n";

    f << "  \"integrityVerification\": {\n";
    f << "    \"lineageIntegrity\": " << (lineage.verifyIntegrity() ? "true" : "false") << ",\n";
    f << "    \"childPhenotypeIntegrity\": " << (childPhenotype.verifyIntegrity() ? "true" : "false") << ",\n";
    f << "    \"parentAPhenotypeIntegrity\": " << (parentAPhenotype.verifyIntegrity() ? "true" : "false") << ",\n";
    f << "    \"parentBPhenotypeIntegrity\": " << (parentBPhenotype.verifyIntegrity() ? "true" : "false") << ",\n";
    f << "    \"lineageHashFormula\": \"SHA256(canonicalize({childHash, generation, parentAHash, parentBHash, sovereignSeed, totalMutations}))\",\n";
    f << "    \"childHashFormula\": \"SHA256(bytesToHex(recombinedGenome) + ':' + effectiveSeed)\"\n";
    f << "  }\n";
    f << "}\n";

    f.close();
}

void generateShowroomCameraConfigs(std::ofstream& out,
                                     const FVisualPhenotype& childPhenotype) {
    auto& showroom = ASovereignShowroom::Get();
    auto scene = showroom.loadEntity("offspring", childPhenotype);

    ASovereignCineCamera cineCamera;
    auto rig = cineCamera.computeRig(childPhenotype);

    out << "## 1. Showroom Visualization Data (Module 7)\n\n";
    out << "> **Note:** The Sovereign Showroom is a C++/UE5 USTRUCT pipeline.\n";
    out << "> Actual 8K renders require an Unreal Engine 5 runtime with a GPU.\n";
    out << "> Below is the complete camera rig, lighting profile, and pedigree\n";
    out << "> data that UE5 would consume to produce each frame.\n\n";

    out << "### Auto-Selected Camera Perspective: " << rig.perspectiveName << "\n\n";
    out << "| Parameter | Value |\n";
    out << "|-----------|-------|\n";
    out << "| Perspective | " << rig.perspectiveName << " |\n";
    out << "| Spring Arm Length | " << std::fixed << std::setprecision(2) << rig.springArmLength << " |\n";
    out << "| Focal Length | " << rig.focalLength << "mm |\n";
    out << "| Aperture (f-stop) | f/" << rig.aperture << " |\n";
    out << "| Field of View | " << rig.fieldOfView << " deg |\n";
    out << "| Focus Distance | " << rig.focusDistance << " |\n";
    out << "| Dolly Speed | " << rig.dollySpeed << " |\n";
    out << "| Orbit Speed | " << rig.orbitSpeed << " |\n";
    out << "| Min Zoom | " << rig.minZoom << " |\n";
    out << "| Max Zoom | " << rig.maxZoom << " |\n\n";

    out << "### Four Required Camera Angles (UE5 Rig Parameters)\n\n";

    out << "#### HERO (18mm Wide-Angle)\n";
    out << "| Parameter | Value |\n";
    out << "|-----------|-------|\n";
    out << "| Focal Length | 18mm |\n";
    out << "| Field of View | 90 deg |\n";
    out << "| Aperture | f/5.6 |\n";
    out << "| Spring Arm | 600+ (scaled to entity) |\n";
    out << "| Rotation | Yaw=0, Pitch=0 (front facing) |\n";
    out << "| Resolution | 7680x4320 (8K UHD) |\n\n";

    out << "#### MACRO (100mm Telephoto — Emission Veins)\n";
    out << "| Parameter | Value |\n";
    out << "|-----------|-------|\n";
    out << "| Focal Length | 100mm |\n";
    out << "| Field of View | 25 deg |\n";
    out << "| Aperture | f/1.4 (shallow DOF) |\n";
    out << "| Spring Arm | 80-140 (close-up) |\n";
    out << "| Focus Target | Emission vein surface (byte 8 locus) |\n";
    out << "| Child Emission Intensity | " << childPhenotype.material.emissionIntensity << " |\n";
    out << "| Resolution | 7680x4320 (8K UHD) |\n\n";

    out << "#### TOP-DOWN\n";
    out << "| Parameter | Value |\n";
    out << "|-----------|-------|\n";
    out << "| Rotation | Yaw=0, Pitch=-90 (directly above) |\n";
    out << "| Focal Length | " << rig.focalLength << "mm (auto) |\n";
    out << "| Spring Arm | " << rig.springArmLength * 1.2f << " (elevated) |\n";
    out << "| Resolution | 7680x4320 (8K UHD) |\n\n";

    out << "#### SIDE PROFILE\n";
    out << "| Parameter | Value |\n";
    out << "|-----------|-------|\n";
    out << "| Rotation | Yaw=90, Pitch=0 (right side) |\n";
    out << "| Focal Length | " << rig.focalLength << "mm (auto) |\n";
    out << "| Spring Arm | " << rig.springArmLength << " (standard distance) |\n";
    out << "| Resolution | 7680x4320 (8K UHD) |\n\n";

    auto lightingProfile = USovereignLightingRig::computeProfile(
        childPhenotype.classification, childPhenotype);

    out << "### Lighting Profile: " << lightingProfile.profileName << "\n";
    out << "| Parameter | Value |\n";
    out << "|-----------|-------|\n";
    out << "| Profile Name | " << lightingProfile.profileName << " |\n";
    out << "| Temperature | " << lightingProfile.temperatureShift << "K |\n";
    out << "| GI Intensity | " << lightingProfile.globalIlluminationIntensity << " |\n";
    out << "| Bloom Threshold | " << lightingProfile.bloomThreshold << " |\n";
    out << "| Bloom Intensity | " << lightingProfile.bloomIntensity << " |\n";
    out << "| Lens Flare | " << lightingProfile.lensFlareIntensity << " |\n";
    out << "| SSR Quality | " << lightingProfile.ssrQuality << " |\n";
    out << "| Fog Density | " << lightingProfile.fogDensity << " |\n";
    out << "| Vignette | " << lightingProfile.vignetteIntensity << " |\n";
    out << "| Exposure Bias | " << lightingProfile.exposureBias << " |\n";
    out << "| Reflection Samples | " << lightingProfile.reflectionSamples << " |\n";
    out << "| Chromatic Aberration | " << lightingProfile.chromaticAberrationIntensity << " |\n";
    out << "| Refraction Depth | " << lightingProfile.refractionDepth << " |\n";
    out << "| Caustics Intensity | " << lightingProfile.causticsIntensity << " |\n";
    out << "| Saturation | " << lightingProfile.saturation << " |\n";
    out << "| Contrast | " << lightingProfile.contrast << " |\n";
    out << "| HDRI Skybox | " << (lightingProfile.enableHDRISkybox ? "ENABLED" : "disabled") << " |\n";
    out << "| High-Contrast HDRI | " << (lightingProfile.enableHighContrastHDRI ? "ENABLED" : "disabled") << " |\n";
    out << "| Values Clamped | " << (lightingProfile.allValuesClamped() ? "YES (zero drift)" : "FAIL") << " |\n\n";

    out << "### Truth Overlay (FSovereignPedigree)\n";
    out << "| Field | Value |\n";
    out << "|-------|-------|\n";
    out << "| Raw Hash | `" << scene.pedigree.rawHash << "` |\n";
    out << "| Phenotype Class | " << scene.pedigree.phenotypeClassName << " |\n";
    out << "| Mesh Family | " << scene.pedigree.meshFamilyName << " |\n";
    out << "| Loci Count | " << scene.pedigree.loci.size() << " |\n";
    out << "| Server Verified | " << (scene.pedigree.serverVerified ? "YES" : "PENDING (no server in test)") << " |\n";
    out << "| Verification Status | " << scene.pedigree.verificationStatusName << " |\n";
    out << "| VERIFIED Badge Green | " << (scene.pedigree.isVerifiedBadgeGreen() ? "GREEN" : "GREY (awaiting server)") << " |\n\n";

    out << "### 16 Gene Loci (Truth Overlay Data)\n";
    out << "| # | Locus | Byte Offset | Hex | Normalized |\n";
    out << "|---|-------|-------------|-----|------------|\n";
    for (size_t i = 0; i < scene.pedigree.loci.size(); i++) {
        const auto& loc = scene.pedigree.loci[i];
        out << "| " << i << " | " << loc.name << " | " << loc.byteOffset
            << " | `" << loc.hexValue << "` | " << std::fixed << std::setprecision(4) << loc.normalizedValue << " |\n";
    }
    out << "\n";

    showroom.reset();
}

void generateChronosPersistenceProof(std::ofstream& out,
                                       const FSpawnLineage& lineage) {
    out << "## 3. Chronos Persistence Log (The Memory Proof)\n\n";

    out << "### FSpawnLineage Record\n";
    out << "```\n";
    out << "childHash:        " << lineage.childHash << "\n";
    out << "parentAHash:      " << lineage.parentAHash << "\n";
    out << "parentBHash:      " << lineage.parentBHash << "\n";
    out << "sovereignSeed:    " << lineage.sovereignSeed << "\n";
    out << "generation:       " << lineage.generation << "\n";
    out << "totalMutations:   " << lineage.totalMutations << "\n";
    out << "lineageHash:      " << lineage.lineageHash << "\n";
    out << "entityKey:        " << lineage.childEntityKey << "\n";
    out << "birthTimestamp:   " << lineage.birthTimestamp << "\n";
    out << "flushedToChronos: " << (lineage.flushedToChronos ? "true" : "false") << "\n";
    out << "integrityVerified: " << (lineage.verifyIntegrity() ? "PASS" : "FAIL") << "\n";
    out << "```\n\n";

    out << "### Canonical JSON (Input to SHA-256)\n";
    out << "```json\n" << lineage.canonicalize() << "\n```\n\n";

    out << "### SHA-256 Lineage Hash Verification\n";
    std::string recomputed = lineage.computeLineageHash();
    out << "| Check | Value |\n";
    out << "|-------|-------|\n";
    out << "| Stored lineageHash | `" << lineage.lineageHash << "` |\n";
    out << "| Recomputed hash | `" << recomputed << "` |\n";
    out << "| Match | " << (lineage.lineageHash == recomputed ? "**YES**" : "**NO**") << " |\n\n";

    out << "### Hard Crash Simulation -> Recovery\n";
    out << "```\n";

    ChronosConfig cfg;
    cfg.persistencePath = "/tmp/crash_proof_spawner.bin";
    cfg.autoSaveOnEnqueue = true;
    ChronosEngine::Get().reset();
    ChronosEngine::Get().configure(cfg);

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
    ChronosEngine::Get().enqueue(chronosKey, payload, 0, "spawner-system");

    int preCount = ChronosEngine::Get().pendingCount();
    out << "[PRE-CRASH]  Chronos pendingCount = " << preCount << "\n";
    out << "[PRE-CRASH]  Persistence path = " << cfg.persistencePath << "\n";
    out << "[PRE-CRASH]  Key = " << chronosKey << "\n";

    out << "[SIMULATING HARD CRASH...]\n";

    ChronosEngine::Get().reset();
    ChronosEngine::Get().configure(cfg);

    int postResetCount = ChronosEngine::Get().pendingCount();
    out << "[POST-CRASH] Chronos pendingCount = " << postResetCount << " (memory wiped)\n";

    bool recovered = ChronosEngine::Get().recoverFromCrash();
    int recoveredCount = ChronosEngine::Get().pendingCount();
    out << "[RECOVERY]   recoverFromCrash() = " << (recovered ? "true" : "false") << "\n";
    out << "[RECOVERY]   Chronos pendingCount = " << recoveredCount << " (restored from disk)\n";

    auto& showroom = ASovereignShowroom::Get();
    auto& forge = BiologicalForge::Get();
    forge.reset();
    auto childPhenotype = forge.forge(lineage.childHash, lineage.childEntityKey);
    auto scene = showroom.loadEntity("offspring-recovered", childPhenotype);

    showroom.updateInspectionRotation(45.0f, -15.0f, 0.0f, 1.5f);
    showroom.persistInspectionState();

    out << "[INSPECTION] Persisted yaw=45 pitch=-15 roll=0 zoom=1.5\n";

    showroom.reset();
    forge.reset();
    auto childPhenotype2 = forge.forge(lineage.childHash, lineage.childEntityKey);
    auto scene2 = showroom.loadEntity("offspring-recovered", childPhenotype2);
    auto restoredState = showroom.recoverInspectionState("offspring-recovered");

    out << "[RESTORED]   recoverInspectionState() yaw=" << restoredState.rotationYaw
        << " pitch=" << restoredState.rotationPitch
        << " roll=" << restoredState.rotationRoll
        << " zoom=" << restoredState.zoomLevel << "\n";

    bool orientationMatch = (std::abs(restoredState.rotationYaw - 45.0f) < 0.001f &&
                              std::abs(restoredState.rotationPitch - (-15.0f)) < 0.001f &&
                              std::abs(restoredState.rotationRoll - 0.0f) < 0.001f &&
                              std::abs(restoredState.zoomLevel - 1.5f) < 0.001f);

    out << "[VERIFIED]   Orientation restored: " << (orientationMatch ? "YES" : "NO") << "\n";
    out << "[VERIFIED]   Phenotype active: " << (scene2.active ? "YES" : "NO") << "\n";
    out << "[VERIFIED]   Classification: " << scene2.pedigree.phenotypeClassName << "\n";
    out << "[VERIFIED]   Loci count: " << scene2.pedigree.loci.size() << "\n";

    auto recoveryStats = ChronosEngine::Get().getStats();
    out << "[STATS]      totalCrashRecoveries = " << recoveryStats.totalCrashRecoveries << "\n";
    out << "[STATS]      totalEnqueued = " << recoveryStats.totalEnqueued << "\n";
    out << "```\n\n";

    showroom.reset();
    ChronosEngine::Get().reset();
}

int main() {
    std::cout << "=== Volcanic x Crystalline Cross — Full Proof Generation ===" << std::endl;

    ChronosConfig cfg;
    cfg.persistencePath = "/tmp/volcanic_crystalline_proof.bin";
    cfg.autoSaveOnEnqueue = true;
    ChronosEngine::Get().configure(cfg);

    std::string volcanicSeed = "volcanic-dragon-alpha";
    std::string crystallineSeed = "crystalline-golem-omega";

    std::string parentAHash = SovereignSHA256::hash(volcanicSeed);
    std::string parentBHash = SovereignSHA256::hash(crystallineSeed);

    std::cout << "Parent A (Volcanic):    " << parentAHash << std::endl;
    std::cout << "Parent B (Crystalline): " << parentBHash << std::endl;

    auto& forge = BiologicalForge::Get();
    auto parentAPhenotype = forge.forge(parentAHash, "volcanic-parent");
    auto parentBPhenotype = forge.forge(parentBHash, "crystalline-parent");

    std::cout << "Parent A class: " << parentAPhenotype.classificationName << std::endl;
    std::cout << "Parent B class: " << parentBPhenotype.classificationName << std::endl;

    auto& spawner = SovereignSpawner::Get();
    std::string sovereignSeed = "obsidian-glass-genesis";
    auto result = spawner.spawn(parentAHash, parentBHash, sovereignSeed);

    std::cout << "Child hash:     " << result.lineage.childHash << std::endl;
    std::cout << "Child class:    " << result.childPhenotype.classificationName << std::endl;
    std::cout << "Lineage hash:   " << result.lineage.lineageHash << std::endl;
    std::cout << "Mutations:      " << result.lineage.totalMutations << std::endl;
    std::cout << "Integrity:      " << (result.lineage.verifyIntegrity() ? "PASS" : "FAIL") << std::endl;

    generateGeneticsAuditJson("/tmp/genetics_audit.json",
                                parentAHash, parentBHash,
                                result.lineage,
                                parentAPhenotype, parentBPhenotype,
                                result.childPhenotype);
    std::cout << "\n[1] genetics_audit.json written" << std::endl;

    std::ofstream report("/tmp/sovereign_spawner_proof_report.md");
    report << "# Sovereign Spawner — Module 9 Proof Report\n";
    report << "## Volcanic x Crystalline Cross: The Obsidian-Glass Genesis\n\n";

    report << "### Cross Summary\n";
    report << "| Field | Value |\n";
    report << "|-------|-------|\n";
    report << "| Parent A (Volcanic) | `" << parentAHash << "` |\n";
    report << "| Parent A Class | " << parentAPhenotype.classificationName << " |\n";
    report << "| Parent B (Crystalline) | `" << parentBHash << "` |\n";
    report << "| Parent B Class | " << parentBPhenotype.classificationName << " |\n";
    report << "| Sovereign Seed | `" << sovereignSeed << "` |\n";
    report << "| Child Hash | `" << result.lineage.childHash << "` |\n";
    report << "| Child Class | " << result.childPhenotype.classificationName << " |\n";
    report << "| Generation | " << result.lineage.generation << " |\n";
    report << "| Total Mutations | " << result.lineage.totalMutations << " |\n";
    report << "| Lineage Hash | `" << result.lineage.lineageHash << "` |\n";
    report << "| Lineage Integrity | " << (result.lineage.verifyIntegrity() ? "PASS" : "FAIL") << " |\n";
    report << "| Child Phenotype Integrity | " << (result.childPhenotype.verifyIntegrity() ? "PASS" : "FAIL") << " |\n\n";

    report << "---\n\n";

    report << "## 2. Locus-by-Locus Inheritance (The Ribosome Proof)\n\n";
    report << "| # | Locus | Dominance | Parent A (hex/raw) | Parent B (hex/raw) | Child (raw) | Mode | Mutated |\n";
    report << "|---|-------|-----------|---------------------|---------------------|-------------|------|----------|\n";

    auto genomeA = GeneticGenomeParser::hashToBytes(parentAHash);
    auto genomeB = GeneticGenomeParser::hashToBytes(parentBHash);

    for (int i = 0; i < 16; i++) {
        const auto& entry = GeneticDominanceTable::table()[i];
        const auto& inh = result.lineage.inheritanceMap[i];
        report << "| " << i << " | " << entry.locusName
               << " | " << domStr(entry.dominance)
               << " | `" << locusHex(genomeA, entry.byteOffset, entry.byteLength) << "` (" << inh.parentAValue << ")"
               << " | `" << locusHex(genomeB, entry.byteOffset, entry.byteLength) << "` (" << inh.parentBValue << ")"
               << " | " << inh.childValue
               << " | " << inhModeStr(inh.mode)
               << " | " << (inh.mutated ? "**YES**" : "no") << " |\n";
    }

    report << "\n### Codominant Blend Analysis (Primary/Accent Colors)\n\n";
    for (int i = 0; i < 6; i++) {
        const auto& inh = result.lineage.inheritanceMap[i];
        const auto& entry = GeneticDominanceTable::table()[i];
        if (inh.mode == InheritanceMode::BLEND) {
            report << "- **" << entry.locusName << "**: BLEND mode. A=" << inh.parentAValue
                   << ", B=" << inh.parentBValue << ", Child=" << inh.childValue
                   << ". Formula: `child = A*(1-t) + B*t` where t derived from dominanceRoll\n";
        } else {
            report << "- **" << entry.locusName << "**: " << inhModeStr(inh.mode) << " (value=" << inh.childValue << ")\n";
        }
    }

    report << "\n### Dominant Inheritance: Emission Gene (Locus 8)\n\n";
    {
        const auto& inh = result.lineage.inheritanceMap[8];
        report << "- Dominance type: **DOMINANT**\n";
        report << "- Parent A emission raw: " << inh.parentAValue << "\n";
        report << "- Parent B emission raw: " << inh.parentBValue << "\n";
        report << "- Middle bits A (genome[" << 12 + (8 % 8) << "]): " << static_cast<int>(genomeA[12 + (8 % 8)]) << "\n";
        report << "- Middle bits B (genome[" << 12 + (8 % 8) << "]): " << static_cast<int>(genomeB[12 + (8 % 8)]) << "\n";
        bool aStronger = genomeA[12 + (8 % 8)] >= genomeB[12 + (8 % 8)];
        report << "- A stronger (middleBitsA >= middleBitsB): " << (aStronger ? "YES" : "NO") << "\n";
        report << "- Inherited from: **" << inhModeStr(inh.mode) << "**\n";
        report << "- Child emission value: " << inh.childValue << "\n\n";
    }

    report << "\n### Bitwise Crossover Mask Derivation\n\n";
    report << "```\n";
    report << "1. RNG seeded with: SHA256(sovereignSeed + \":crossover\")\n";
    report << "   Seed = SHA256(\"" << sovereignSeed << ":crossover\")\n";
    report << "   = " << SovereignSHA256::hash(sovereignSeed + ":crossover") << "\n\n";
    report << "2. Per-locus decision chain (16 loci):\n";
    report << "   For each locus:\n";
    report << "     mutationRoll = rng.next01()\n";
    report << "     effectiveRate = min(baseMutationRate * mutationSensitivity * 100, 0.10)\n";
    report << "     if mutationRoll < effectiveRate:\n";
    report << "       -> MUTATION (wildcard bytes from RNG)\n";
    report << "     else:\n";
    report << "       dominanceRoll = rng.next01()\n";
    report << "       middleBitsA = genome_A[12 + (locusIndex % 8)]\n";
    report << "       middleBitsB = genome_B[12 + (locusIndex % 8)]\n";
    report << "       aStronger = middleBitsA >= middleBitsB\n";
    report << "       DOMINANT:   aStronger ? PARENT_A : PARENT_B\n";
    report << "       RECESSIVE:  !aStronger ? PARENT_A : PARENT_B\n";
    report << "       CODOMINANT: roll<0.25->A, roll<0.50->B, else->BLEND\n\n";
    report << "3. Child hash = SHA256(bytesToHex(childGenome) + \":\" + effectiveSeed)\n";
    report << "   effectiveSeed = \"" << sovereignSeed << "\"\n";
    report << "```\n\n";

    report << "---\n\n";

    SovereignSpawner::Get().reset();
    BiologicalForge::Get().reset();
    ChronosEngine::Get().reset();
    SovereignArena::Get().reset();
    ASovereignShowroom::Get().reset();

    generateShowroomCameraConfigs(report, result.childPhenotype);

    report << "---\n\n";

    generateChronosPersistenceProof(report, result.lineage);

    report << "---\n\n";
    report << "## Determinism Proof\n\n";

    ChronosEngine::Get().reset();
    ChronosConfig cfg2;
    cfg2.persistencePath = "/tmp/det_proof.bin";
    ChronosEngine::Get().configure(cfg2);
    BiologicalForge::Get().reset();
    SovereignSpawner::Get().reset();

    auto r1 = SovereignSpawner::Get().spawn(parentAHash, parentBHash, sovereignSeed);

    ChronosEngine::Get().reset();
    ChronosEngine::Get().configure(cfg2);
    BiologicalForge::Get().reset();
    SovereignSpawner::Get().reset();

    auto r2 = SovereignSpawner::Get().spawn(parentAHash, parentBHash, sovereignSeed);

    report << "| Run | Child Hash | Lineage Hash | Mutations | Classification |\n";
    report << "|-----|-----------|--------------|-----------|----------------|\n";
    report << "| Run 1 | `" << r1.lineage.childHash << "` | `" << r1.lineage.lineageHash << "` | "
           << r1.lineage.totalMutations << " | " << r1.childPhenotype.classificationName << " |\n";
    report << "| Run 2 | `" << r2.lineage.childHash << "` | `" << r2.lineage.lineageHash << "` | "
           << r2.lineage.totalMutations << " | " << r2.childPhenotype.classificationName << " |\n";
    report << "| Match | " << (r1.lineage.childHash == r2.lineage.childHash ? "**YES**" : "NO")
           << " | " << (r1.lineage.lineageHash == r2.lineage.lineageHash ? "**YES**" : "NO")
           << " | " << (r1.lineage.totalMutations == r2.lineage.totalMutations ? "**YES**" : "NO")
           << " | " << (r1.childPhenotype.classificationName == r2.childPhenotype.classificationName ? "**YES**" : "NO")
           << " |\n\n";
    report << "**Determinism: " << (r1.lineage.childHash == r2.lineage.childHash ? "CONFIRMED" : "FAILED") << "**\n\n";

    report.close();
    std::cout << "[2] sovereign_spawner_proof_report.md written" << std::endl;
    std::cout << "\n=== PROOF GENERATION COMPLETE ===" << std::endl;

    return 0;
}
