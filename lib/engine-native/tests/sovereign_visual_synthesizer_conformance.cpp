#include "../generated/SovereignVisualSynthesizer.h"
#include <iostream>
#include <cassert>
#include <set>
#include <cstring>
#include <algorithm>
#include <cmath>

using namespace Sovereign;

static int passCount = 0;
static int failCount = 0;

#define TEST(name) { const char* testName = name; try {
#define END_TEST(name) std::cout << "  PASS: " << testName << std::endl; passCount++; } catch (...) { std::cout << "  FAIL: " << testName << std::endl; failCount++; } }
#define ASSERT_TRUE(expr) if (!(expr)) { std::cout << "ASSERT_TRUE failed: " #expr " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }
#define ASSERT_FALSE(expr) if ((expr)) { std::cout << "ASSERT_FALSE failed: " #expr " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }
#define ASSERT_EQ(a, b) if ((a) != (b)) { std::cout << "ASSERT_EQ failed: " #a " != " #b " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }

static const std::string TEST_HASH = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

static FSovereignPassport makeTestPassport() {
    auto phenotype = BiologicalForge::Get().forge(TEST_HASH, "synth_test");
    auto profile = SovereignIntelKernel::Get().generateProfile(phenotype);
    auto habitat = SovereignHabitatArbiter::Get().generateHabitat("SYNTH_WORLD_42");
    auto synergy = SovereignHabitatArbiter::Get().computeSynergy(phenotype, habitat);
    return SovereignPassportAuthority::Get().issuePassport(phenotype, profile, habitat, synergy, "synth_test_entity");
}

int main() {
    std::cout << "============================================================" << std::endl;
    std::cout << "  SOVEREIGN VISUAL SYNTHESIZER CONFORMANCE TESTS (Module 16)" << std::endl;
    std::cout << "============================================================\n" << std::endl;

    auto passport = makeTestPassport();
    auto& synth = SovereignVisualSynthesizer::Get();
    synth.resetStats();

    std::cout << "=== SDF Primitive Tests ===" << std::endl;

    TEST("sdf_primitive_shape_names")
        ASSERT_EQ(FSDFPrimitive().shapeName(), "SPHERE");
        FSDFPrimitive box; box.shape = FSDFPrimitive::Shape::BOX;
        ASSERT_EQ(box.shapeName(), "BOX");
        FSDFPrimitive cyl; cyl.shape = FSDFPrimitive::Shape::CYLINDER;
        ASSERT_EQ(cyl.shapeName(), "CYLINDER");
        FSDFPrimitive tor; tor.shape = FSDFPrimitive::Shape::TORUS;
        ASSERT_EQ(tor.shapeName(), "TORUS");
        FSDFPrimitive cone; cone.shape = FSDFPrimitive::Shape::CONE;
        ASSERT_EQ(cone.shapeName(), "CONE");
        FSDFPrimitive cap; cap.shape = FSDFPrimitive::Shape::CAPSULE;
        ASSERT_EQ(cap.shapeName(), "CAPSULE");
    END_TEST("sdf_primitive_shape_names")

    TEST("sdf_primitive_canonicalize")
        FSDFPrimitive p;
        p.posX = 1.0f; p.sizeX = 2.0f;
        std::string c = p.canonicalize();
        ASSERT_TRUE(c.find("SPHERE") != std::string::npos);
        ASSERT_TRUE(c.find("posX") != std::string::npos);
        ASSERT_TRUE(c.find("sizeX") != std::string::npos);
    END_TEST("sdf_primitive_canonicalize")

    TEST("sdf_primitive_defaults")
        FSDFPrimitive p;
        ASSERT_TRUE(p.weight == 1.0f);
        ASSERT_TRUE(p.blendRadius >= 0.0f);
    END_TEST("sdf_primitive_defaults")

    std::cout << "\n=== SDF Composition Tests ===" << std::endl;

    TEST("sdf_composition_smooth_orb")
        auto comp = synth.buildSDFComposition(passport.vmo);
        ASSERT_TRUE(comp.primitiveCount() >= 2);
        ASSERT_TRUE(comp.boundingRadius > 0.0f);
    END_TEST("sdf_composition_smooth_orb")

    TEST("sdf_composition_archetype_preserved")
        auto comp = synth.buildSDFComposition(passport.vmo);
        ASSERT_EQ(comp.archetypeName, passport.vmo.geometry.meshArchetypeName);
    END_TEST("sdf_composition_archetype_preserved")

    TEST("sdf_composition_canonicalize")
        auto comp = synth.buildSDFComposition(passport.vmo);
        std::string c = comp.canonicalize();
        ASSERT_TRUE(c.find("primitiveCount") != std::string::npos);
        ASSERT_TRUE(c.find("globalBlendFactor") != std::string::npos);
        ASSERT_TRUE(c.find("boundingRadius") != std::string::npos);
    END_TEST("sdf_composition_canonicalize")

    TEST("sdf_composition_all_archetypes")
        std::string hashes[] = {
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        };
        for (const auto& h : hashes) {
            auto p = BiologicalForge::Get().forge(h, "arch_test");
            auto prof = SovereignIntelKernel::Get().generateProfile(p);
            auto hab = SovereignHabitatArbiter::Get().generateHabitat("ARCH_WORLD");
            auto syn = SovereignHabitatArbiter::Get().computeSynergy(p, hab);
            auto pass = SovereignPassportAuthority::Get().issuePassport(p, prof, hab, syn, "arch_entity");
            auto comp = synth.buildSDFComposition(pass.vmo);
            ASSERT_TRUE(comp.primitiveCount() >= 2);
            ASSERT_TRUE(comp.boundingRadius > 0.0f);
        }
    END_TEST("sdf_composition_all_archetypes")

    TEST("sdf_composition_determinism")
        auto c1 = synth.buildSDFComposition(passport.vmo);
        auto c2 = synth.buildSDFComposition(passport.vmo);
        ASSERT_EQ(c1.canonicalize(), c2.canonicalize());
    END_TEST("sdf_composition_determinism")

    TEST("sdf_blend_factor_varies")
        FVisualManifestObject vmo1 = passport.vmo;
        vmo1.geometry.meshArchetype = MeshArchetype::SMOOTH_ORB;
        vmo1.geometry.meshArchetypeName = "SMOOTH_ORB";
        auto c1 = synth.buildSDFComposition(vmo1);

        FVisualManifestObject vmo2 = passport.vmo;
        vmo2.geometry.meshArchetype = MeshArchetype::ANGULAR_SHARD;
        vmo2.geometry.meshArchetypeName = "ANGULAR_SHARD";
        auto c2 = synth.buildSDFComposition(vmo2);

        ASSERT_TRUE(c1.globalBlendFactor != c2.globalBlendFactor);
    END_TEST("sdf_blend_factor_varies")

    std::cout << "\n=== Shader Parameter Tests ===" << std::endl;

    TEST("shader_params_from_vmo")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.isValid());
        ASSERT_EQ(params.shaderTypeName, passport.vmo.material.shaderTypeName);
    END_TEST("shader_params_from_vmo")

    TEST("shader_params_clamped_roughness")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.roughness >= 0.0f && params.roughness <= 1.0f);
    END_TEST("shader_params_clamped_roughness")

    TEST("shader_params_clamped_metallic")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.metallic >= 0.0f && params.metallic <= 1.0f);
    END_TEST("shader_params_clamped_metallic")

    TEST("shader_params_clamped_opacity")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.opacity >= 0.0f && params.opacity <= 1.0f);
    END_TEST("shader_params_clamped_opacity")

    TEST("shader_params_clamped_refraction")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.refractionIndex >= 1.0f && params.refractionIndex <= 3.0f);
    END_TEST("shader_params_clamped_refraction")

    TEST("shader_params_clamped_fresnel")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.fresnelPower >= 0.0f && params.fresnelPower <= 20.0f);
    END_TEST("shader_params_clamped_fresnel")

    TEST("shader_params_base_color_parsed")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.baseColorR >= 0.0f && params.baseColorR <= 1.0f);
        ASSERT_TRUE(params.baseColorG >= 0.0f && params.baseColorG <= 1.0f);
        ASSERT_TRUE(params.baseColorB >= 0.0f && params.baseColorB <= 1.0f);
    END_TEST("shader_params_base_color_parsed")

    TEST("shader_params_emissive_scaled")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.emissiveR >= 0.0f);
        ASSERT_TRUE(params.emissiveG >= 0.0f);
        ASSERT_TRUE(params.emissiveB >= 0.0f);
    END_TEST("shader_params_emissive_scaled")

    TEST("shader_params_subsurface_parsed")
        auto params = synth.buildShaderParameters(passport.vmo);
        ASSERT_TRUE(params.subsurfaceR >= 0.0f && params.subsurfaceR <= 1.0f);
        ASSERT_TRUE(params.subsurfaceG >= 0.0f && params.subsurfaceG <= 1.0f);
        ASSERT_TRUE(params.subsurfaceB >= 0.0f && params.subsurfaceB <= 1.0f);
    END_TEST("shader_params_subsurface_parsed")

    TEST("shader_params_determinism")
        auto p1 = synth.buildShaderParameters(passport.vmo);
        auto p2 = synth.buildShaderParameters(passport.vmo);
        ASSERT_EQ(p1.canonicalize(), p2.canonicalize());
    END_TEST("shader_params_determinism")

    TEST("shader_params_canonicalize")
        auto params = synth.buildShaderParameters(passport.vmo);
        std::string c = params.canonicalize();
        ASSERT_TRUE(c.find("shaderType") != std::string::npos);
        ASSERT_TRUE(c.find("roughness") != std::string::npos);
        ASSERT_TRUE(c.find("metallic") != std::string::npos);
        ASSERT_TRUE(c.find("refractionIndex") != std::string::npos);
        ASSERT_TRUE(c.find("baseColor") != std::string::npos);
    END_TEST("shader_params_canonicalize")

    TEST("shader_weathering_volcanic")
        FVisualManifestObject volVmo = passport.vmo;
        volVmo.material.shaderType = ShaderType::VOLCANIC_LAVA;
        volVmo.material.shaderTypeName = "VOLCANIC_LAVA";
        auto params = synth.buildShaderParameters(volVmo);
        ASSERT_TRUE(params.weatheringIntensity > 0.5f);
        ASSERT_TRUE(params.microDisplacementFreq > 0.0f);
        ASSERT_TRUE(params.displacementScale > 0.0f);
    END_TEST("shader_weathering_volcanic")

    TEST("shader_weathering_crystal")
        FVisualManifestObject crysVmo = passport.vmo;
        crysVmo.geometry.meshArchetype = MeshArchetype::JAGGED_CRYSTAL;
        crysVmo.geometry.meshArchetypeName = "JAGGED_CRYSTAL";
        crysVmo.material.shaderType = ShaderType::STANDARD_PBR;
        crysVmo.material.shaderTypeName = "STANDARD_PBR";
        auto params = synth.buildShaderParameters(crysVmo);
        ASSERT_TRUE(params.weatheringIntensity > 0.0f);
        ASSERT_TRUE(params.microDisplacementFreq > 5.0f);
    END_TEST("shader_weathering_crystal")

    TEST("shader_no_weathering_standard")
        FVisualManifestObject stdVmo = passport.vmo;
        stdVmo.material.shaderType = ShaderType::STANDARD_PBR;
        stdVmo.material.shaderTypeName = "STANDARD_PBR";
        stdVmo.geometry.meshArchetype = MeshArchetype::SMOOTH_ORB;
        stdVmo.geometry.meshArchetypeName = "SMOOTH_ORB";
        auto params = synth.buildShaderParameters(stdVmo);
        ASSERT_TRUE(params.weatheringIntensity == 0.0f);
    END_TEST("shader_no_weathering_standard")

    std::cout << "\n=== VFX Mapping Tests ===" << std::endl;

    TEST("vfx_strike_emission_pulse")
        auto vfx = synth.mapActionToVFX("STRIKE", passport.vmo);
        ASSERT_EQ(vfx.typeName, "EMISSION_PULSE");
        ASSERT_TRUE(vfx.intensity >= 2.0f);
        ASSERT_TRUE(vfx.durationMs > 0.0f);
    END_TEST("vfx_strike_emission_pulse")

    TEST("vfx_guard_shield_flare")
        auto vfx = synth.mapActionToVFX("GUARD", passport.vmo);
        ASSERT_EQ(vfx.typeName, "SHIELD_FLARE");
    END_TEST("vfx_guard_shield_flare")

    TEST("vfx_charge_buildup")
        auto vfx = synth.mapActionToVFX("CHARGE", passport.vmo);
        ASSERT_EQ(vfx.typeName, "CHARGE_BUILDUP");
        ASSERT_TRUE(vfx.intensity >= 3.0f);
    END_TEST("vfx_charge_buildup")

    TEST("vfx_retreat_afterimage")
        auto vfx = synth.mapActionToVFX("RETREAT", passport.vmo);
        ASSERT_EQ(vfx.typeName, "DODGE_AFTERIMAGE");
    END_TEST("vfx_retreat_afterimage")

    TEST("vfx_counter_flash")
        auto vfx = synth.mapActionToVFX("COUNTER", passport.vmo);
        ASSERT_EQ(vfx.typeName, "COUNTER_FLASH");
        ASSERT_TRUE(vfx.durationMs <= 300.0f);
    END_TEST("vfx_counter_flash")

    TEST("vfx_feint_shimmer")
        auto vfx = synth.mapActionToVFX("FEINT", passport.vmo);
        ASSERT_EQ(vfx.typeName, "FEINT_SHIMMER");
    END_TEST("vfx_feint_shimmer")

    TEST("vfx_flank_afterimage")
        auto vfx = synth.mapActionToVFX("FLANK", passport.vmo);
        ASSERT_EQ(vfx.typeName, "DODGE_AFTERIMAGE");
    END_TEST("vfx_flank_afterimage")

    TEST("vfx_hold_idle_ambient")
        auto vfx = synth.mapActionToVFX("HOLD", passport.vmo);
        ASSERT_EQ(vfx.typeName, "IDLE_AMBIENT");
    END_TEST("vfx_hold_idle_ambient")

    TEST("vfx_emission_color_from_vmo")
        auto vfx = synth.mapActionToVFX("STRIKE", passport.vmo);
        ASSERT_EQ(vfx.emissionColor, passport.vmo.material.primaryColor);
    END_TEST("vfx_emission_color_from_vmo")

    TEST("vfx_particle_scale_from_geometry")
        auto vfx = synth.mapActionToVFX("STRIKE", passport.vmo);
        ASSERT_TRUE(vfx.particleScale >= 0.5f);
    END_TEST("vfx_particle_scale_from_geometry")

    TEST("vfx_type_enum_strings")
        ASSERT_EQ(vfxTypeToString(VFXType::EMISSION_PULSE), "EMISSION_PULSE");
        ASSERT_EQ(vfxTypeToString(VFXType::IMPACT_SHOCKWAVE), "IMPACT_SHOCKWAVE");
        ASSERT_EQ(vfxTypeToString(VFXType::SHIELD_FLARE), "SHIELD_FLARE");
        ASSERT_EQ(vfxTypeToString(VFXType::DODGE_AFTERIMAGE), "DODGE_AFTERIMAGE");
        ASSERT_EQ(vfxTypeToString(VFXType::CHARGE_BUILDUP), "CHARGE_BUILDUP");
        ASSERT_EQ(vfxTypeToString(VFXType::COUNTER_FLASH), "COUNTER_FLASH");
        ASSERT_EQ(vfxTypeToString(VFXType::FEINT_SHIMMER), "FEINT_SHIMMER");
        ASSERT_EQ(vfxTypeToString(VFXType::IDLE_AMBIENT), "IDLE_AMBIENT");
    END_TEST("vfx_type_enum_strings")

    TEST("vfx_canonicalize")
        auto vfx = synth.mapActionToVFX("STRIKE", passport.vmo);
        std::string c = vfx.canonicalize();
        ASSERT_TRUE(c.find("EMISSION_PULSE") != std::string::npos);
        ASSERT_TRUE(c.find("intensity") != std::string::npos);
        ASSERT_TRUE(c.find("durationMs") != std::string::npos);
    END_TEST("vfx_canonicalize")

    std::cout << "\n=== Mesh Synthesis Tests ===" << std::endl;

    TEST("mesh_synthesis_produces_vertices")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        ASSERT_TRUE(mesh.vertexCount() > 0);
    END_TEST("mesh_synthesis_produces_vertices")

    TEST("mesh_synthesis_produces_indices")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        ASSERT_TRUE(mesh.triangleCount() > 0);
    END_TEST("mesh_synthesis_produces_indices")

    TEST("mesh_synthesis_hash_integrity")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        ASSERT_TRUE(mesh.verifyIntegrity());
        ASSERT_EQ(mesh.meshHash.size(), static_cast<size_t>(64));
    END_TEST("mesh_synthesis_hash_integrity")

    TEST("mesh_synthesis_determinism")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto m1 = synth.synthesizeMesh(sdf, passport.vmo, 0);
        auto m2 = synth.synthesizeMesh(sdf, passport.vmo, 0);
        ASSERT_EQ(m1.meshHash, m2.meshHash);
        ASSERT_EQ(m1.vertexCount(), m2.vertexCount());
    END_TEST("mesh_synthesis_determinism")

    TEST("mesh_synthesis_genome_hash")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        ASSERT_EQ(mesh.genomeHash, passport.genomeHash);
    END_TEST("mesh_synthesis_genome_hash")

    TEST("mesh_synthesis_archetype")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        ASSERT_EQ(mesh.archetypeName, passport.vmo.geometry.meshArchetypeName);
    END_TEST("mesh_synthesis_archetype")

    TEST("mesh_lod_reduces_vertices")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto lod0 = synth.synthesizeMesh(sdf, passport.vmo, 0);
        auto lod1 = synth.synthesizeMesh(sdf, passport.vmo, 1);
        auto lod2 = synth.synthesizeMesh(sdf, passport.vmo, 2);
        ASSERT_TRUE(lod0.vertexCount() >= lod1.vertexCount());
        ASSERT_TRUE(lod1.vertexCount() >= lod2.vertexCount());
    END_TEST("mesh_lod_reduces_vertices")

    TEST("mesh_vertex_normals_normalized")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        for (int i = 0; i < std::min(10, mesh.vertexCount()); i++) {
            const auto& v = mesh.vertices[i];
            float len = std::sqrt(v.nx*v.nx + v.ny*v.ny + v.nz*v.nz);
            ASSERT_TRUE(std::abs(len - 1.0f) < 0.01f);
        }
    END_TEST("mesh_vertex_normals_normalized")

    TEST("mesh_uv_tiling_applied")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        ASSERT_TRUE(mesh.vertexCount() > 0);
        bool hasNonZeroUV = false;
        for (const auto& v : mesh.vertices) {
            if (v.u != 0.0f || v.v != 0.0f) { hasNonZeroUV = true; break; }
        }
        ASSERT_TRUE(hasNonZeroUV);
    END_TEST("mesh_uv_tiling_applied")

    TEST("mesh_canonicalize")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        std::string c = mesh.canonicalize();
        ASSERT_TRUE(c.find("vertexCount") != std::string::npos);
        ASSERT_TRUE(c.find("triangleCount") != std::string::npos);
        ASSERT_TRUE(c.find("genomeHash") != std::string::npos);
    END_TEST("mesh_canonicalize")

    std::cout << "\n=== Full Synthesis Pipeline Tests ===" << std::endl;

    TEST("full_synthesis_produces_result")
        synth.resetStats();
        auto result = synth.synthesize(passport);
        ASSERT_TRUE(result.verifyIntegrity());
        ASSERT_EQ(result.genomeHash, passport.genomeHash);
        ASSERT_EQ(result.entityKey, passport.entityKey);
    END_TEST("full_synthesis_produces_result")

    TEST("full_synthesis_mesh_valid")
        auto result = synth.synthesize(passport);
        ASSERT_TRUE(result.mesh.vertexCount() > 0);
        ASSERT_TRUE(result.mesh.triangleCount() > 0);
        ASSERT_TRUE(result.mesh.verifyIntegrity());
    END_TEST("full_synthesis_mesh_valid")

    TEST("full_synthesis_shader_valid")
        auto result = synth.synthesize(passport);
        ASSERT_TRUE(result.shaderParams.isValid());
    END_TEST("full_synthesis_shader_valid")

    TEST("full_synthesis_idle_vfx")
        auto result = synth.synthesize(passport);
        ASSERT_EQ(result.idleVFX.typeName, "IDLE_AMBIENT");
    END_TEST("full_synthesis_idle_vfx")

    TEST("full_synthesis_hash_64_chars")
        auto result = synth.synthesize(passport);
        ASSERT_EQ(result.synthesisHash.size(), static_cast<size_t>(64));
    END_TEST("full_synthesis_hash_64_chars")

    TEST("full_synthesis_determinism")
        ASSERT_TRUE(synth.verifySynthesisDeterminism(passport));
    END_TEST("full_synthesis_determinism")

    TEST("full_synthesis_different_genomes")
        std::string h2 = "1111111111111111111111111111111111111111111111111111111111111111";
        auto p2 = BiologicalForge::Get().forge(h2, "diff_synth");
        auto prof2 = SovereignIntelKernel::Get().generateProfile(p2);
        auto hab2 = SovereignHabitatArbiter::Get().generateHabitat("DIFF_WORLD");
        auto syn2 = SovereignHabitatArbiter::Get().computeSynergy(p2, hab2);
        auto pass2 = SovereignPassportAuthority::Get().issuePassport(p2, prof2, hab2, syn2, "diff_synth");
        auto r1 = synth.synthesize(passport);
        auto r2 = synth.synthesize(pass2);
        ASSERT_TRUE(r1.synthesisHash != r2.synthesisHash);
    END_TEST("full_synthesis_different_genomes")

    TEST("trigger_action_vfx")
        auto vfx = synth.triggerActionVFX(passport, "STRIKE");
        ASSERT_EQ(vfx.typeName, "EMISSION_PULSE");
    END_TEST("trigger_action_vfx")

    TEST("genesis_ancestors_synthesis")
        int validCount = 0;
        for (int i = 0; i < 5; i++) {
            std::string input = "GENESIS_SYNTH_" + std::to_string(i);
            std::string hash = SovereignSHA256::hash(input);
            auto p = BiologicalForge::Get().forge(hash, "g_" + std::to_string(i));
            auto prof = SovereignIntelKernel::Get().generateProfile(p);
            auto hab = SovereignHabitatArbiter::Get().generateHabitat("GENESIS_WORLD");
            auto syn = SovereignHabitatArbiter::Get().computeSynergy(p, hab);
            auto pass = SovereignPassportAuthority::Get().issuePassport(p, prof, hab, syn, "g_" + std::to_string(i));
            auto result = synth.synthesize(pass);
            if (result.verifyIntegrity() && result.mesh.vertexCount() > 0 && result.shaderParams.isValid()) {
                validCount++;
            }
        }
        ASSERT_EQ(validCount, 5);
    END_TEST("genesis_ancestors_synthesis")

    std::cout << "\n=== HLSL Shader Generation Tests ===" << std::endl;

    TEST("hlsl_standard_pbr")
        std::string hlsl = synth.generateHLSLShaderStub(ShaderType::STANDARD_PBR);
        ASSERT_TRUE(hlsl.find("Standard PBR") != std::string::npos);
        ASSERT_TRUE(hlsl.find("BaseColor") != std::string::npos);
        ASSERT_TRUE(hlsl.find("clamp") != std::string::npos);
    END_TEST("hlsl_standard_pbr")

    TEST("hlsl_volcanic_lava")
        std::string hlsl = synth.generateHLSLShaderStub(ShaderType::VOLCANIC_LAVA);
        ASSERT_TRUE(hlsl.find("LavaPulse") != std::string::npos);
        ASSERT_TRUE(hlsl.find("CrackDisplacement") != std::string::npos);
        ASSERT_TRUE(hlsl.find("EmissionIntensity") != std::string::npos);
    END_TEST("hlsl_volcanic_lava")

    TEST("hlsl_aqueous_caustic")
        std::string hlsl = synth.generateHLSLShaderStub(ShaderType::AQUEOUS_CAUSTIC);
        ASSERT_TRUE(hlsl.find("CausticPattern") != std::string::npos);
        ASSERT_TRUE(hlsl.find("VoronoiNoise") != std::string::npos);
    END_TEST("hlsl_aqueous_caustic")

    TEST("hlsl_ethereal_translucent")
        std::string hlsl = synth.generateHLSLShaderStub(ShaderType::ETHEREAL_TRANSLUCENT);
        ASSERT_TRUE(hlsl.find("FresnelTerm") != std::string::npos);
        ASSERT_TRUE(hlsl.find("FresnelPower") != std::string::npos);
    END_TEST("hlsl_ethereal_translucent")

    TEST("hlsl_anisotropic_glass")
        std::string hlsl = synth.generateHLSLShaderStub(ShaderType::ANISOTROPIC_GLASS);
        ASSERT_TRUE(hlsl.find("AnisotropicHighlight") != std::string::npos);
        ASSERT_TRUE(hlsl.find("Refraction") != std::string::npos);
    END_TEST("hlsl_anisotropic_glass")

    TEST("hlsl_subsurface_scatter")
        std::string hlsl = synth.generateHLSLShaderStub(ShaderType::SUBSURFACE_SCATTER);
        ASSERT_TRUE(hlsl.find("SubsurfaceProfile") != std::string::npos);
        ASSERT_TRUE(hlsl.find("MSM_Subsurface") != std::string::npos);
    END_TEST("hlsl_subsurface_scatter")

    TEST("hlsl_emissive_pulse")
        std::string hlsl = synth.generateHLSLShaderStub(ShaderType::EMISSIVE_PULSE);
        ASSERT_TRUE(hlsl.find("Pulse") != std::string::npos);
        ASSERT_TRUE(hlsl.find("EmissionPulseHz") != std::string::npos);
    END_TEST("hlsl_emissive_pulse")

    TEST("hlsl_metallic_flake")
        std::string hlsl = synth.generateHLSLShaderStub(ShaderType::METALLIC_FLAKE);
        ASSERT_TRUE(hlsl.find("FlakePattern") != std::string::npos);
        ASSERT_TRUE(hlsl.find("FlakeNormal") != std::string::npos);
    END_TEST("hlsl_metallic_flake")

    TEST("hlsl_all_have_gpu_safety_clamp")
        ShaderType allTypes[] = {
            ShaderType::STANDARD_PBR, ShaderType::VOLCANIC_LAVA, ShaderType::AQUEOUS_CAUSTIC,
            ShaderType::ETHEREAL_TRANSLUCENT, ShaderType::ANISOTROPIC_GLASS,
            ShaderType::SUBSURFACE_SCATTER, ShaderType::EMISSIVE_PULSE, ShaderType::METALLIC_FLAKE
        };
        for (auto t : allTypes) {
            std::string hlsl = synth.generateHLSLShaderStub(t);
            ASSERT_TRUE(hlsl.find("clamp(Roughness") != std::string::npos);
            ASSERT_TRUE(hlsl.find("clamp(Metallic") != std::string::npos);
            ASSERT_TRUE(hlsl.find("clamp(Opacity") != std::string::npos);
        }
    END_TEST("hlsl_all_have_gpu_safety_clamp")

    std::cout << "\n=== UE5 Code Generation Tests ===" << std::endl;

    TEST("ue5_synthesizer_class")
        std::string code = synth.generateUE5SynthesizerCode();
        ASSERT_TRUE(code.find("UCLASS(BlueprintType)") != std::string::npos);
        ASSERT_TRUE(code.find("USovereignVisualSynthesizer") != std::string::npos);
        ASSERT_TRUE(code.find("SynthesizeMesh") != std::string::npos);
        ASSERT_TRUE(code.find("CreateMaterialInstance") != std::string::npos);
        ASSERT_TRUE(code.find("TriggerActionVFX") != std::string::npos);
        ASSERT_TRUE(code.find("UProceduralMeshComponent") != std::string::npos);
        ASSERT_TRUE(code.find("UMaterialInstanceDynamic") != std::string::npos);
        ASSERT_TRUE(code.find("UNiagaraComponent") != std::string::npos);
    END_TEST("ue5_synthesizer_class")

    std::cout << "\n=== Stats & Delegate Tests ===" << std::endl;

    TEST("stats_track_synthesis")
        synth.resetStats();
        synth.synthesize(passport);
        auto stats = synth.getStats();
        ASSERT_TRUE(stats.totalSynthesized >= 1);
        ASSERT_TRUE(stats.totalVerticesGenerated > 0);
        ASSERT_TRUE(stats.totalTrianglesGenerated > 0);
        ASSERT_TRUE(stats.totalVFXGenerated >= 1);
    END_TEST("stats_track_synthesis")

    TEST("stats_archetype_distribution")
        auto stats = synth.getStats();
        ASSERT_TRUE(stats.archetypeCounts.size() > 0);
    END_TEST("stats_archetype_distribution")

    TEST("stats_shader_distribution")
        auto stats = synth.getStats();
        ASSERT_TRUE(stats.shaderCounts.size() > 0);
    END_TEST("stats_shader_distribution")

    TEST("stats_reset")
        synth.synthesize(passport);
        synth.resetStats();
        auto stats = synth.getStats();
        ASSERT_EQ(stats.totalSynthesized, 0);
        ASSERT_EQ(stats.totalVerticesGenerated, 0);
    END_TEST("stats_reset")

    TEST("synthesis_complete_delegate")
        synth.resetStats();
        bool fired = false;
        std::string capturedKey;
        synth.onSynthesisComplete([&](const FSynthesisResult& r, const std::string& key) {
            fired = true;
            capturedKey = key;
        });
        synth.synthesize(passport);
        ASSERT_TRUE(fired);
        ASSERT_EQ(capturedKey, passport.entityKey);
        synth.onSynthesisComplete(nullptr);
    END_TEST("synthesis_complete_delegate")

    TEST("vfx_triggered_delegate")
        bool fired = false;
        synth.onVFXTriggered([&](const FVFXDescriptor& v, const std::string& key) {
            fired = true;
        });
        synth.triggerActionVFX(passport, "STRIKE");
        ASSERT_TRUE(fired);
        synth.onVFXTriggered(nullptr);
    END_TEST("vfx_triggered_delegate")

    TEST("tamper_detection_mesh")
        auto result = synth.synthesize(passport);
        ASSERT_TRUE(result.verifyIntegrity());
        result.entityKey = "TAMPERED";
        ASSERT_FALSE(result.verifyIntegrity());
    END_TEST("tamper_detection_mesh")

    TEST("tamper_detection_synth_mesh")
        auto sdf = synth.buildSDFComposition(passport.vmo);
        auto mesh = synth.synthesizeMesh(sdf, passport.vmo, 0);
        ASSERT_TRUE(mesh.verifyIntegrity());
        mesh.genomeHash = "TAMPERED";
        ASSERT_FALSE(mesh.verifyIntegrity());
    END_TEST("tamper_detection_synth_mesh")

    std::cout << "\n==================================================" << std::endl;
    std::cout << "SYNTHESIZER RESULTS: " << passCount << " passed, " << failCount << " failed" << std::endl;
    std::cout << "==================================================" << std::endl;

    return failCount > 0 ? 1 : 0;
}
