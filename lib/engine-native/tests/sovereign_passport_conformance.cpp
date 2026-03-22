#include "../generated/SovereignPassport.h"
#include <iostream>
#include <cassert>
#include <set>
#include <cstring>
#include <algorithm>
#include <sstream>

using namespace Sovereign;

static int passCount = 0;
static int failCount = 0;

#define TEST(name) { const char* testName = name; try {
#define END_TEST(name) std::cout << "  PASS: " << testName << std::endl; passCount++; } catch (...) { std::cout << "  FAIL: " << testName << std::endl; failCount++; } }
#define ASSERT_TRUE(expr) if (!(expr)) { std::cout << "ASSERT_TRUE failed: " #expr " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }
#define ASSERT_FALSE(expr) if ((expr)) { std::cout << "ASSERT_FALSE failed: " #expr " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }
#define ASSERT_EQ(a, b) if ((a) != (b)) { std::cout << "ASSERT_EQ failed: " #a " != " #b " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }

static FVisualPhenotype makeTestPhenotype(const std::string& hash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2") {
    return BiologicalForge::Get().forge(hash, "test_entity");
}

static FBehavioralProfile makeTestProfile(const FVisualPhenotype& p) {
    return SovereignIntelKernel::Get().generateProfile(p);
}

static FHabitatState makeTestHabitat() {
    return SovereignHabitatArbiter::Get().generateHabitat("TEST_WORLD_SEED_42");
}

static FSynergyResult makeTestSynergy(const FVisualPhenotype& p, const FHabitatState& h) {
    return SovereignHabitatArbiter::Get().computeSynergy(p, h);
}

int main() {
    std::cout << "============================================================" << std::endl;
    std::cout << "  SOVEREIGN PASSPORT CONFORMANCE TESTS (Module 15)" << std::endl;
    std::cout << "============================================================\n" << std::endl;

    auto phenotype = makeTestPhenotype();
    auto profile = makeTestProfile(phenotype);
    auto habitat = makeTestHabitat();
    auto synergy = makeTestSynergy(phenotype, habitat);
    auto& authority = SovereignPassportAuthority::Get();
    authority.resetStats();

    TEST("shader_type_enum_strings")
        ASSERT_EQ(shaderTypeToString(ShaderType::STANDARD_PBR), "STANDARD_PBR");
        ASSERT_EQ(shaderTypeToString(ShaderType::ANISOTROPIC_GLASS), "ANISOTROPIC_GLASS");
        ASSERT_EQ(shaderTypeToString(ShaderType::SUBSURFACE_SCATTER), "SUBSURFACE_SCATTER");
        ASSERT_EQ(shaderTypeToString(ShaderType::EMISSIVE_PULSE), "EMISSIVE_PULSE");
        ASSERT_EQ(shaderTypeToString(ShaderType::METALLIC_FLAKE), "METALLIC_FLAKE");
        ASSERT_EQ(shaderTypeToString(ShaderType::ETHEREAL_TRANSLUCENT), "ETHEREAL_TRANSLUCENT");
        ASSERT_EQ(shaderTypeToString(ShaderType::VOLCANIC_LAVA), "VOLCANIC_LAVA");
        ASSERT_EQ(shaderTypeToString(ShaderType::AQUEOUS_CAUSTIC), "AQUEOUS_CAUSTIC");
    END_TEST("shader_type_enum_strings")

    TEST("mesh_archetype_enum_strings")
        ASSERT_EQ(meshArchetypeToString(MeshArchetype::SMOOTH_ORB), "SMOOTH_ORB");
        ASSERT_EQ(meshArchetypeToString(MeshArchetype::ANGULAR_SHARD), "ANGULAR_SHARD");
        ASSERT_EQ(meshArchetypeToString(MeshArchetype::JAGGED_CRYSTAL), "JAGGED_CRYSTAL");
        ASSERT_EQ(meshArchetypeToString(MeshArchetype::FLOWING_TENDRIL), "FLOWING_TENDRIL");
        ASSERT_EQ(meshArchetypeToString(MeshArchetype::DENSE_MONOLITH), "DENSE_MONOLITH");
        ASSERT_EQ(meshArchetypeToString(MeshArchetype::HOLLOW_SHELL), "HOLLOW_SHELL");
        ASSERT_EQ(meshArchetypeToString(MeshArchetype::COMPOUND_CLUSTER), "COMPOUND_CLUSTER");
        ASSERT_EQ(meshArchetypeToString(MeshArchetype::ORGANIC_BLOOM), "ORGANIC_BLOOM");
    END_TEST("mesh_archetype_enum_strings")

    TEST("material_manifest_defaults")
        FMaterialManifest mat;
        ASSERT_EQ(mat.shaderTypeName, "STANDARD_PBR");
        ASSERT_TRUE(mat.roughness >= 0.0f && mat.roughness <= 1.0f);
        ASSERT_TRUE(mat.opacity >= 0.0f && mat.opacity <= 1.0f);
        ASSERT_TRUE(mat.refractionIndex >= 1.0f);
    END_TEST("material_manifest_defaults")

    TEST("geometry_manifest_defaults")
        FGeometryManifest geo;
        ASSERT_EQ(geo.meshArchetypeName, "SMOOTH_ORB");
        ASSERT_TRUE(geo.scaleX > 0.0f);
        ASSERT_TRUE(geo.scaleY > 0.0f);
        ASSERT_TRUE(geo.scaleZ > 0.0f);
    END_TEST("geometry_manifest_defaults")

    TEST("behavior_manifest_canonicalize")
        FBehaviorManifest beh;
        beh.archetypeName = "AGGRESSIVE";
        beh.aggressionBias = 0.8f;
        beh.preferredAction = "STRIKE";
        beh.secondaryAction = "CHARGE";
        std::string c = beh.canonicalize();
        ASSERT_TRUE(c.find("AGGRESSIVE") != std::string::npos);
        ASSERT_TRUE(c.find("STRIKE") != std::string::npos);
        ASSERT_TRUE(c.find("CHARGE") != std::string::npos);
    END_TEST("behavior_manifest_canonicalize")

    TEST("environment_manifest_active_buffs")
        FEnvironmentManifest env;
        env.biomeName = "VOLCANIC";
        env.activeBuffs = {"ATTACK_BOOST", "THERMAL_RESISTANCE"};
        std::string c = env.canonicalize();
        ASSERT_TRUE(c.find("ATTACK_BOOST") != std::string::npos);
        ASSERT_TRUE(c.find("THERMAL_RESISTANCE") != std::string::npos);
        ASSERT_TRUE(c.find("VOLCANIC") != std::string::npos);
    END_TEST("environment_manifest_active_buffs")

    TEST("vmo_hash_integrity")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_001");
        ASSERT_TRUE(vmo.verifyIntegrity());
        ASSERT_TRUE(vmo.manifestHash.size() == 64);
    END_TEST("vmo_hash_integrity")

    TEST("vmo_genome_hash_preserved")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_002");
        ASSERT_EQ(vmo.genomeHash, phenotype.sourceHash);
    END_TEST("vmo_genome_hash_preserved")

    TEST("vmo_phenotype_class_preserved")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_003");
        ASSERT_EQ(vmo.phenotypeClass, phenotype.classificationName);
    END_TEST("vmo_phenotype_class_preserved")

    TEST("vmo_material_from_forge")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_004");
        ASSERT_TRUE(vmo.material.roughness == phenotype.material.roughness);
        ASSERT_TRUE(vmo.material.metalness == phenotype.material.metallic);
        ASSERT_TRUE(vmo.material.opacity == phenotype.material.opacity);
        ASSERT_TRUE(vmo.material.emissionIntensity == phenotype.material.emissionIntensity);
    END_TEST("vmo_material_from_forge")

    TEST("vmo_geometry_from_forge")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_005");
        ASSERT_TRUE(vmo.geometry.scaleX == phenotype.morphology.scaleX);
        ASSERT_TRUE(vmo.geometry.scaleY == phenotype.morphology.scaleY);
        ASSERT_TRUE(vmo.geometry.scaleZ == phenotype.morphology.scaleZ);
        ASSERT_TRUE(vmo.geometry.animationFrequency == phenotype.morphology.animationFrequency);
    END_TEST("vmo_geometry_from_forge")

    TEST("vmo_behavior_from_intel")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_006");
        ASSERT_EQ(vmo.behavior.archetypeName, profile.archetypeName);
        ASSERT_TRUE(vmo.behavior.aggressionBias == profile.weights.aggression);
        ASSERT_TRUE(vmo.behavior.defenseBias == profile.weights.defenseBias);
        ASSERT_TRUE(vmo.behavior.elusivenessBias == profile.weights.elusiveness);
    END_TEST("vmo_behavior_from_intel")

    TEST("vmo_environment_from_habitat")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_007");
        ASSERT_EQ(vmo.environment.biomeName, habitat.biomeName);
        ASSERT_EQ(vmo.environment.synergyGrade, synergy.gradeName);
        ASSERT_TRUE(vmo.environment.synergyCoefficient == synergy.coefficient);
    END_TEST("vmo_environment_from_habitat")

    TEST("vmo_preferred_action_set")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_008");
        ASSERT_TRUE(!vmo.behavior.preferredAction.empty());
        ASSERT_TRUE(!vmo.behavior.secondaryAction.empty());
        ASSERT_TRUE(vmo.behavior.preferredAction != vmo.behavior.secondaryAction);
    END_TEST("vmo_preferred_action_set")

    TEST("vmo_shader_type_classified")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_009");
        ASSERT_TRUE(!vmo.material.shaderTypeName.empty());
        ASSERT_TRUE(vmo.material.shaderTypeName != "");
    END_TEST("vmo_shader_type_classified")

    TEST("vmo_mesh_archetype_classified")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_010");
        ASSERT_TRUE(!vmo.geometry.meshArchetypeName.empty());
        ASSERT_TRUE(vmo.geometry.meshArchetypeName != "");
    END_TEST("vmo_mesh_archetype_classified")

    TEST("vmo_primary_color_hex")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_011");
        ASSERT_TRUE(vmo.material.primaryColor.size() == 7);
        ASSERT_TRUE(vmo.material.primaryColor[0] == '#');
    END_TEST("vmo_primary_color_hex")

    TEST("vmo_accent_color_hex")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_012");
        ASSERT_TRUE(vmo.material.accentColor.size() == 7);
        ASSERT_TRUE(vmo.material.accentColor[0] == '#');
    END_TEST("vmo_accent_color_hex")

    TEST("vmo_subsurface_color_hex")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "entity_013");
        ASSERT_TRUE(vmo.material.subsurfaceColor.size() == 7);
        ASSERT_TRUE(vmo.material.subsurfaceColor[0] == '#');
    END_TEST("vmo_subsurface_color_hex")

    TEST("vmo_determinism")
        auto vmo1 = authority.buildVMO(phenotype, profile, habitat, synergy, "det_test");
        auto vmo2 = authority.buildVMO(phenotype, profile, habitat, synergy, "det_test");
        ASSERT_EQ(vmo1.manifestHash, vmo2.manifestHash);
        ASSERT_EQ(vmo1.material.shaderTypeName, vmo2.material.shaderTypeName);
        ASSERT_EQ(vmo1.geometry.meshArchetypeName, vmo2.geometry.meshArchetypeName);
    END_TEST("vmo_determinism")

    TEST("passport_issue_and_sign")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "passport_001");
        ASSERT_TRUE(passport.verifySignature());
        ASSERT_TRUE(passport.passportSignature.size() == 64);
    END_TEST("passport_issue_and_sign")

    TEST("passport_full_verification")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "passport_002");
        ASSERT_TRUE(passport.verifyFull());
    END_TEST("passport_full_verification")

    TEST("passport_genome_hash")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "passport_003");
        ASSERT_EQ(passport.genomeHash, phenotype.sourceHash);
    END_TEST("passport_genome_hash")

    TEST("passport_phenotype_hash")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "passport_004");
        ASSERT_EQ(passport.phenotypeHash, phenotype.phenotypeHash);
    END_TEST("passport_phenotype_hash")

    TEST("passport_profile_hash")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "passport_005");
        ASSERT_EQ(passport.profileHash, profile.profileHash);
    END_TEST("passport_profile_hash")

    TEST("passport_contains_vmo")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "passport_006");
        ASSERT_TRUE(passport.vmo.verifyIntegrity());
        ASSERT_EQ(passport.vmo.genomeHash, phenotype.sourceHash);
    END_TEST("passport_contains_vmo")

    TEST("passport_tamper_detection")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "passport_007");
        ASSERT_TRUE(passport.verifyFull());
        passport.phenotypeClass = "TAMPERED";
        ASSERT_FALSE(passport.verifySignature());
        ASSERT_TRUE(authority.detectTampering(passport));
    END_TEST("passport_tamper_detection")

    TEST("passport_vmo_tamper_detection")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "passport_008");
        ASSERT_TRUE(passport.verifyFull());
        passport.vmo.material.roughness = 0.999f;
        ASSERT_FALSE(passport.vmo.verifyIntegrity());
        ASSERT_FALSE(passport.verifyFull());
    END_TEST("passport_vmo_tamper_detection")

    TEST("passport_determinism")
        authority.resetStats();
        auto p1 = authority.issuePassport(phenotype, profile, habitat, synergy, "det_p");
        auto p2 = authority.issuePassport(phenotype, profile, habitat, synergy, "det_p");
        ASSERT_EQ(p1.passportSignature, p2.passportSignature);
    END_TEST("passport_determinism")

    TEST("passport_json_export")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "export_001");
        std::string json = authority.exportPassportJSON(passport);
        ASSERT_TRUE(json.find("passportVersion") != std::string::npos);
        ASSERT_TRUE(json.find("genomeHash") != std::string::npos);
        ASSERT_TRUE(json.find("phenotypeClass") != std::string::npos);
        ASSERT_TRUE(json.find("archetypeName") != std::string::npos);
        ASSERT_TRUE(json.find("manifestHash") != std::string::npos);
        ASSERT_TRUE(json.find("passportSignature") != std::string::npos);
        ASSERT_TRUE(json.find("vmo") != std::string::npos);
    END_TEST("passport_json_export")

    TEST("passport_json_contains_shader")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "export_002");
        std::string json = authority.exportPassportJSON(passport);
        ASSERT_TRUE(json.find("shaderType") != std::string::npos);
        ASSERT_TRUE(json.find("meshArchetype") != std::string::npos);
    END_TEST("passport_json_contains_shader")

    TEST("passport_json_contains_colors")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "export_003");
        std::string json = authority.exportPassportJSON(passport);
        ASSERT_TRUE(json.find("primaryColor") != std::string::npos);
        ASSERT_TRUE(json.find("accentColor") != std::string::npos);
        ASSERT_TRUE(json.find("subsurfaceColor") != std::string::npos);
    END_TEST("passport_json_contains_colors")

    TEST("ue5_passport_struct")
        std::string ue5 = authority.generateUE5PassportStruct();
        ASSERT_TRUE(ue5.find("USTRUCT(BlueprintType)") != std::string::npos);
        ASSERT_TRUE(ue5.find("FSovereignEntityPassport") != std::string::npos);
        ASSERT_TRUE(ue5.find("GenomeHash") != std::string::npos);
        ASSERT_TRUE(ue5.find("ShaderType") != std::string::npos);
        ASSERT_TRUE(ue5.find("MeshArchetype") != std::string::npos);
        ASSERT_TRUE(ue5.find("PrimaryColor") != std::string::npos);
        ASSERT_TRUE(ue5.find("Scale") != std::string::npos);
        ASSERT_TRUE(ue5.find("PassportSignature") != std::string::npos);
    END_TEST("ue5_passport_struct")

    TEST("shader_classify_volcanic_lava")
        FOrganicMaterialProfile volMat;
        volMat.emissionIntensity = 5.0f;
        auto shader = SovereignPassportAuthority::classifyShader(volMat, PhenotypeClass::VOLCANIC);
        ASSERT_EQ(shader, ShaderType::VOLCANIC_LAVA);
    END_TEST("shader_classify_volcanic_lava")

    TEST("shader_classify_aqueous_caustic")
        FOrganicMaterialProfile aqMat;
        aqMat.subsurfaceScattering = 0.7f;
        auto shader = SovereignPassportAuthority::classifyShader(aqMat, PhenotypeClass::AQUEOUS);
        ASSERT_EQ(shader, ShaderType::AQUEOUS_CAUSTIC);
    END_TEST("shader_classify_aqueous_caustic")

    TEST("shader_classify_ethereal_translucent")
        FOrganicMaterialProfile ethMat;
        ethMat.opacity = 0.5f;
        auto shader = SovereignPassportAuthority::classifyShader(ethMat, PhenotypeClass::ETHEREAL);
        ASSERT_EQ(shader, ShaderType::ETHEREAL_TRANSLUCENT);
    END_TEST("shader_classify_ethereal_translucent")

    TEST("shader_classify_metallic_flake")
        FOrganicMaterialProfile metMat;
        metMat.metallic = 0.8f;
        auto shader = SovereignPassportAuthority::classifyShader(metMat, PhenotypeClass::ORGANIC);
        ASSERT_EQ(shader, ShaderType::METALLIC_FLAKE);
    END_TEST("shader_classify_metallic_flake")

    TEST("shader_classify_emissive_pulse")
        FOrganicMaterialProfile emMat;
        emMat.emissionIntensity = 5.0f;
        auto shader = SovereignPassportAuthority::classifyShader(emMat, PhenotypeClass::ORGANIC);
        ASSERT_EQ(shader, ShaderType::EMISSIVE_PULSE);
    END_TEST("shader_classify_emissive_pulse")

    TEST("shader_classify_anisotropic_glass")
        FOrganicMaterialProfile glassMat;
        glassMat.anisotropy = 0.7f;
        glassMat.opacity = 0.6f;
        auto shader = SovereignPassportAuthority::classifyShader(glassMat, PhenotypeClass::CRYSTALLINE);
        ASSERT_EQ(shader, ShaderType::ANISOTROPIC_GLASS);
    END_TEST("shader_classify_anisotropic_glass")

    TEST("shader_classify_subsurface")
        FOrganicMaterialProfile ssMat;
        ssMat.subsurfaceScattering = 0.6f;
        auto shader = SovereignPassportAuthority::classifyShader(ssMat, PhenotypeClass::ORGANIC);
        ASSERT_EQ(shader, ShaderType::SUBSURFACE_SCATTER);
    END_TEST("shader_classify_subsurface")

    TEST("mesh_archetype_crystalline_jagged")
        FMorphologyDescriptor morph;
        auto arch = SovereignPassportAuthority::classifyMeshArchetype(morph, PhenotypeClass::CRYSTALLINE);
        ASSERT_EQ(arch, MeshArchetype::JAGGED_CRYSTAL);
    END_TEST("mesh_archetype_crystalline_jagged")

    TEST("mesh_archetype_organic_bloom")
        FMorphologyDescriptor morph;
        auto arch = SovereignPassportAuthority::classifyMeshArchetype(morph, PhenotypeClass::ORGANIC);
        ASSERT_EQ(arch, MeshArchetype::ORGANIC_BLOOM);
    END_TEST("mesh_archetype_organic_bloom")

    TEST("active_buffs_computation")
        FSynergyResult syn;
        syn.attackModifier = 1.1f;
        syn.defenseModifier = 1.0f;
        syn.speedModifier = 1.2f;
        syn.thermalStress = 0.5f;
        syn.coefficient = 0.6f;
        auto buffs = SovereignPassportAuthority::computeActiveBuffs(syn);
        bool hasAttack = false, hasSpeed = false, hasThermal = false, hasAffinity = false;
        for (const auto& b : buffs) {
            if (b == "ATTACK_BOOST") hasAttack = true;
            if (b == "SPEED_BOOST") hasSpeed = true;
            if (b == "THERMAL_RESISTANCE") hasThermal = true;
            if (b == "HABITAT_AFFINITY") hasAffinity = true;
        }
        ASSERT_TRUE(hasAttack);
        ASSERT_TRUE(hasSpeed);
        ASSERT_TRUE(hasThermal);
        ASSERT_TRUE(hasAffinity);
    END_TEST("active_buffs_computation")

    TEST("active_buffs_no_false_positives")
        FSynergyResult syn;
        syn.attackModifier = 1.0f;
        syn.defenseModifier = 1.0f;
        syn.speedModifier = 1.0f;
        syn.accuracyModifier = 1.0f;
        syn.evasionModifier = 1.0f;
        syn.thermalStress = 0.0f;
        syn.coefficient = 0.0f;
        auto buffs = SovereignPassportAuthority::computeActiveBuffs(syn);
        ASSERT_TRUE(buffs.empty());
    END_TEST("active_buffs_no_false_positives")

    TEST("subsurface_color_volcanic")
        FLinearColor primary; primary.R = 0.5f; primary.G = 0.3f; primary.B = 0.1f;
        std::string color = SovereignPassportAuthority::computeSubsurfaceColor(primary, PhenotypeClass::VOLCANIC);
        ASSERT_TRUE(color[0] == '#');
        ASSERT_TRUE(color.find("FF") != std::string::npos);
    END_TEST("subsurface_color_volcanic")

    TEST("stats_passport_count")
        authority.resetStats();
        authority.issuePassport(phenotype, profile, habitat, synergy, "stats_001");
        authority.issuePassport(phenotype, profile, habitat, synergy, "stats_002");
        auto stats = authority.getStats();
        ASSERT_TRUE(stats.totalPassportsIssued >= 2);
    END_TEST("stats_passport_count")

    TEST("stats_class_distribution")
        authority.resetStats();
        authority.issuePassport(phenotype, profile, habitat, synergy, "dist_001");
        auto stats = authority.getStats();
        ASSERT_TRUE(stats.classDistribution.size() > 0);
    END_TEST("stats_class_distribution")

    TEST("stats_archetype_distribution")
        auto stats = authority.getStats();
        ASSERT_TRUE(stats.archetypeDistribution.size() > 0);
    END_TEST("stats_archetype_distribution")

    TEST("passport_delegate_fires")
        authority.resetStats();
        bool delegateFired = false;
        std::string capturedKey;
        authority.onPassportIssued([&](const FSovereignPassport& p, const std::string& key) {
            delegateFired = true;
            capturedKey = key;
        });
        authority.issuePassport(phenotype, profile, habitat, synergy, "delegate_test");
        ASSERT_TRUE(delegateFired);
        ASSERT_EQ(capturedKey, "delegate_test");
        authority.onPassportIssued(nullptr);
    END_TEST("passport_delegate_fires")

    TEST("genesis_ancestors_passports")
        int validPassports = 0;
        for (int i = 0; i < 5; i++) {
            std::string input = "GENESIS_" + std::to_string(i) + "_ANCESTOR";
            std::string hash = SovereignSHA256::hash(input);
            auto p = BiologicalForge::Get().forge(hash, "ancestor_" + std::to_string(i));
            auto prof = SovereignIntelKernel::Get().generateProfile(p);
            auto passport = authority.issuePassport(p, prof, habitat, synergy, "ancestor_" + std::to_string(i));
            if (passport.verifyFull()) validPassports++;
        }
        ASSERT_EQ(validPassports, 5);
    END_TEST("genesis_ancestors_passports")

    TEST("different_genomes_different_passports")
        std::string h1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        std::string h2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        auto p1 = BiologicalForge::Get().forge(h1, "diff_1");
        auto p2 = BiologicalForge::Get().forge(h2, "diff_2");
        auto prof1 = SovereignIntelKernel::Get().generateProfile(p1);
        auto prof2 = SovereignIntelKernel::Get().generateProfile(p2);
        auto pass1 = authority.issuePassport(p1, prof1, habitat, synergy, "diff_1");
        auto pass2 = authority.issuePassport(p2, prof2, habitat, synergy, "diff_2");
        ASSERT_TRUE(pass1.passportSignature != pass2.passportSignature);
        ASSERT_TRUE(pass1.vmo.material.primaryColor != pass2.vmo.material.primaryColor);
    END_TEST("different_genomes_different_passports")

    TEST("vmo_refraction_index_from_anisotropy")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "refr_test");
        float expected = 1.0f + phenotype.material.anisotropy * 0.5f;
        ASSERT_TRUE(std::abs(vmo.material.refractionIndex - expected) < 0.001f);
    END_TEST("vmo_refraction_index_from_anisotropy")

    TEST("vmo_emission_pulse_from_animation")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "pulse_test");
        float expected = phenotype.morphology.animationFrequency * 0.2f;
        ASSERT_TRUE(std::abs(vmo.material.emissionPulseHz - expected) < 0.001f);
    END_TEST("vmo_emission_pulse_from_animation")

    TEST("vmo_glow_from_emission")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "glow_test");
        float expected = phenotype.material.emissionIntensity * 0.3f;
        ASSERT_TRUE(std::abs(vmo.material.glowIntensity - expected) < 0.001f);
    END_TEST("vmo_glow_from_emission")

    TEST("vmo_lod_levels_from_forge")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "lod_test");
        ASSERT_EQ(vmo.geometry.lodLevels, static_cast<int>(phenotype.lodChain.size()));
    END_TEST("vmo_lod_levels_from_forge")

    TEST("vmo_base_mesh_family")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "mesh_test");
        ASSERT_TRUE(!vmo.geometry.baseMeshFamily.empty());
    END_TEST("vmo_base_mesh_family")

    TEST("sha256_passport_signature_64_chars")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "sha_test");
        ASSERT_EQ(passport.passportSignature.size(), static_cast<size_t>(64));
        for (char c : passport.passportSignature) {
            ASSERT_TRUE((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'));
        }
    END_TEST("sha256_passport_signature_64_chars")

    TEST("sha256_manifest_hash_64_chars")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "mh_test");
        ASSERT_EQ(vmo.manifestHash.size(), static_cast<size_t>(64));
    END_TEST("sha256_manifest_hash_64_chars")

    TEST("reset_clears_stats")
        authority.issuePassport(phenotype, profile, habitat, synergy, "pre_reset");
        authority.resetStats();
        auto stats = authority.getStats();
        ASSERT_EQ(stats.totalPassportsIssued, 0);
        ASSERT_EQ(stats.totalVerified, 0);
        ASSERT_EQ(stats.totalTampered, 0);
    END_TEST("reset_clears_stats")

    TEST("confidence_level_in_manifest")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "conf_test");
        ASSERT_TRUE(vmo.behavior.confidenceLevel >= 0.0f);
        ASSERT_TRUE(vmo.behavior.confidenceLevel <= 1.0f);
    END_TEST("confidence_level_in_manifest")

    TEST("vmo_version_field")
        auto vmo = authority.buildVMO(phenotype, profile, habitat, synergy, "ver_test");
        ASSERT_EQ(vmo.version, "1.0.0");
    END_TEST("vmo_version_field")

    TEST("passport_version_field")
        auto passport = authority.issuePassport(phenotype, profile, habitat, synergy, "pver_test");
        ASSERT_EQ(passport.passportVersion, "1.0.0");
    END_TEST("passport_version_field")

    std::cout << "\n==================================================" << std::endl;
    std::cout << "PASSPORT RESULTS: " << passCount << " passed, " << failCount << " failed" << std::endl;
    std::cout << "==================================================" << std::endl;

    return failCount > 0 ? 1 : 0;
}
