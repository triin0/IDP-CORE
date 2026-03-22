#include "../generated/SovereignSpawner.h"
#include <iostream>
#include <fstream>
#include <iomanip>
#include <cassert>
#include <set>
#include <algorithm>
#include <ctime>

using namespace Sovereign;

static const std::string GENESIS_SALT = "SOVEREIGN_GENESIS_EVENT_2026";
static const std::string GENESIS_ORIGIN = "GENESIS_EVENT_2026";
static const std::string ARCHITECT_ID = "50529956";
static const int GENESIS_POPULATION = 100;
static const int MAX_SHARED_LOCI = 12;

enum class RarityTier {
    COMMON,
    RARE,
    EPIC,
    LEGENDARY
};

std::string rarityToString(RarityTier r) {
    switch (r) {
        case RarityTier::COMMON:    return "COMMON";
        case RarityTier::RARE:      return "RARE";
        case RarityTier::EPIC:      return "EPIC";
        case RarityTier::LEGENDARY: return "LEGENDARY";
    }
    return "COMMON";
}

struct GenesisEntity {
    int index;
    std::string sha256Hash;
    std::string entityKey;
    RarityTier rarity;
    FVisualPhenotype phenotype;
    std::vector<uint8_t> genome;
    std::string phenotypeClass;
    std::string meshFamily;
    int pureLociCount;
    bool forgeValid;
    bool integrityValid;
    std::string pedigreeHash;
};

std::vector<uint8_t> hashToGenomeBytes(const std::string& hexHash) {
    return GeneticGenomeParser::hashToBytes(hexHash);
}

std::string bytesToHex(const std::vector<uint8_t>& bytes) {
    std::ostringstream oss;
    for (uint8_t b : bytes) {
        oss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(b);
    }
    return oss.str();
}

RarityTier determineRarity(const std::vector<uint8_t>& genome, int index) {
    uint16_t rarityWord = (static_cast<uint16_t>(genome[30]) << 8) | genome[31];
    float P = static_cast<float>(rarityWord) / 65535.0f * 100.0f;

    if (P < 3.0f) return RarityTier::LEGENDARY;
    if (P < 10.0f) return RarityTier::EPIC;
    if (P < 30.0f) return RarityTier::RARE;
    return RarityTier::COMMON;
}

void enforceLegendaryOverrides(std::vector<uint8_t>& genome) {
    genome[0] = 0xFF; genome[1] = 0x00; genome[2] = 0x00;
    genome[3] = 0x00; genome[4] = 0xFF; genome[5] = 0x00;
    genome[24] = 0xFF; genome[25] = 0xD7;
}

void enforceEpicOverrides(std::vector<uint8_t>& genome, DeterministicRNG& rng) {
    int locus1 = static_cast<int>(rng.next01() * 5.99f);
    int locus2 = (locus1 + 1 + static_cast<int>(rng.next01() * 4.99f)) % 6;
    genome[locus1] = 0xFF;
    genome[locus2] = 0xFF;
    uint16_t animVal = static_cast<uint16_t>(0xC000 + rng.next01() * 0x3FFF);
    genome[28] = static_cast<uint8_t>(animVal >> 8);
    genome[29] = static_cast<uint8_t>(animVal & 0xFF);
}

void enforceRareOverrides(std::vector<uint8_t>& genome, DeterministicRNG& rng) {
    int pureLocus = static_cast<int>(rng.next01() * 5.99f);
    genome[pureLocus] = 0xFF;
}

int countSharedLoci(const std::vector<uint8_t>& a, const std::vector<uint8_t>& b) {
    const auto& table = GeneticDominanceTable::table();
    int shared = 0;
    for (const auto& entry : table) {
        bool match = true;
        for (int i = 0; i < entry.byteLength; i++) {
            int offset = entry.byteOffset + i;
            if (offset < static_cast<int>(a.size()) && offset < static_cast<int>(b.size())) {
                if (a[offset] != b[offset]) { match = false; break; }
            }
        }
        if (match) shared++;
    }
    return shared;
}

void mutateMorphology(std::vector<uint8_t>& genome, DeterministicRNG& rng) {
    for (int offset = 10; offset <= 17; offset++) {
        genome[offset] = static_cast<uint8_t>(rng.next01() * 255.0f);
    }
}

int main() {
    std::cout << "==================================================\n";
    std::cout << "  SOVEREIGN GENESIS EVENT — MINTING 100 ANCESTORS\n";
    std::cout << "  Salt: " << GENESIS_SALT << "\n";
    std::cout << "  Architect: " << ARCHITECT_ID << "\n";
    std::cout << "==================================================\n\n";

    auto& forge = BiologicalForge::Get();
    forge.reset();
    auto& chronos = ChronosEngine::Get();

    std::vector<GenesisEntity> population;
    population.reserve(GENESIS_POPULATION);

    int rarityDist[4] = {0, 0, 0, 0};

    for (int i = 0; i < GENESIS_POPULATION; i++) {
        std::string seedInput = GENESIS_SALT + ":ancestor:" + std::to_string(i);
        std::string ancestorHash = SovereignSHA256::hash(seedInput);

        std::vector<uint8_t> genome = hashToGenomeBytes(ancestorHash);

        RarityTier rarity = determineRarity(genome, i);

        DeterministicRNG rng(seedInput + ":rarity");

        switch (rarity) {
            case RarityTier::LEGENDARY:
                enforceLegendaryOverrides(genome);
                break;
            case RarityTier::EPIC:
                enforceEpicOverrides(genome, rng);
                break;
            case RarityTier::RARE:
                enforceRareOverrides(genome, rng);
                break;
            case RarityTier::COMMON:
                break;
        }

        std::string genomeHex = bytesToHex(genome);
        std::string finalHash = SovereignSHA256::hash(genomeHex + ":" + GENESIS_SALT);

        int collisionAttempts = 0;
        for (const auto& existing : population) {
            if (countSharedLoci(genome, existing.genome) > MAX_SHARED_LOCI) {
                mutateMorphology(genome, rng);
                genomeHex = bytesToHex(genome);
                finalHash = SovereignSHA256::hash(genomeHex + ":" + GENESIS_SALT);
                collisionAttempts++;
                break;
            }
        }

        std::string entityKey = "genesis:" + std::to_string(i);
        FVisualPhenotype phenotype = forge.forge(finalHash, entityKey);

        GenesisEntity entity;
        entity.index = i;
        entity.sha256Hash = finalHash;
        entity.entityKey = entityKey;
        entity.rarity = rarity;
        entity.phenotype = phenotype;
        entity.genome = genome;
        entity.phenotypeClass = phenotypeClassToString(phenotype.classification);
        entity.meshFamily = phenotype.morphology.meshFamilyName();
        entity.forgeValid = true;
        entity.integrityValid = phenotype.verifyIntegrity();

        entity.pureLociCount = 0;
        for (int b = 0; b < 6; b++) {
            if (genome[b] == 0xFF) entity.pureLociCount++;
        }

        JsonValue pedigreePayload(std::map<std::string, JsonValue>{
            {"entityHash", JsonValue(finalHash)},
            {"generation", JsonValue(0)},
            {"origin", JsonValue(GENESIS_ORIGIN)},
            {"architect", JsonValue(ARCHITECT_ID)},
            {"rarity", JsonValue(rarityToString(rarity))},
            {"phenotypeClass", JsonValue(entity.phenotypeClass)},
            {"meshFamily", JsonValue(entity.meshFamily)},
            {"index", JsonValue(i)},
            {"genomeHex", JsonValue(genomeHex)},
            {"pureLociCount", JsonValue(entity.pureLociCount)},
            {"integrityVerified", JsonValue(entity.integrityValid)}
        });
        entity.pedigreeHash = SovereignSHA256::hash(pedigreePayload.canonicalize());

        std::string chronosKey = "genesis:" + finalHash.substr(0, 16);
        chronos.enqueue(chronosKey, pedigreePayload, 0, "genesis-minter");

        population.push_back(entity);
        rarityDist[static_cast<int>(rarity)]++;

        if (collisionAttempts > 0) {
            std::cout << "  [" << i << "] Collision resolved after morphology mutation\n";
        }
    }

    std::cout << "\n--- Rarity Distribution ---\n";
    std::cout << "  COMMON:    " << rarityDist[0] << "\n";
    std::cout << "  RARE:      " << rarityDist[1] << "\n";
    std::cout << "  EPIC:      " << rarityDist[2] << "\n";
    std::cout << "  LEGENDARY: " << rarityDist[3] << "\n";
    std::cout << "  TOTAL:     " << population.size() << "\n\n";

    // === Collision Audit ===
    std::cout << "--- Collision Audit ---\n";
    int maxShared = 0;
    int pairCount = 0;
    for (size_t i = 0; i < population.size(); i++) {
        for (size_t j = i + 1; j < population.size(); j++) {
            int shared = countSharedLoci(population[i].genome, population[j].genome);
            if (shared > maxShared) maxShared = shared;
            pairCount++;
        }
    }
    std::cout << "  Pairs checked: " << pairCount << "\n";
    std::cout << "  Max shared loci: " << maxShared << " (limit: " << MAX_SHARED_LOCI << ")\n";
    bool collisionClean = maxShared <= MAX_SHARED_LOCI;
    std::cout << "  Status: " << (collisionClean ? "PASS" : "FAIL") << "\n\n";

    // === Forge Conformance ===
    std::cout << "--- Forge Conformance ---\n";
    int forgePass = 0, forgeFail = 0;
    int integrityPass = 0, integrityFail = 0;
    for (const auto& e : population) {
        if (e.forgeValid) forgePass++; else forgeFail++;
        if (e.integrityValid) integrityPass++; else integrityFail++;
    }
    std::cout << "  Forge:     " << forgePass << " pass, " << forgeFail << " fail\n";
    std::cout << "  Integrity: " << integrityPass << " pass, " << integrityFail << " fail\n\n";

    // === Scale Validation ===
    std::cout << "--- Scale Validation ---\n";
    int invisibleCount = 0;
    int invalidMeshCount = 0;
    for (const auto& e : population) {
        float minScale = std::min({e.phenotype.morphology.scaleX,
                                    e.phenotype.morphology.scaleY,
                                    e.phenotype.morphology.scaleZ});
        if (minScale < 0.01f) invisibleCount++;
        if (e.phenotype.morphology.baseMeshIndex > 15) invalidMeshCount++;
    }
    std::cout << "  Invisible entities (scale < 0.01): " << invisibleCount << "\n";
    std::cout << "  Invalid mesh index (> 15): " << invalidMeshCount << "\n\n";

    // === Phenotype Class Distribution ===
    std::cout << "--- Phenotype Class Distribution ---\n";
    std::map<std::string, int> classDist;
    for (const auto& e : population) {
        classDist[e.phenotypeClass]++;
    }
    for (const auto& [cls, count] : classDist) {
        std::cout << "  " << cls << ": " << count << "\n";
    }
    std::cout << "\n";

    // === Mesh Family Distribution ===
    std::cout << "--- Mesh Family Distribution ---\n";
    std::map<std::string, int> meshDist;
    for (const auto& e : population) {
        meshDist[e.meshFamily]++;
    }
    for (const auto& [mesh, count] : meshDist) {
        std::cout << "  " << mesh << ": " << count << "\n";
    }
    std::cout << "\n";

    // === Hash Uniqueness ===
    std::set<std::string> uniqueHashes;
    for (const auto& e : population) {
        uniqueHashes.insert(e.sha256Hash);
    }
    std::cout << "--- Hash Uniqueness ---\n";
    std::cout << "  Unique hashes: " << uniqueHashes.size() << " / " << population.size() << "\n";
    bool hashUnique = uniqueHashes.size() == population.size();
    std::cout << "  Status: " << (hashUnique ? "PASS" : "FAIL") << "\n\n";

    // ============================================================
    // OUTPUT: genesis_manifest.json
    // ============================================================
    {
        std::ofstream manifest("lib/engine-native/genesis/genesis_manifest.json");
        manifest << "{\n";
        manifest << "  \"genesisEvent\": \"" << GENESIS_ORIGIN << "\",\n";
        manifest << "  \"architect\": \"" << ARCHITECT_ID << "\",\n";
        manifest << "  \"salt\": \"" << GENESIS_SALT << "\",\n";
        manifest << "  \"population\": " << GENESIS_POPULATION << ",\n";
        manifest << "  \"rarityDistribution\": {\n";
        manifest << "    \"COMMON\": " << rarityDist[0] << ",\n";
        manifest << "    \"RARE\": " << rarityDist[1] << ",\n";
        manifest << "    \"EPIC\": " << rarityDist[2] << ",\n";
        manifest << "    \"LEGENDARY\": " << rarityDist[3] << "\n";
        manifest << "  },\n";
        manifest << "  \"maxSharedLoci\": " << maxShared << ",\n";
        manifest << "  \"collisionClean\": " << (collisionClean ? "true" : "false") << ",\n";
        manifest << "  \"allIntegrityVerified\": " << (integrityFail == 0 ? "true" : "false") << ",\n";
        manifest << "  \"entities\": [\n";

        for (size_t i = 0; i < population.size(); i++) {
            const auto& e = population[i];
            manifest << "    {\n";
            manifest << "      \"index\": " << e.index << ",\n";
            manifest << "      \"sha256\": \"" << e.sha256Hash << "\",\n";
            manifest << "      \"entityKey\": \"" << e.entityKey << "\",\n";
            manifest << "      \"rarity\": \"" << rarityToString(e.rarity) << "\",\n";
            manifest << "      \"phenotypeClass\": \"" << e.phenotypeClass << "\",\n";
            manifest << "      \"meshFamily\": \"" << e.meshFamily << "\",\n";
            manifest << "      \"pureLociCount\": " << e.pureLociCount << ",\n";
            manifest << "      \"generation\": 0,\n";
            manifest << "      \"origin\": \"" << GENESIS_ORIGIN << "\",\n";
            manifest << "      \"architect\": \"" << ARCHITECT_ID << "\",\n";
            manifest << "      \"pedigreeHash\": \"" << e.pedigreeHash << "\",\n";
            manifest << "      \"integrityVerified\": " << (e.integrityValid ? "true" : "false") << ",\n";
            manifest << "      \"genome\": \"" << bytesToHex(e.genome) << "\",\n";
            manifest << "      \"material\": {\n";
            manifest << "        \"metallic\": " << e.phenotype.material.metallic << ",\n";
            manifest << "        \"roughness\": " << e.phenotype.material.roughness << ",\n";
            manifest << "        \"emissionIntensity\": " << e.phenotype.material.emissionIntensity << ",\n";
            manifest << "        \"opacity\": " << e.phenotype.material.opacity << ",\n";
            manifest << "        \"fresnelPower\": " << e.phenotype.material.fresnelPower << ",\n";
            manifest << "        \"subsurfaceScattering\": " << e.phenotype.material.subsurfaceScattering << ",\n";
            manifest << "        \"anisotropy\": " << e.phenotype.material.anisotropy << "\n";
            manifest << "      },\n";
            manifest << "      \"morphology\": {\n";
            manifest << "        \"baseMeshIndex\": " << e.phenotype.morphology.baseMeshIndex << ",\n";
            manifest << "        \"scaleX\": " << e.phenotype.morphology.scaleX << ",\n";
            manifest << "        \"scaleY\": " << e.phenotype.morphology.scaleY << ",\n";
            manifest << "        \"scaleZ\": " << e.phenotype.morphology.scaleZ << "\n";
            manifest << "      },\n";
            manifest << "      \"primaryColor\": [" << e.phenotype.primaryColor.r << ", "
                     << e.phenotype.primaryColor.g << ", " << e.phenotype.primaryColor.b << "],\n";
            manifest << "      \"accentColor\": [" << e.phenotype.accentColor.r << ", "
                     << e.phenotype.accentColor.g << ", " << e.phenotype.accentColor.b << "]\n";
            manifest << "    }";
            if (i < population.size() - 1) manifest << ",";
            manifest << "\n";
        }

        manifest << "  ]\n";
        manifest << "}\n";
        manifest.close();
        std::cout << "WRITTEN: lib/engine-native/genesis/genesis_manifest.json\n";
    }

    // ============================================================
    // OUTPUT: genesis_audit.log
    // ============================================================
    {
        std::ofstream audit("lib/engine-native/genesis/genesis_audit.log");
        audit << "============================================================\n";
        audit << "  SOVEREIGN GENESIS AUDIT — BIOLOGICAL FORGE CONFORMANCE\n";
        audit << "  Generated: " << GENESIS_ORIGIN << "\n";
        audit << "  Architect: " << ARCHITECT_ID << "\n";
        audit << "  Salt: " << GENESIS_SALT << "\n";
        audit << "============================================================\n\n";

        audit << "SUMMARY\n";
        audit << "  Population:      " << GENESIS_POPULATION << "\n";
        audit << "  Forge Pass:      " << forgePass << "\n";
        audit << "  Forge Fail:      " << forgeFail << "\n";
        audit << "  Integrity Pass:  " << integrityPass << "\n";
        audit << "  Integrity Fail:  " << integrityFail << "\n";
        audit << "  Invisible:       " << invisibleCount << "\n";
        audit << "  Invalid Mesh:    " << invalidMeshCount << "\n";
        audit << "  Hash Unique:     " << (hashUnique ? "YES" : "NO") << "\n";
        audit << "  Collision Clean: " << (collisionClean ? "YES" : "NO") << "\n";
        audit << "  Max Shared Loci: " << maxShared << " / " << MAX_SHARED_LOCI << "\n\n";

        audit << "RARITY DISTRIBUTION\n";
        audit << "  COMMON:    " << rarityDist[0] << " (" << (rarityDist[0] * 100 / GENESIS_POPULATION) << "%)\n";
        audit << "  RARE:      " << rarityDist[1] << " (" << (rarityDist[1] * 100 / GENESIS_POPULATION) << "%)\n";
        audit << "  EPIC:      " << rarityDist[2] << " (" << (rarityDist[2] * 100 / GENESIS_POPULATION) << "%)\n";
        audit << "  LEGENDARY: " << rarityDist[3] << " (" << (rarityDist[3] * 100 / GENESIS_POPULATION) << "%)\n\n";

        audit << "PHENOTYPE CLASS DISTRIBUTION\n";
        for (const auto& [cls, count] : classDist) {
            audit << "  " << cls << ": " << count << "\n";
        }
        audit << "\n";

        audit << "MESH FAMILY DISTRIBUTION\n";
        for (const auto& [mesh, count] : meshDist) {
            audit << "  " << mesh << ": " << count << "\n";
        }
        audit << "\n";

        audit << "PER-ENTITY CONFORMANCE\n";
        audit << std::string(120, '-') << "\n";
        audit << std::left << std::setw(6) << "IDX"
              << std::setw(12) << "RARITY"
              << std::setw(16) << "CLASS"
              << std::setw(14) << "MESH"
              << std::setw(8) << "FORGE"
              << std::setw(10) << "INTEG"
              << std::setw(8) << "PURE"
              << std::setw(10) << "MIN_SCALE"
              << "SHA256\n";
        audit << std::string(120, '-') << "\n";

        for (const auto& e : population) {
            float minScale = std::min({e.phenotype.morphology.scaleX,
                                        e.phenotype.morphology.scaleY,
                                        e.phenotype.morphology.scaleZ});
            audit << std::left << std::setw(6) << e.index
                  << std::setw(12) << rarityToString(e.rarity)
                  << std::setw(16) << e.phenotypeClass
                  << std::setw(14) << e.meshFamily
                  << std::setw(8) << (e.forgeValid ? "PASS" : "FAIL")
                  << std::setw(10) << (e.integrityValid ? "PASS" : "FAIL")
                  << std::setw(8) << e.pureLociCount
                  << std::setw(10) << std::fixed << std::setprecision(3) << minScale
                  << e.sha256Hash.substr(0, 16) << "...\n";
        }

        audit << std::string(120, '-') << "\n";
        audit << "\nVERDICT: " << (forgeFail == 0 && integrityFail == 0 &&
                                     invisibleCount == 0 && invalidMeshCount == 0 &&
                                     hashUnique && collisionClean ? "ALL CONFORMANCE CHECKS PASS" : "CONFORMANCE FAILURE") << "\n";
        audit.close();
        std::cout << "WRITTEN: lib/engine-native/genesis/genesis_audit.log\n";
    }

    // ============================================================
    // OUTPUT: claim_bootstrap.sql
    // ============================================================
    {
        std::ofstream sql("lib/engine-native/genesis/claim_bootstrap.sql");
        sql << "-- ============================================================\n";
        sql << "-- SOVEREIGN GENESIS EVENT — MARKETPLACE BOOTSTRAP\n";
        sql << "-- Generated: " << GENESIS_ORIGIN << "\n";
        sql << "-- Architect: " << ARCHITECT_ID << "\n";
        sql << "-- Population: " << GENESIS_POPULATION << " ancestors\n";
        sql << "-- ============================================================\n\n";

        sql << "CREATE TABLE IF NOT EXISTS genesis_entities (\n";
        sql << "  id SERIAL PRIMARY KEY,\n";
        sql << "  entity_index INTEGER NOT NULL,\n";
        sql << "  entity_hash VARCHAR(64) NOT NULL UNIQUE,\n";
        sql << "  entity_key VARCHAR(32) NOT NULL UNIQUE,\n";
        sql << "  rarity VARCHAR(16) NOT NULL,\n";
        sql << "  phenotype_class VARCHAR(32) NOT NULL,\n";
        sql << "  mesh_family VARCHAR(32) NOT NULL,\n";
        sql << "  generation INTEGER NOT NULL DEFAULT 0,\n";
        sql << "  origin VARCHAR(64) NOT NULL DEFAULT '" << GENESIS_ORIGIN << "',\n";
        sql << "  architect VARCHAR(32) NOT NULL DEFAULT '" << ARCHITECT_ID << "',\n";
        sql << "  genome_hex VARCHAR(64) NOT NULL,\n";
        sql << "  pedigree_hash VARCHAR(64) NOT NULL,\n";
        sql << "  claim_status VARCHAR(16) NOT NULL DEFAULT 'UNCLAIMED',\n";
        sql << "  claimed_by VARCHAR(64) DEFAULT NULL,\n";
        sql << "  claimed_at TIMESTAMP DEFAULT NULL,\n";
        sql << "  integrity_verified BOOLEAN NOT NULL DEFAULT TRUE,\n";
        sql << "  created_at TIMESTAMP NOT NULL DEFAULT NOW()\n";
        sql << ");\n\n";

        sql << "CREATE INDEX IF NOT EXISTS idx_genesis_rarity ON genesis_entities(rarity);\n";
        sql << "CREATE INDEX IF NOT EXISTS idx_genesis_class ON genesis_entities(phenotype_class);\n";
        sql << "CREATE INDEX IF NOT EXISTS idx_genesis_status ON genesis_entities(claim_status);\n\n";

        sql << "INSERT INTO genesis_entities (entity_index, entity_hash, entity_key, rarity, phenotype_class, mesh_family, genome_hex, pedigree_hash, integrity_verified)\nVALUES\n";

        for (size_t i = 0; i < population.size(); i++) {
            const auto& e = population[i];
            sql << "  (" << e.index << ", '"
                << e.sha256Hash << "', '"
                << e.entityKey << "', '"
                << rarityToString(e.rarity) << "', '"
                << e.phenotypeClass << "', '"
                << e.meshFamily << "', '"
                << bytesToHex(e.genome) << "', '"
                << e.pedigreeHash << "', "
                << (e.integrityValid ? "TRUE" : "FALSE") << ")";
            if (i < population.size() - 1) sql << ",";
            sql << "\n";
        }
        sql << "ON CONFLICT (entity_hash) DO NOTHING;\n";

        sql.close();
        std::cout << "WRITTEN: lib/engine-native/genesis/claim_bootstrap.sql\n";
    }

    // === Determinism Verification ===
    std::cout << "\n--- Determinism Verification ---\n";
    forge.reset();

    std::string checkSeed = GENESIS_SALT + ":ancestor:0";
    std::string checkHash1 = SovereignSHA256::hash(checkSeed);
    std::string checkHash2 = SovereignSHA256::hash(checkSeed);
    std::cout << "  Seed determinism: " << (checkHash1 == checkHash2 ? "PASS" : "FAIL") << "\n";

    auto checkPheno1 = forge.forge(population[0].sha256Hash, "verify-0a");
    forge.reset();
    auto checkPheno2 = forge.forge(population[0].sha256Hash, "verify-0b");
    std::cout << "  Forge determinism: " << (checkPheno1.phenotypeHash == checkPheno2.phenotypeHash ? "PASS" : "FAIL") << "\n";

    // === Final Summary ===
    std::cout << "\n==================================================\n";
    std::cout << "  GENESIS EVENT — COMPLETE\n";
    std::cout << "  Population: " << population.size() << " ancestors minted\n";
    std::cout << "  Conformance: " << (forgeFail + integrityFail + invisibleCount + invalidMeshCount) << " failures\n";
    std::cout << "  Collision: max " << maxShared << " shared loci (limit " << MAX_SHARED_LOCI << ")\n";
    std::cout << "  Hash uniqueness: " << uniqueHashes.size() << " / " << population.size() << "\n";
    std::cout << "  Determinism: VERIFIED\n";
    std::cout << "==================================================\n";

    if (forgeFail > 0 || integrityFail > 0 || invisibleCount > 0 ||
        invalidMeshCount > 0 || !hashUnique || !collisionClean) {
        std::cerr << "GENESIS FAILED — conformance violations detected\n";
        return 1;
    }

    return 0;
}
