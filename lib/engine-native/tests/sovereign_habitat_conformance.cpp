#include "../generated/SovereignHabitat.h"
#include <iostream>
#include <cassert>
#include <cmath>
#include <set>
#include <vector>
#include <functional>

using namespace Sovereign;

static int passed = 0;
static int failed = 0;

#define TEST(name) { \
    bool ok = true; \
    try {

#define END_TEST(name) \
    } catch (const std::exception& e) { \
        std::cerr << "EXCEPTION in " << name << ": " << e.what() << "\n"; \
        ok = false; \
    } catch (...) { \
        std::cerr << "UNKNOWN EXCEPTION in " << name << "\n"; \
        ok = false; \
    } \
    if (ok) { passed++; } else { failed++; std::cerr << "FAIL: " << name << "\n"; } \
}

#define ASSERT_TRUE(expr) if (!(expr)) { std::cerr << "  ASSERT_TRUE failed: " #expr " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_FALSE(expr) if (expr) { std::cerr << "  ASSERT_FALSE failed: " #expr " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_EQ(a, b) if ((a) != (b)) { std::cerr << "  ASSERT_EQ failed: " #a " != " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_NEQ(a, b) if ((a) == (b)) { std::cerr << "  ASSERT_NEQ failed: " #a " == " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_GT(a, b) if (!((a) > (b))) { std::cerr << "  ASSERT_GT failed: " #a " <= " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_LT(a, b) if (!((a) < (b))) { std::cerr << "  ASSERT_LT failed: " #a " >= " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_GTE(a, b) if (!((a) >= (b))) { std::cerr << "  ASSERT_GTE failed: " #a " < " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_LTE(a, b) if (!((a) <= (b))) { std::cerr << "  ASSERT_LTE failed: " #a " > " #b " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_NEAR(a, b, eps) if (std::abs((a) - (b)) > (eps)) { std::cerr << "  ASSERT_NEAR failed: " #a "=" << (a) << " vs " #b "=" << (b) << " eps=" << (eps) << " [line " << __LINE__ << "]\n"; ok = false; }
#define ASSERT_FLOAT_EQ(a, b) if (std::abs((a) - (b)) > 1e-5f) { std::cerr << "  ASSERT_FLOAT_EQ failed: " #a "=" << (a) << " vs " #b "=" << (b) << " [line " << __LINE__ << "]\n"; ok = false; }

int main() {
    std::cout << "============================================================\n";
    std::cout << "  SOVEREIGN HABITAT CONFORMANCE TESTS\n";
    std::cout << "============================================================\n\n";

    auto& arbiter = SovereignHabitatArbiter::Get();
    auto& forge = BiologicalForge::Get();

    // ================================================================
    // SECTION 1: BiomeType enum coverage
    // ================================================================
    TEST("biome_volcanic_to_string")
        ASSERT_EQ(biomeTypeToString(BiomeType::VOLCANIC), "VOLCANIC");
    END_TEST("biome_volcanic_to_string")

    TEST("biome_arctic_to_string")
        ASSERT_EQ(biomeTypeToString(BiomeType::ARCTIC), "ARCTIC");
    END_TEST("biome_arctic_to_string")

    TEST("biome_crystalline_to_string")
        ASSERT_EQ(biomeTypeToString(BiomeType::CRYSTALLINE), "CRYSTALLINE");
    END_TEST("biome_crystalline_to_string")

    TEST("biome_abyssal_to_string")
        ASSERT_EQ(biomeTypeToString(BiomeType::ABYSSAL), "ABYSSAL");
    END_TEST("biome_abyssal_to_string")

    TEST("biome_verdant_to_string")
        ASSERT_EQ(biomeTypeToString(BiomeType::VERDANT), "VERDANT");
    END_TEST("biome_verdant_to_string")

    TEST("biome_ethereal_void_to_string")
        ASSERT_EQ(biomeTypeToString(BiomeType::ETHEREAL_VOID), "ETHEREAL_VOID");
    END_TEST("biome_ethereal_void_to_string")

    TEST("biome_unknown_to_string")
        ASSERT_EQ(biomeTypeToString(BiomeType::UNKNOWN), "UNKNOWN");
    END_TEST("biome_unknown_to_string")

    // ================================================================
    // SECTION 2: SynergyGrade enum coverage
    // ================================================================
    TEST("synergy_perfect_to_string")
        ASSERT_EQ(synergyGradeToString(SynergyGrade::PERFECT), "PERFECT");
    END_TEST("synergy_perfect_to_string")

    TEST("synergy_strong_to_string")
        ASSERT_EQ(synergyGradeToString(SynergyGrade::STRONG), "STRONG");
    END_TEST("synergy_strong_to_string")

    TEST("synergy_neutral_to_string")
        ASSERT_EQ(synergyGradeToString(SynergyGrade::NEUTRAL), "NEUTRAL");
    END_TEST("synergy_neutral_to_string")

    TEST("synergy_weak_to_string")
        ASSERT_EQ(synergyGradeToString(SynergyGrade::WEAK), "WEAK");
    END_TEST("synergy_weak_to_string")

    TEST("synergy_hostile_to_string")
        ASSERT_EQ(synergyGradeToString(SynergyGrade::HOSTILE), "HOSTILE");
    END_TEST("synergy_hostile_to_string")

    // ================================================================
    // SECTION 3: FAtmosphericLocus
    // ================================================================
    TEST("atmospheric_default_values")
        FAtmosphericLocus atm;
        ASSERT_NEAR(atm.fogDensity, 0.0f, 0.001f);
        ASSERT_NEAR(atm.lightTemperature, 5500.0f, 0.1f);
        ASSERT_NEAR(atm.skyboxEmission, 0.0f, 0.001f);
        ASSERT_NEAR(atm.ambientIntensity, 0.5f, 0.001f);
    END_TEST("atmospheric_default_values")

    TEST("atmospheric_canonicalize")
        FAtmosphericLocus atm;
        std::string c = atm.canonicalize();
        ASSERT_TRUE(c.find("fogDensity") != std::string::npos);
        ASSERT_TRUE(c.find("lightTemperature") != std::string::npos);
        ASSERT_TRUE(c.find("skyboxEmission") != std::string::npos);
        ASSERT_TRUE(c.find("ambientIntensity") != std::string::npos);
    END_TEST("atmospheric_canonicalize")

    // ================================================================
    // SECTION 4: FThermalLocus
    // ================================================================
    TEST("thermal_default_values")
        FThermalLocus th;
        ASSERT_NEAR(th.globalHeatIndex, 0.5f, 0.001f);
        ASSERT_NEAR(th.surfaceRadiance, 0.0f, 0.001f);
        ASSERT_NEAR(th.convectionRate, 0.0f, 0.001f);
        ASSERT_NEAR(th.thermalConductivity, 0.5f, 0.001f);
    END_TEST("thermal_default_values")

    TEST("thermal_volcanic_detection")
        FThermalLocus th;
        th.globalHeatIndex = 0.80f;
        ASSERT_TRUE(th.isVolcanic());
        ASSERT_FALSE(th.isArctic());
    END_TEST("thermal_volcanic_detection")

    TEST("thermal_arctic_detection")
        FThermalLocus th;
        th.globalHeatIndex = 0.10f;
        ASSERT_TRUE(th.isArctic());
        ASSERT_FALSE(th.isVolcanic());
    END_TEST("thermal_arctic_detection")

    TEST("thermal_neither_extreme")
        FThermalLocus th;
        th.globalHeatIndex = 0.50f;
        ASSERT_FALSE(th.isVolcanic());
        ASSERT_FALSE(th.isArctic());
    END_TEST("thermal_neither_extreme")

    TEST("thermal_canonicalize")
        FThermalLocus th;
        std::string c = th.canonicalize();
        ASSERT_TRUE(c.find("globalHeatIndex") != std::string::npos);
        ASSERT_TRUE(c.find("surfaceRadiance") != std::string::npos);
    END_TEST("thermal_canonicalize")

    // ================================================================
    // SECTION 5: FTopographyLocus
    // ================================================================
    TEST("topography_default_values")
        FTopographyLocus topo;
        ASSERT_NEAR(topo.displacementAmplitude, 0.0f, 0.001f);
        ASSERT_NEAR(topo.gravityMultiplier, 1.0f, 0.001f);
        ASSERT_NEAR(topo.terrainRoughness, 0.5f, 0.001f);
        ASSERT_NEAR(topo.elevationRange, 100.0f, 0.1f);
    END_TEST("topography_default_values")

    TEST("topography_canonicalize")
        FTopographyLocus topo;
        std::string c = topo.canonicalize();
        ASSERT_TRUE(c.find("gravityMultiplier") != std::string::npos);
        ASSERT_TRUE(c.find("displacementAmplitude") != std::string::npos);
        ASSERT_TRUE(c.find("tectonicStress") != std::string::npos);
    END_TEST("topography_canonicalize")

    // ================================================================
    // SECTION 6: FResourceLocus
    // ================================================================
    TEST("resource_default_values")
        FResourceLocus res;
        ASSERT_NEAR(res.nourishmentLevel, 0.5f, 0.001f);
        ASSERT_NEAR(res.oxygenSaturation, 1.0f, 0.001f);
        ASSERT_NEAR(res.toxicity, 0.0f, 0.001f);
    END_TEST("resource_default_values")

    TEST("resource_canonicalize")
        FResourceLocus res;
        std::string c = res.canonicalize();
        ASSERT_TRUE(c.find("nourishmentLevel") != std::string::npos);
        ASSERT_TRUE(c.find("crystallineResonance") != std::string::npos);
        ASSERT_TRUE(c.find("volatileConcentration") != std::string::npos);
    END_TEST("resource_canonicalize")

    // ================================================================
    // SECTION 7: FHabitatState
    // ================================================================
    TEST("habitat_state_default")
        FHabitatState h;
        ASSERT_EQ(h.biome, BiomeType::UNKNOWN);
        ASSERT_EQ(h.epochId, 0);
        ASSERT_TRUE(h.worldSeed.empty());
        ASSERT_TRUE(h.environmentHash.empty());
    END_TEST("habitat_state_default")

    TEST("habitat_state_canonicalize")
        FHabitatState h;
        h.worldSeed = "test_seed";
        h.environmentHash = "abc123";
        h.biomeName = "VOLCANIC";
        std::string c = h.canonicalize();
        ASSERT_TRUE(c.find("test_seed") != std::string::npos);
        ASSERT_TRUE(c.find("abc123") != std::string::npos);
        ASSERT_TRUE(c.find("VOLCANIC") != std::string::npos);
    END_TEST("habitat_state_canonicalize")

    TEST("habitat_state_hash_and_verify")
        FHabitatState h;
        h.worldSeed = "test";
        h.environmentHash = "hash123";
        h.biomeName = "ARCTIC";
        h.updateHash();
        ASSERT_FALSE(h.habitatHash.empty());
        ASSERT_TRUE(h.verifyIntegrity());
    END_TEST("habitat_state_hash_and_verify")

    TEST("habitat_state_tamper_detection")
        FHabitatState h;
        h.worldSeed = "test";
        h.environmentHash = "hash123";
        h.biomeName = "ARCTIC";
        h.updateHash();
        h.biomeName = "VOLCANIC";
        ASSERT_FALSE(h.verifyIntegrity());
    END_TEST("habitat_state_tamper_detection")

    // ================================================================
    // SECTION 8: FSynergyResult
    // ================================================================
    TEST("synergy_result_default")
        FSynergyResult s;
        ASSERT_NEAR(s.coefficient, 0.0f, 0.001f);
        ASSERT_EQ(s.grade, SynergyGrade::NEUTRAL);
        ASSERT_NEAR(s.attackModifier, 1.0f, 0.001f);
        ASSERT_NEAR(s.speedModifier, 1.0f, 0.001f);
    END_TEST("synergy_result_default")

    TEST("synergy_result_hash_and_verify")
        FSynergyResult s;
        s.entityHash = "entity1";
        s.environmentHash = "env1";
        s.gradeName = "NEUTRAL";
        s.updateHash();
        ASSERT_FALSE(s.synergyHash.empty());
        ASSERT_TRUE(s.verifyIntegrity());
    END_TEST("synergy_result_hash_and_verify")

    TEST("synergy_result_tamper_detection")
        FSynergyResult s;
        s.entityHash = "entity1";
        s.environmentHash = "env1";
        s.gradeName = "NEUTRAL";
        s.updateHash();
        s.coefficient = 999.0f;
        ASSERT_FALSE(s.verifyIntegrity());
    END_TEST("synergy_result_tamper_detection")

    // ================================================================
    // SECTION 9: EnvironmentGenomeTable
    // ================================================================
    TEST("env_genome_table_atmospheric_count")
        ASSERT_EQ(EnvironmentGenomeTable::atmospheric().size(), 4u);
    END_TEST("env_genome_table_atmospheric_count")

    TEST("env_genome_table_thermal_count")
        ASSERT_EQ(EnvironmentGenomeTable::thermal().size(), 4u);
    END_TEST("env_genome_table_thermal_count")

    TEST("env_genome_table_topographic_count")
        ASSERT_EQ(EnvironmentGenomeTable::topographic().size(), 8u);
    END_TEST("env_genome_table_topographic_count")

    TEST("env_genome_table_resource_count")
        ASSERT_EQ(EnvironmentGenomeTable::resource().size(), 8u);
    END_TEST("env_genome_table_resource_count")

    TEST("env_genome_table_atmospheric_offsets")
        const auto& a = EnvironmentGenomeTable::atmospheric();
        ASSERT_EQ(a[0].locusName, "fogDensity");
        ASSERT_EQ(a[0].byteOffset, 0);
        ASSERT_EQ(a[3].locusName, "skyboxEmission");
        ASSERT_EQ(a[3].byteOffset, 3);
    END_TEST("env_genome_table_atmospheric_offsets")

    TEST("env_genome_table_thermal_offsets")
        const auto& t = EnvironmentGenomeTable::thermal();
        ASSERT_EQ(t[0].locusName, "globalHeatIndex");
        ASSERT_EQ(t[0].byteOffset, 4);
        ASSERT_EQ(t[3].locusName, "thermalConductivity");
        ASSERT_EQ(t[3].byteOffset, 7);
    END_TEST("env_genome_table_thermal_offsets")

    TEST("env_genome_table_topographic_offsets")
        const auto& t = EnvironmentGenomeTable::topographic();
        ASSERT_EQ(t[0].locusName, "displacementAmp");
        ASSERT_EQ(t[0].byteOffset, 8);
        ASSERT_EQ(t[1].locusName, "gravityHigh");
        ASSERT_EQ(t[1].byteOffset, 9);
    END_TEST("env_genome_table_topographic_offsets")

    TEST("env_genome_table_resource_offsets")
        const auto& r = EnvironmentGenomeTable::resource();
        ASSERT_EQ(r[0].locusName, "nourishmentLevel");
        ASSERT_EQ(r[0].byteOffset, 16);
        ASSERT_EQ(r[6].locusName, "crystallineResonance");
        ASSERT_EQ(r[6].byteOffset, 22);
    END_TEST("env_genome_table_resource_offsets")

    TEST("env_genome_table_no_byte_overlap")
        std::set<int> allBytes;
        for (const auto& e : EnvironmentGenomeTable::atmospheric()) {
            for (int i = 0; i < e.byteLength; i++) allBytes.insert(e.byteOffset + i);
        }
        for (const auto& e : EnvironmentGenomeTable::thermal()) {
            for (int i = 0; i < e.byteLength; i++) {
                ASSERT_TRUE(allBytes.find(e.byteOffset + i) == allBytes.end());
                allBytes.insert(e.byteOffset + i);
            }
        }
        for (const auto& e : EnvironmentGenomeTable::topographic()) {
            for (int i = 0; i < e.byteLength; i++) {
                ASSERT_TRUE(allBytes.find(e.byteOffset + i) == allBytes.end());
                allBytes.insert(e.byteOffset + i);
            }
        }
        for (const auto& e : EnvironmentGenomeTable::resource()) {
            for (int i = 0; i < e.byteLength; i++) {
                ASSERT_TRUE(allBytes.find(e.byteOffset + i) == allBytes.end());
                allBytes.insert(e.byteOffset + i);
            }
        }
        ASSERT_EQ(static_cast<int>(allBytes.size()), EnvironmentGenomeTable::totalMappedBytes());
    END_TEST("env_genome_table_no_byte_overlap")

    // ================================================================
    // SECTION 10: SynergyMatrix
    // ================================================================
    TEST("synergy_matrix_volcanic_in_volcanic")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::VOLCANIC, BiomeType::VOLCANIC);
        ASSERT_NEAR(score, 0.25f, 0.001f);
    END_TEST("synergy_matrix_volcanic_in_volcanic")

    TEST("synergy_matrix_volcanic_in_arctic")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::VOLCANIC, BiomeType::ARCTIC);
        ASSERT_NEAR(score, -0.20f, 0.001f);
    END_TEST("synergy_matrix_volcanic_in_arctic")

    TEST("synergy_matrix_crystalline_in_crystalline")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::CRYSTALLINE, BiomeType::CRYSTALLINE);
        ASSERT_NEAR(score, 0.25f, 0.001f);
    END_TEST("synergy_matrix_crystalline_in_crystalline")

    TEST("synergy_matrix_crystalline_in_volcanic")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::CRYSTALLINE, BiomeType::VOLCANIC);
        ASSERT_NEAR(score, -0.20f, 0.001f);
    END_TEST("synergy_matrix_crystalline_in_volcanic")

    TEST("synergy_matrix_organic_in_verdant")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::ORGANIC, BiomeType::VERDANT);
        ASSERT_NEAR(score, 0.20f, 0.001f);
    END_TEST("synergy_matrix_organic_in_verdant")

    TEST("synergy_matrix_aqueous_in_abyssal")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::AQUEOUS, BiomeType::ABYSSAL);
        ASSERT_NEAR(score, 0.25f, 0.001f);
    END_TEST("synergy_matrix_aqueous_in_abyssal")

    TEST("synergy_matrix_ethereal_in_ethereal")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::ETHEREAL, BiomeType::ETHEREAL_VOID);
        ASSERT_NEAR(score, 0.25f, 0.001f);
    END_TEST("synergy_matrix_ethereal_in_ethereal")

    TEST("synergy_matrix_metallic_in_volcanic")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::METALLIC, BiomeType::VOLCANIC);
        ASSERT_NEAR(score, 0.15f, 0.001f);
    END_TEST("synergy_matrix_metallic_in_volcanic")

    TEST("synergy_matrix_out_of_bounds")
        float score = SynergyMatrix::getAffinityScore(PhenotypeClass::UNKNOWN, BiomeType::VOLCANIC);
        ASSERT_NEAR(score, 0.0f, 0.001f);
    END_TEST("synergy_matrix_out_of_bounds")

    // ================================================================
    // SECTION 11: Habitat Generation
    // ================================================================
    arbiter.reset();

    TEST("generate_habitat_basic")
        auto h = arbiter.generateHabitat("world_alpha", 0);
        ASSERT_FALSE(h.environmentHash.empty());
        ASSERT_FALSE(h.habitatHash.empty());
        ASSERT_EQ(h.worldSeed, "world_alpha");
        ASSERT_EQ(h.epochId, 0);
        ASSERT_NEQ(h.biome, BiomeType::UNKNOWN);
        ASSERT_TRUE(h.verifyIntegrity());
    END_TEST("generate_habitat_basic")

    TEST("generate_habitat_genome_32_bytes")
        auto h = arbiter.generateHabitat("genome_size_test", 1);
        ASSERT_EQ(h.environmentGenome.size(), 32u);
    END_TEST("generate_habitat_genome_32_bytes")

    TEST("generate_habitat_atmosphere_ranges")
        auto h = arbiter.generateHabitat("atm_test", 0);
        ASSERT_GTE(h.atmosphere.fogDensity, 0.0f);
        ASSERT_LTE(h.atmosphere.fogDensity, 1.0f);
        ASSERT_GTE(h.atmosphere.lightTemperature, 2000.0f);
        ASSERT_LTE(h.atmosphere.lightTemperature, 12000.0f);
        ASSERT_GTE(h.atmosphere.skyboxEmission, 0.0f);
        ASSERT_LTE(h.atmosphere.skyboxEmission, 5.0f);
        ASSERT_GTE(h.atmosphere.ambientIntensity, 0.2f);
        ASSERT_LTE(h.atmosphere.ambientIntensity, 1.0f);
    END_TEST("generate_habitat_atmosphere_ranges")

    TEST("generate_habitat_thermal_ranges")
        auto h = arbiter.generateHabitat("therm_test", 0);
        ASSERT_GTE(h.thermal.globalHeatIndex, 0.0f);
        ASSERT_LTE(h.thermal.globalHeatIndex, 1.0f);
        ASSERT_GTE(h.thermal.surfaceRadiance, 0.0f);
        ASSERT_LTE(h.thermal.surfaceRadiance, 10.0f);
        ASSERT_GTE(h.thermal.convectionRate, 0.0f);
        ASSERT_LTE(h.thermal.convectionRate, 1.0f);
    END_TEST("generate_habitat_thermal_ranges")

    TEST("generate_habitat_topography_ranges")
        auto h = arbiter.generateHabitat("topo_test", 0);
        ASSERT_GTE(h.topography.displacementAmplitude, 0.0f);
        ASSERT_LTE(h.topography.displacementAmplitude, 50.0f);
        ASSERT_GTE(h.topography.gravityMultiplier, 0.1f);
        ASSERT_LTE(h.topography.gravityMultiplier, 4.0f);
        ASSERT_GTE(h.topography.terrainRoughness, 0.0f);
        ASSERT_LTE(h.topography.terrainRoughness, 1.0f);
        ASSERT_GTE(h.topography.elevationRange, 0.0f);
        ASSERT_LTE(h.topography.elevationRange, 5000.0f);
    END_TEST("generate_habitat_topography_ranges")

    TEST("generate_habitat_resource_ranges")
        auto h = arbiter.generateHabitat("res_test", 0);
        ASSERT_GTE(h.resources.nourishmentLevel, 0.0f);
        ASSERT_LTE(h.resources.nourishmentLevel, 1.0f);
        ASSERT_GTE(h.resources.mineralDensity, 0.0f);
        ASSERT_LTE(h.resources.mineralDensity, 1.0f);
        ASSERT_GTE(h.resources.oxygenSaturation, 0.5f);
        ASSERT_LTE(h.resources.oxygenSaturation, 1.0f);
        ASSERT_GTE(h.resources.toxicity, 0.0f);
        ASSERT_LTE(h.resources.toxicity, 1.0f);
    END_TEST("generate_habitat_resource_ranges")

    TEST("generate_habitat_biome_assignment")
        auto h = arbiter.generateHabitat("biome_test", 0);
        ASSERT_NEQ(h.biome, BiomeType::UNKNOWN);
        ASSERT_FALSE(h.biomeName.empty());
        ASSERT_EQ(h.biomeName, biomeTypeToString(h.biome));
    END_TEST("generate_habitat_biome_assignment")

    // ================================================================
    // SECTION 12: Determinism
    // ================================================================
    TEST("habitat_determinism_same_seed")
        arbiter.reset();
        auto h1 = arbiter.generateHabitat("determ_test", 42);
        arbiter.reset();
        auto h2 = arbiter.generateHabitat("determ_test", 42);
        ASSERT_EQ(h1.environmentHash, h2.environmentHash);
        ASSERT_EQ(h1.habitatHash, h2.habitatHash);
        ASSERT_EQ(h1.biome, h2.biome);
        ASSERT_NEAR(h1.atmosphere.fogDensity, h2.atmosphere.fogDensity, 0.0001f);
        ASSERT_NEAR(h1.thermal.globalHeatIndex, h2.thermal.globalHeatIndex, 0.0001f);
        ASSERT_NEAR(h1.topography.gravityMultiplier, h2.topography.gravityMultiplier, 0.0001f);
        ASSERT_NEAR(h1.resources.nourishmentLevel, h2.resources.nourishmentLevel, 0.0001f);
    END_TEST("habitat_determinism_same_seed")

    TEST("habitat_determinism_different_seed")
        arbiter.reset();
        auto h1 = arbiter.generateHabitat("seed_A", 0);
        auto h2 = arbiter.generateHabitat("seed_B", 0);
        ASSERT_NEQ(h1.environmentHash, h2.environmentHash);
    END_TEST("habitat_determinism_different_seed")

    TEST("habitat_determinism_different_epoch")
        arbiter.reset();
        auto h1 = arbiter.generateHabitat("epoch_test", 0);
        auto h2 = arbiter.generateHabitat("epoch_test", 1);
        ASSERT_NEQ(h1.environmentHash, h2.environmentHash);
        ASSERT_NEQ(h1.habitatHash, h2.habitatHash);
    END_TEST("habitat_determinism_different_epoch")

    TEST("habitat_verify_determinism_method")
        arbiter.reset();
        ASSERT_TRUE(arbiter.verifyHabitatDeterminism("verify_method_test", 7));
    END_TEST("habitat_verify_determinism_method")

    // ================================================================
    // SECTION 13: Epoch Transitions
    // ================================================================
    TEST("epoch_transition_basic")
        arbiter.reset();
        arbiter.generateHabitat("epoch_world", 0);
        auto h2 = arbiter.transitionEpoch("epoch_world", 1);
        ASSERT_EQ(h2.epochId, 1);
        ASSERT_TRUE(h2.verifyIntegrity());
    END_TEST("epoch_transition_basic")

    TEST("epoch_transition_changes_active")
        arbiter.reset();
        arbiter.generateHabitat("active_test", 0);
        arbiter.transitionEpoch("active_test", 5);
        auto active = arbiter.getActiveHabitat();
        ASSERT_EQ(active.epochId, 5);
    END_TEST("epoch_transition_changes_active")

    TEST("epoch_transition_delegate")
        arbiter.reset();
        int delegateOld = -1, delegateNew = -1;
        arbiter.onEpochTransition([&](int oldE, int newE, const FHabitatState&) {
            delegateOld = oldE;
            delegateNew = newE;
        });
        arbiter.generateHabitat("delegate_epoch", 3);
        arbiter.transitionEpoch("delegate_epoch", 7);
        ASSERT_EQ(delegateOld, 3);
        ASSERT_EQ(delegateNew, 7);
    END_TEST("epoch_transition_delegate")

    // ================================================================
    // SECTION 14: Synergy Calculation
    // ================================================================
    arbiter.reset();
    forge.reset();

    TEST("synergy_basic_calculation")
        auto h = arbiter.generateHabitat("synergy_world", 0);
        std::string hash = SovereignSHA256::hash("test_entity_for_synergy");
        auto phenotype = forge.forge(hash, "synergy_entity");
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_GTE(syn.coefficient, -1.0f);
        ASSERT_LTE(syn.coefficient, 1.0f);
        ASSERT_FALSE(syn.synergyHash.empty());
        ASSERT_TRUE(syn.verifyIntegrity());
    END_TEST("synergy_basic_calculation")

    TEST("synergy_attack_modifier_range")
        auto h = arbiter.generateHabitat("mod_test", 0);
        std::string hash = SovereignSHA256::hash("mod_entity");
        auto phenotype = forge.forge(hash, "mod_entity");
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_GTE(syn.attackModifier, 0.70f);
        ASSERT_LTE(syn.attackModifier, 1.30f);
    END_TEST("synergy_attack_modifier_range")

    TEST("synergy_defense_modifier_range")
        auto h = arbiter.generateHabitat("def_mod_test", 0);
        std::string hash = SovereignSHA256::hash("def_entity");
        auto phenotype = forge.forge(hash, "def_entity");
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_GTE(syn.defenseModifier, 0.80f);
        ASSERT_LTE(syn.defenseModifier, 1.20f);
    END_TEST("synergy_defense_modifier_range")

    TEST("synergy_speed_modifier_range")
        auto h = arbiter.generateHabitat("spd_mod_test", 0);
        std::string hash = SovereignSHA256::hash("spd_entity");
        auto phenotype = forge.forge(hash, "spd_entity");
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_GTE(syn.speedModifier, 0.60f);
        ASSERT_LTE(syn.speedModifier, 1.25f);
    END_TEST("synergy_speed_modifier_range")

    TEST("synergy_accuracy_modifier_range")
        auto h = arbiter.generateHabitat("acc_mod_test", 0);
        std::string hash = SovereignSHA256::hash("acc_entity");
        auto phenotype = forge.forge(hash, "acc_entity");
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_GTE(syn.accuracyModifier, 0.85f);
        ASSERT_LTE(syn.accuracyModifier, 1.15f);
    END_TEST("synergy_accuracy_modifier_range")

    TEST("synergy_evasion_modifier_range")
        auto h = arbiter.generateHabitat("eva_mod_test", 0);
        std::string hash = SovereignSHA256::hash("eva_entity");
        auto phenotype = forge.forge(hash, "eva_entity");
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_GTE(syn.evasionModifier, 0.80f);
        ASSERT_LTE(syn.evasionModifier, 1.20f);
    END_TEST("synergy_evasion_modifier_range")

    TEST("synergy_thermal_stress_range")
        auto h = arbiter.generateHabitat("stress_test", 0);
        std::string hash = SovereignSHA256::hash("stress_entity");
        auto phenotype = forge.forge(hash, "stress_entity");
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_GTE(syn.thermalStress, 0.0f);
        ASSERT_LTE(syn.thermalStress, 1.0f);
    END_TEST("synergy_thermal_stress_range")

    TEST("synergy_determinism")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("syn_determ", 0);
        std::string hash = SovereignSHA256::hash("syn_determ_entity");
        auto phenotype = forge.forge(hash, "syn_det_e");
        auto s1 = arbiter.computeSynergy(phenotype, h);
        auto s2 = arbiter.computeSynergy(phenotype, h);
        ASSERT_EQ(s1.synergyHash, s2.synergyHash);
        ASSERT_NEAR(s1.coefficient, s2.coefficient, 0.0001f);
        ASSERT_EQ(s1.grade, s2.grade);
    END_TEST("synergy_determinism")

    TEST("synergy_verify_determinism_method")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("syn_verify", 0);
        std::string hash = SovereignSHA256::hash("syn_verify_entity");
        auto phenotype = forge.forge(hash, "syn_verify_e");
        ASSERT_TRUE(arbiter.verifySynergyDeterminism(phenotype, h));
    END_TEST("synergy_verify_determinism_method")

    TEST("synergy_grade_assignment")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("grade_test", 0);
        std::string hash = SovereignSHA256::hash("grade_entity");
        auto phenotype = forge.forge(hash, "grade_e");
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_EQ(syn.gradeName, synergyGradeToString(syn.grade));
    END_TEST("synergy_grade_assignment")

    TEST("synergy_delegate_fires")
        arbiter.reset();
        forge.reset();
        bool delegateFired = false;
        std::string delegateEntityKey;
        arbiter.onSynergyCalculated([&](const FSynergyResult& r, const std::string& key) {
            delegateFired = true;
            delegateEntityKey = key;
        });
        auto h = arbiter.generateHabitat("del_syn", 0);
        std::string hash = SovereignSHA256::hash("del_syn_entity");
        auto phenotype = forge.forge(hash, "del_syn_e");
        arbiter.computeSynergy(phenotype, h);
        ASSERT_TRUE(delegateFired);
        ASSERT_EQ(delegateEntityKey, hash);
    END_TEST("synergy_delegate_fires")

    // ================================================================
    // SECTION 15: Apply Synergy to Combat Stats
    // ================================================================
    TEST("apply_synergy_boost")
        FCombatStats base;
        base.attackPower = 50.0f;
        base.defense = 40.0f;
        base.speed = 30.0f;
        base.accuracy = 0.7f;
        base.evasion = 0.5f;

        FSynergyResult syn;
        syn.attackModifier = 1.15f;
        syn.defenseModifier = 1.10f;
        syn.speedModifier = 1.10f;
        syn.accuracyModifier = 1.05f;
        syn.evasionModifier = 1.08f;

        auto modified = arbiter.applySynergy(base, syn);
        ASSERT_NEAR(modified.attackPower, 57.5f, 0.1f);
        ASSERT_NEAR(modified.defense, 44.0f, 0.1f);
        ASSERT_NEAR(modified.speed, 33.0f, 0.1f);
        ASSERT_NEAR(modified.accuracy, 0.735f, 0.01f);
        ASSERT_NEAR(modified.evasion, 0.54f, 0.01f);
    END_TEST("apply_synergy_boost")

    TEST("apply_synergy_penalty")
        FCombatStats base;
        base.attackPower = 50.0f;
        base.defense = 40.0f;
        base.speed = 30.0f;
        base.accuracy = 0.7f;
        base.evasion = 0.5f;

        FSynergyResult syn;
        syn.attackModifier = 0.85f;
        syn.defenseModifier = 0.90f;
        syn.speedModifier = 0.80f;
        syn.accuracyModifier = 0.95f;
        syn.evasionModifier = 0.90f;

        auto modified = arbiter.applySynergy(base, syn);
        ASSERT_NEAR(modified.attackPower, 42.5f, 0.1f);
        ASSERT_NEAR(modified.defense, 36.0f, 0.1f);
        ASSERT_NEAR(modified.speed, 24.0f, 0.1f);
    END_TEST("apply_synergy_penalty")

    TEST("apply_synergy_clamping")
        FCombatStats base;
        base.attackPower = 95.0f;
        base.accuracy = 0.98f;

        FSynergyResult syn;
        syn.attackModifier = 1.30f;
        syn.defenseModifier = 1.0f;
        syn.speedModifier = 1.0f;
        syn.accuracyModifier = 1.15f;
        syn.evasionModifier = 1.0f;

        auto modified = arbiter.applySynergy(base, syn);
        ASSERT_LTE(modified.attackPower, 100.0f);
        ASSERT_LTE(modified.accuracy, 1.0f);
    END_TEST("apply_synergy_clamping")

    // ================================================================
    // SECTION 16: Habitat Caching & Active Habitat
    // ================================================================
    TEST("active_habitat_updates")
        arbiter.reset();
        auto h = arbiter.generateHabitat("active_check", 10);
        auto active = arbiter.getActiveHabitat();
        ASSERT_EQ(active.environmentHash, h.environmentHash);
        ASSERT_EQ(active.epochId, 10);
    END_TEST("active_habitat_updates")

    TEST("cached_habitat_retrieval")
        arbiter.reset();
        auto h = arbiter.generateHabitat("cache_test", 0);
        auto cached = arbiter.getCachedHabitat(h.environmentHash);
        ASSERT_EQ(cached.habitatHash, h.habitatHash);
    END_TEST("cached_habitat_retrieval")

    TEST("cached_habitat_miss")
        arbiter.reset();
        auto cached = arbiter.getCachedHabitat("nonexistent_hash");
        ASSERT_TRUE(cached.environmentHash.empty());
    END_TEST("cached_habitat_miss")

    // ================================================================
    // SECTION 17: UE5 Post-Process Generation
    // ================================================================
    TEST("ue5_post_process_generation")
        arbiter.reset();
        auto h = arbiter.generateHabitat("ue5_test", 0);
        std::string pp = arbiter.generateUE5PostProcess(h);
        ASSERT_TRUE(pp.find("USTRUCT(BlueprintType)") != std::string::npos);
        ASSERT_TRUE(pp.find("FHabitatPostProcessOverride") != std::string::npos);
        ASSERT_TRUE(pp.find("FogDensity") != std::string::npos);
        ASSERT_TRUE(pp.find("LightTemperature") != std::string::npos);
        ASSERT_TRUE(pp.find("GravityMultiplier") != std::string::npos);
        ASSERT_TRUE(pp.find("BiomeName") != std::string::npos);
        ASSERT_TRUE(pp.find("EnvironmentHash") != std::string::npos);
    END_TEST("ue5_post_process_generation")

    // ================================================================
    // SECTION 18: Stats Tracking
    // ================================================================
    TEST("stats_habitat_generated_count")
        arbiter.reset();
        arbiter.generateHabitat("stats_test_1", 0);
        arbiter.generateHabitat("stats_test_2", 0);
        arbiter.generateHabitat("stats_test_3", 0);
        auto s = arbiter.stats();
        ASSERT_EQ(s.totalHabitatsGenerated, 3);
    END_TEST("stats_habitat_generated_count")

    TEST("stats_synergy_calculation_count")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("stats_syn", 0);
        std::string hash = SovereignSHA256::hash("stats_syn_e");
        auto p = forge.forge(hash, "stats_syn_e");
        arbiter.computeSynergy(p, h);
        arbiter.computeSynergy(p, h);
        auto s = arbiter.stats();
        ASSERT_EQ(s.totalSynergyCalculations, 2);
    END_TEST("stats_synergy_calculation_count")

    TEST("stats_epoch_transition_count")
        arbiter.reset();
        arbiter.generateHabitat("stats_epoch", 0);
        arbiter.transitionEpoch("stats_epoch", 1);
        arbiter.transitionEpoch("stats_epoch", 2);
        auto s = arbiter.stats();
        ASSERT_EQ(s.totalEpochTransitions, 2);
    END_TEST("stats_epoch_transition_count")

    TEST("stats_biome_distribution")
        arbiter.reset();
        for (int i = 0; i < 20; i++) {
            arbiter.generateHabitat("biome_dist_" + std::to_string(i), 0);
        }
        auto s = arbiter.stats();
        int total = 0;
        for (const auto& [b, c] : s.biomeDistribution) total += c;
        ASSERT_EQ(total, 20);
    END_TEST("stats_biome_distribution")

    TEST("stats_synergy_grade_distribution")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("grade_dist", 0);
        for (int i = 0; i < 10; i++) {
            std::string hash = SovereignSHA256::hash("grade_dist_" + std::to_string(i));
            auto p = forge.forge(hash, "grade_e_" + std::to_string(i));
            arbiter.computeSynergy(p, h);
        }
        auto s = arbiter.stats();
        int total = 0;
        for (const auto& [g, c] : s.synergyGradeDistribution) total += c;
        ASSERT_EQ(total, 10);
    END_TEST("stats_synergy_grade_distribution")

    // ================================================================
    // SECTION 19: Delegates
    // ================================================================
    TEST("habitat_generated_delegate")
        arbiter.reset();
        bool fired = false;
        std::string delegateHash;
        arbiter.onHabitatGenerated([&](const FHabitatState& h) {
            fired = true;
            delegateHash = h.environmentHash;
        });
        auto h = arbiter.generateHabitat("delegate_test", 0);
        ASSERT_TRUE(fired);
        ASSERT_EQ(delegateHash, h.environmentHash);
    END_TEST("habitat_generated_delegate")

    TEST("epoch_transition_delegate_detailed")
        arbiter.reset();
        int capturedOld = -1;
        int capturedNew = -1;
        std::string capturedBiome;
        arbiter.onEpochTransition([&](int old_, int new_, const FHabitatState& h) {
            capturedOld = old_;
            capturedNew = new_;
            capturedBiome = h.biomeName;
        });
        arbiter.generateHabitat("epoch_del_test", 5);
        arbiter.transitionEpoch("epoch_del_test", 10);
        ASSERT_EQ(capturedOld, 5);
        ASSERT_EQ(capturedNew, 10);
        ASSERT_FALSE(capturedBiome.empty());
    END_TEST("epoch_transition_delegate_detailed")

    // ================================================================
    // SECTION 20: Reset
    // ================================================================
    TEST("reset_clears_state")
        arbiter.reset();
        arbiter.generateHabitat("reset_test", 0);
        arbiter.reset();
        auto active = arbiter.getActiveHabitat();
        ASSERT_TRUE(active.environmentHash.empty());
        auto s = arbiter.stats();
        ASSERT_EQ(s.totalHabitatsGenerated, 0);
    END_TEST("reset_clears_state")

    // ================================================================
    // SECTION 21: Multi-Habitat Diversity
    // ================================================================
    TEST("multi_habitat_unique_hashes")
        arbiter.reset();
        std::set<std::string> hashes;
        for (int i = 0; i < 50; i++) {
            auto h = arbiter.generateHabitat("diversity_" + std::to_string(i), 0);
            hashes.insert(h.environmentHash);
        }
        ASSERT_EQ(hashes.size(), 50u);
    END_TEST("multi_habitat_unique_hashes")

    TEST("multi_habitat_biome_variety")
        arbiter.reset();
        std::set<BiomeType> biomes;
        for (int i = 0; i < 100; i++) {
            auto h = arbiter.generateHabitat("variety_" + std::to_string(i), 0);
            biomes.insert(h.biome);
        }
        ASSERT_GT(static_cast<int>(biomes.size()), 2);
    END_TEST("multi_habitat_biome_variety")

    // ================================================================
    // SECTION 22: Genesis Entity Synergy Integration
    // ================================================================
    TEST("genesis_entity_synergy")
        arbiter.reset();
        forge.reset();
        std::string genesisHash = SovereignSHA256::hash(
            "SOVEREIGN_GENESIS_EVENT_2026:ancestor:0");
        auto phenotype = forge.forge(genesisHash, "genesis:0");
        auto h = arbiter.generateHabitat("genesis_habitat", 0);
        auto syn = arbiter.computeSynergy(phenotype, h);
        ASSERT_TRUE(syn.verifyIntegrity());
        ASSERT_GTE(syn.coefficient, -1.0f);
        ASSERT_LTE(syn.coefficient, 1.0f);
    END_TEST("genesis_entity_synergy")

    TEST("genesis_multiple_entities_varied_synergy")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("genesis_multi", 0);
        std::set<float> coefficients;
        for (int i = 0; i < 10; i++) {
            std::string hash = SovereignSHA256::hash(
                "SOVEREIGN_GENESIS_EVENT_2026:ancestor:" + std::to_string(i));
            auto p = forge.forge(hash, "genesis:" + std::to_string(i));
            auto syn = arbiter.computeSynergy(p, h);
            coefficients.insert(syn.coefficient);
        }
        ASSERT_GT(static_cast<int>(coefficients.size()), 1);
    END_TEST("genesis_multiple_entities_varied_synergy")

    // ================================================================
    // SECTION 23: SHA-256 Golden Hash Cross-Verification
    // ================================================================
    TEST("sha256_habitat_golden_hash_seed_0")
        arbiter.reset();
        auto h1 = arbiter.generateHabitat("golden_test", 0);
        arbiter.reset();
        auto h2 = arbiter.generateHabitat("golden_test", 0);
        ASSERT_EQ(h1.habitatHash, h2.habitatHash);
        ASSERT_FALSE(h1.habitatHash.empty());
        ASSERT_EQ(h1.habitatHash.size(), 64u);
    END_TEST("sha256_habitat_golden_hash_seed_0")

    TEST("sha256_env_hash_is_64_chars")
        arbiter.reset();
        auto h = arbiter.generateHabitat("hash_len_test", 0);
        ASSERT_EQ(h.environmentHash.size(), 64u);
    END_TEST("sha256_env_hash_is_64_chars")

    TEST("sha256_habitat_hash_is_64_chars")
        arbiter.reset();
        auto h = arbiter.generateHabitat("hab_hash_len", 0);
        ASSERT_EQ(h.habitatHash.size(), 64u);
    END_TEST("sha256_habitat_hash_is_64_chars")

    TEST("sha256_synergy_hash_is_64_chars")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("syn_hash_len", 0);
        std::string hash = SovereignSHA256::hash("syn_hash_entity");
        auto p = forge.forge(hash, "syn_hash_e");
        auto syn = arbiter.computeSynergy(p, h);
        ASSERT_EQ(syn.synergyHash.size(), 64u);
    END_TEST("sha256_synergy_hash_is_64_chars")

    // ================================================================
    // SECTION 24: End-to-End Arena Integration
    // ================================================================
    TEST("e2e_arena_with_synergy")
        arbiter.reset();
        forge.reset();

        auto h = arbiter.generateHabitat("arena_world", 0);

        std::string hashA = SovereignSHA256::hash("arena_entity_alpha");
        std::string hashB = SovereignSHA256::hash("arena_entity_beta");
        auto phenoA = forge.forge(hashA, "arena_a");
        auto phenoB = forge.forge(hashB, "arena_b");

        auto synA = arbiter.computeSynergy(phenoA, h);
        auto synB = arbiter.computeSynergy(phenoB, h);

        auto& arena = SovereignArena::Get();
        arena.reset();
        auto statsA = PhenotypeStatMapper::mapToStats(phenoA, "arena_a");
        auto statsB = PhenotypeStatMapper::mapToStats(phenoB, "arena_b");

        auto modA = arbiter.applySynergy(statsA, synA);
        auto modB = arbiter.applySynergy(statsB, synB);

        ASSERT_GT(modA.attackPower, 0.0f);
        ASSERT_GT(modB.attackPower, 0.0f);
        ASSERT_GT(modA.speed, 0.0f);
        ASSERT_GT(modB.speed, 0.0f);

        ASSERT_TRUE(synA.verifyIntegrity());
        ASSERT_TRUE(synB.verifyIntegrity());
        ASSERT_TRUE(h.verifyIntegrity());
    END_TEST("e2e_arena_with_synergy")

    TEST("e2e_synergy_affects_combat_outcome")
        arbiter.reset();
        forge.reset();

        auto h = arbiter.generateHabitat("outcome_world", 0);

        std::string hashA = SovereignSHA256::hash("outcome_entity_1");
        auto phenoA = forge.forge(hashA, "outcome_a");

        auto synA = arbiter.computeSynergy(phenoA, h);

        auto& arena = SovereignArena::Get();
        arena.reset();
        auto baseStats = PhenotypeStatMapper::mapToStats(phenoA, "outcome_a");
        auto modStats = arbiter.applySynergy(baseStats, synA);

        bool statsChanged = (std::abs(modStats.attackPower - baseStats.attackPower) > 0.001f) ||
                           (std::abs(modStats.speed - baseStats.speed) > 0.001f) ||
                           (std::abs(modStats.defense - baseStats.defense) > 0.001f);
        ASSERT_TRUE(statsChanged);
    END_TEST("e2e_synergy_affects_combat_outcome")

    // ================================================================
    // SECTION 25: Byte-Mapping Integrity
    // ================================================================
    TEST("byte_mapping_ambientIntensity_independent_from_skybox")
        arbiter.reset();
        auto h = arbiter.generateHabitat("byte_indep_test", 0);
        std::string epochSeed = std::string("byte_indep_test") + ":epoch:0";
        std::string envHash = SovereignSHA256::hash(epochSeed);
        auto genome = GeneticGenomeParser::hashToBytes(envHash);
        float skybox = static_cast<float>(genome[3]) / 255.0f * 5.0f;
        float ambient = 0.2f + static_cast<float>(genome[24]) / 255.0f * 0.8f;
        ASSERT_FLOAT_EQ(h.atmosphere.skyboxEmission, skybox);
        ASSERT_FLOAT_EQ(h.atmosphere.ambientIntensity, ambient);
        ASSERT_TRUE(true);
    END_TEST("byte_mapping_ambientIntensity_independent_from_skybox")

    TEST("byte_mapping_caveDensity_uses_byte25")
        arbiter.reset();
        auto h = arbiter.generateHabitat("cave_byte25", 0);
        std::string epochSeed = std::string("cave_byte25") + ":epoch:0";
        std::string envHash = SovereignSHA256::hash(epochSeed);
        auto genome = GeneticGenomeParser::hashToBytes(envHash);
        float expected = static_cast<float>(genome[25]) / 255.0f * 0.5f;
        ASSERT_FLOAT_EQ(h.topography.caveDensity, expected);
    END_TEST("byte_mapping_caveDensity_uses_byte25")

    TEST("byte_mapping_waterTableDepth_uses_byte26")
        arbiter.reset();
        auto h = arbiter.generateHabitat("water_byte26", 0);
        std::string epochSeed = std::string("water_byte26") + ":epoch:0";
        std::string envHash = SovereignSHA256::hash(epochSeed);
        auto genome = GeneticGenomeParser::hashToBytes(envHash);
        float expected = static_cast<float>(genome[26]) / 255.0f;
        ASSERT_FLOAT_EQ(h.topography.waterTableDepth, expected);
    END_TEST("byte_mapping_waterTableDepth_uses_byte26")

    TEST("byte_mapping_erosion_tectonic_unique_from_cave_water")
        arbiter.reset();
        auto h = arbiter.generateHabitat("unique_bytes", 0);
        std::string epochSeed = std::string("unique_bytes") + ":epoch:0";
        std::string envHash = SovereignSHA256::hash(epochSeed);
        auto genome = GeneticGenomeParser::hashToBytes(envHash);
        ASSERT_FLOAT_EQ(h.topography.erosionFactor, static_cast<float>(genome[14]) / 255.0f);
        ASSERT_FLOAT_EQ(h.topography.tectonicStress, static_cast<float>(genome[15]) / 255.0f);
        ASSERT_FLOAT_EQ(h.topography.caveDensity, static_cast<float>(genome[25]) / 255.0f * 0.5f);
        ASSERT_FLOAT_EQ(h.topography.waterTableDepth, static_cast<float>(genome[26]) / 255.0f);
    END_TEST("byte_mapping_erosion_tectonic_unique_from_cave_water")

    // ================================================================
    // SECTION 26: Formula Component-Level Validation
    // ================================================================
    TEST("formula_genomicOverlap_weight_0_35")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("fw_overlap", 0);
        std::string eHash = SovereignSHA256::hash("fw_overlap_entity");
        auto p = forge.forge(eHash, "fw_ent");
        auto syn = arbiter.computeSynergy(p, h);
        ASSERT_TRUE(syn.verifyIntegrity());
        ASSERT_GTE(syn.coefficient, -1.0f);
        ASSERT_LTE(syn.coefficient, 1.0f);
    END_TEST("formula_genomicOverlap_weight_0_35")

    TEST("formula_synergy_coefficient_decomposition")
        arbiter.reset();
        forge.reset();
        auto h = arbiter.generateHabitat("decomp_world", 0);
        std::string eHash = SovereignSHA256::hash("decomp_entity");
        auto p = forge.forge(eHash, "decomp_e");
        auto syn = arbiter.computeSynergy(p, h);

        int matchCount = 0;
        auto envGenome = h.environmentGenome;
        auto entGenome = GeneticGenomeParser::hashToBytes(eHash);
        int totalBytes = std::min(static_cast<int>(std::min(envGenome.size(), entGenome.size())), 24);
        for (int i = 0; i < totalBytes; i++) {
            int diff = std::abs(static_cast<int>(envGenome[i]) - static_cast<int>(entGenome[i]));
            if (diff < 32) matchCount++;
        }
        float overlap = static_cast<float>(matchCount) / static_cast<float>(totalBytes) - 0.5f;

        float classAff = SynergyMatrix::getAffinityScore(p.classification, h.biome);

        float entityHeatAff = 0.5f;
        switch (p.classification) {
            case PhenotypeClass::VOLCANIC: entityHeatAff = 0.9f; break;
            case PhenotypeClass::CRYSTALLINE: entityHeatAff = 0.1f; break;
            case PhenotypeClass::METALLIC: entityHeatAff = 0.7f; break;
            case PhenotypeClass::ETHEREAL: entityHeatAff = 0.5f; break;
            case PhenotypeClass::ORGANIC: entityHeatAff = 0.4f; break;
            case PhenotypeClass::AQUEOUS: entityHeatAff = 0.3f; break;
            default: entityHeatAff = 0.5f; break;
        }
        float thermalDelta = std::abs(entityHeatAff - h.thermal.globalHeatIndex);

        float resourceFit = 0.0f;
        resourceFit += h.resources.nourishmentLevel * 0.3f;
        resourceFit += (1.0f - h.resources.toxicity) * 0.2f;
        resourceFit += h.resources.oxygenSaturation * 0.2f;
        switch (p.classification) {
            case PhenotypeClass::CRYSTALLINE: resourceFit += h.resources.crystallineResonance * 0.3f; break;
            case PhenotypeClass::METALLIC: resourceFit += h.resources.mineralDensity * 0.3f; break;
            case PhenotypeClass::ETHEREAL: resourceFit += h.resources.energyFlux / 10.0f * 0.3f; break;
            case PhenotypeClass::VOLCANIC: resourceFit += h.resources.volatileConcentration * 0.3f; break;
            case PhenotypeClass::ORGANIC: resourceFit += h.resources.photonAbundance * 0.3f; break;
            case PhenotypeClass::AQUEOUS:
                resourceFit += (1.0f - h.resources.mineralDensity) * 0.15f + h.resources.oxygenSaturation * 0.15f;
                break;
            default: break;
        }

        float expected = overlap * 0.35f + classAff * 0.30f + (1.0f - thermalDelta) * 0.20f + resourceFit * 0.15f;
        expected = std::max(-1.0f, std::min(1.0f, expected));
        ASSERT_FLOAT_EQ(syn.coefficient, expected);
    END_TEST("formula_synergy_coefficient_decomposition")

    TEST("biome_classifier_no_extra_fallback")
        FHabitatState h;
        h.thermal.globalHeatIndex = 0.6f;
        h.resources.volatileConcentration = 0.3f;
        h.resources.crystallineResonance = 0.1f;
        h.resources.mineralDensity = 0.2f;
        h.resources.oxygenSaturation = 0.7f;
        h.resources.nourishmentLevel = 0.3f;
        h.atmosphere.fogDensity = 0.2f;
        h.atmosphere.skyboxEmission = 1.0f;
        BiomeType b = SovereignHabitatArbiter::classifyBiomePublic(h);
        ASSERT_EQ(static_cast<int>(b), static_cast<int>(BiomeType::VERDANT));
    END_TEST("biome_classifier_no_extra_fallback")

    TEST("atmospheric_table_excludes_thermal_loci")
        const auto& atm = EnvironmentGenomeTable::atmospheric();
        for (const auto& entry : atm) {
            std::string name = entry.locusName;
            ASSERT_TRUE(name != "globalHeatIndex");
            ASSERT_TRUE(name != "surfaceRadiance");
            ASSERT_TRUE(name != "convectionRate");
            ASSERT_TRUE(name != "thermalConductivity");
        }
    END_TEST("atmospheric_table_excludes_thermal_loci")

    TEST("thermal_table_contains_heat_loci")
        const auto& th = EnvironmentGenomeTable::thermal();
        bool hasHeat = false, hasRadiance = false, hasConvection = false, hasConductivity = false;
        for (const auto& entry : th) {
            if (entry.locusName == "globalHeatIndex") hasHeat = true;
            if (entry.locusName == "surfaceRadiance") hasRadiance = true;
            if (entry.locusName == "convectionRate") hasConvection = true;
            if (entry.locusName == "thermalConductivity") hasConductivity = true;
        }
        ASSERT_TRUE(hasHeat);
        ASSERT_TRUE(hasRadiance);
        ASSERT_TRUE(hasConvection);
        ASSERT_TRUE(hasConductivity);
    END_TEST("thermal_table_contains_heat_loci")

    // ================================================================
    // RESULTS
    // ================================================================
    std::cout << "\n==================================================\n";
    std::cout << "HABITAT RESULTS: " << passed << " passed, " << failed << " failed\n";
    std::cout << "==================================================\n";

    return failed > 0 ? 1 : 0;
}
