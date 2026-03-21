#include "../generated/BiologicalForge.h"
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

void testSingleton() {
    std::cout << "\n=== Biological Forge Singleton ===" << std::endl;
    auto& forge1 = Sovereign::BiologicalForge::Get();
    auto& forge2 = Sovereign::BiologicalForge::Get();
    ASSERT(&forge1 == &forge2, "Singleton — same instance");
    forge1.reset();
}

void testGenomeParser() {
    std::cout << "\n=== Genetic Genome Parser ===" << std::endl;

    std::string hash = "a1b2c3d4e5f60718293a4b5c6d7e8f9001122334455667788990aabbccddeeff";
    auto genome = Sovereign::GeneticGenomeParser::hashToBytes(hash);
    ASSERT(genome.size() == 32, "Parser — 32 bytes from 64 hex chars");
    ASSERT(genome[0] == 0xa1, "Parser — byte 0 = 0xa1");
    ASSERT(genome[1] == 0xb2, "Parser — byte 1 = 0xb2");
    ASSERT(genome[31] == 0xff, "Parser — byte 31 = 0xff");

    auto locus = Sovereign::GeneticGenomeParser::extractLocus(genome, "test", 0, 1);
    ASSERT(locus.rawValue == 0xa1, "Locus — raw value 0xa1 = 161");
    ASSERT(locus.normalizedValue > 0.0f && locus.normalizedValue <= 1.0f, "Locus — normalized in [0,1]");
    float expected = 161.0f / 255.0f;
    ASSERT(std::abs(locus.normalizedValue - expected) < 0.001f, "Locus — 161/255 normalized");

    auto twoByteL = Sovereign::GeneticGenomeParser::extractLocus(genome, "twobyte", 0, 2);
    ASSERT(twoByteL.rawValue == 0xa1b2, "Locus — 2-byte raw value");
    float expected2 = static_cast<float>(0xa1b2) / 65535.0f;
    ASSERT(std::abs(twoByteL.normalizedValue - expected2) < 0.001f, "Locus — 2-byte normalized");

    auto color = Sovereign::GeneticGenomeParser::extractColor(genome, 0);
    ASSERT(std::abs(color.R - 0xa1 / 255.0f) < 0.001f, "Color — R from byte 0");
    ASSERT(std::abs(color.G - 0xb2 / 255.0f) < 0.001f, "Color — G from byte 1");
    ASSERT(std::abs(color.B - 0xc3 / 255.0f) < 0.001f, "Color — B from byte 2");
    ASSERT(color.A == 1.0f, "Color — A defaults to 1.0");
}

void testDeterministicForge() {
    std::cout << "\n=== Deterministic Forge ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string hash = Sovereign::SovereignSHA256::hash("lexus-rx300-midnight-blue");

    auto p1 = forge.forge(hash, "vehicle-001");
    auto p2 = forge.forge(hash, "vehicle-001");

    ASSERT(p1.sourceHash == hash, "Forge — source hash preserved");
    ASSERT(p1.phenotypeHash == p2.phenotypeHash, "Forge — deterministic phenotype hash");
    ASSERT(p1.primaryColor == p2.primaryColor, "Forge — deterministic primary color");
    ASSERT(p1.accentColor == p2.accentColor, "Forge — deterministic accent color");
    ASSERT(p1.material.metallic == p2.material.metallic, "Forge — deterministic metallic");
    ASSERT(p1.material.roughness == p2.material.roughness, "Forge — deterministic roughness");
    ASSERT(p1.classification == p2.classification, "Forge — deterministic classification");
    ASSERT(p1.morphology.baseMeshIndex == p2.morphology.baseMeshIndex, "Forge — deterministic mesh index");
    ASSERT(p1.classificationName.size() > 0, "Forge — classification name not empty");

    ASSERT(p1.primaryColor.R >= 0.0f && p1.primaryColor.R <= 1.0f, "Forge — R in [0,1]");
    ASSERT(p1.primaryColor.G >= 0.0f && p1.primaryColor.G <= 1.0f, "Forge — G in [0,1]");
    ASSERT(p1.primaryColor.B >= 0.0f && p1.primaryColor.B <= 1.0f, "Forge — B in [0,1]");

    ASSERT(p1.material.metallic >= 0.0f && p1.material.metallic <= 1.0f, "Forge — metallic in [0,1]");
    ASSERT(p1.material.roughness >= 0.0f && p1.material.roughness <= 1.0f, "Forge — roughness in [0,1]");
    ASSERT(p1.material.opacity >= 0.3f && p1.material.opacity <= 1.0f, "Forge — opacity in [0.3,1.0]");
    ASSERT(p1.material.emissionIntensity >= 0.0f && p1.material.emissionIntensity <= 10.0f, "Forge — emission in [0,10]");
    ASSERT(p1.material.fresnelPower >= 1.0f && p1.material.fresnelPower <= 10.0f, "Forge — fresnel in [1,10]");

    ASSERT(p1.morphology.scaleX >= 0.5f && p1.morphology.scaleX <= 2.5f, "Forge — scaleX in [0.5,2.5]");
    ASSERT(p1.morphology.scaleY >= 0.5f && p1.morphology.scaleY <= 2.5f, "Forge — scaleY in [0.5,2.5]");
    ASSERT(p1.morphology.scaleZ >= 0.5f && p1.morphology.scaleZ <= 2.5f, "Forge — scaleZ in [0.5,2.5]");
    ASSERT(p1.morphology.uvTilingU >= 0.5f && p1.morphology.uvTilingU <= 4.5f, "Forge — uvTilingU in [0.5,4.5]");

    forge.reset();
}

void testDifferentHashesDifferentPhenotypes() {
    std::cout << "\n=== Hash Uniqueness ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string h1 = Sovereign::SovereignSHA256::hash("object-alpha");
    std::string h2 = Sovereign::SovereignSHA256::hash("object-beta");
    std::string h3 = Sovereign::SovereignSHA256::hash("object-gamma");

    auto p1 = forge.forge(h1, "alpha");
    auto p2 = forge.forge(h2, "beta");
    auto p3 = forge.forge(h3, "gamma");

    ASSERT(p1.phenotypeHash != p2.phenotypeHash, "Uniqueness — alpha != beta");
    ASSERT(p2.phenotypeHash != p3.phenotypeHash, "Uniqueness — beta != gamma");
    ASSERT(p1.phenotypeHash != p3.phenotypeHash, "Uniqueness — alpha != gamma");

    ASSERT(p1.primaryColor.toHex() != p2.primaryColor.toHex() ||
           p1.material.metallic != p2.material.metallic, "Uniqueness — visual properties differ");

    forge.reset();
}

void testColorExtraction() {
    std::cout << "\n=== Color Extraction ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string hash = "ff000000ff00" + std::string(52, '0');
    auto p = forge.forge(hash);

    ASSERT(std::abs(p.primaryColor.R - 1.0f) < 0.01f, "Color — primary R = 1.0 (0xFF)");
    ASSERT(std::abs(p.primaryColor.G - 0.0f) < 0.01f, "Color — primary G = 0.0 (0x00)");
    ASSERT(std::abs(p.primaryColor.B - 0.0f) < 0.01f, "Color — primary B = 0.0 (0x00)");
    ASSERT(std::abs(p.accentColor.R - 0.0f) < 0.01f, "Color — accent R = 0.0 (0x00)");
    ASSERT(std::abs(p.accentColor.G - 1.0f) < 0.01f, "Color — accent G = 1.0 (0xFF)");
    ASSERT(std::abs(p.accentColor.B - 0.0f) < 0.01f, "Color — accent B = 0.0 (0x00)");

    std::string hexStr = p.primaryColor.toHex();
    ASSERT(hexStr == "#FF0000", "Color — toHex = #FF0000");

    float lum = p.primaryColor.luminance();
    ASSERT(std::abs(lum - 0.2126f) < 0.01f, "Color — luminance of pure red");

    forge.reset();
}

void testMaterialProfile() {
    std::cout << "\n=== Material Profile ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string hash = "000000000000ff00" + std::string(48, '0');
    auto p = forge.forge(hash);

    ASSERT(p.material.metallic >= 0.0f && p.material.metallic <= 1.0f, "Material — metallic bounded");
    ASSERT(p.material.roughness >= 0.0f && p.material.roughness <= 1.0f, "Material — roughness bounded");
    ASSERT(p.material.specular >= 0.2f && p.material.specular <= 0.8f, "Material — specular bounded [0.2,0.8]");

    std::string canonical = p.material.canonicalize();
    ASSERT(canonical.find("\"metallic\"") != std::string::npos, "Material — canonicalize has metallic");
    ASSERT(canonical.find("\"roughness\"") != std::string::npos, "Material — canonicalize has roughness");
    ASSERT(canonical[0] == '{', "Material — canonicalize starts with {");

    forge.reset();
}

void testMorphologyDescriptor() {
    std::cout << "\n=== Morphology Descriptor ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string hash = Sovereign::SovereignSHA256::hash("test-morphology");
    auto p = forge.forge(hash);

    ASSERT(p.morphology.baseMeshIndex < 16, "Morphology — mesh index < 16");
    std::string family = p.morphology.meshFamilyName();
    ASSERT(family.size() > 0, "Morphology — mesh family name not empty");

    std::set<std::string> validFamilies = {
        "Sphere", "Cube", "Cylinder", "Torus",
        "Cone", "Capsule", "Icosphere", "Prism",
        "Helix", "Mobius", "Klein", "Trefoil",
        "Dodecahedron", "Octahedron", "Tetrahedron", "Geodesic"
    };
    ASSERT(validFamilies.count(family) > 0, "Morphology — valid mesh family");

    ASSERT(p.morphology.animationFrequency >= 0.0f && p.morphology.animationFrequency <= 5.0f,
           "Morphology — animation freq in [0,5]");

    std::string morphCanon = p.morphology.canonicalize();
    ASSERT(morphCanon.find("\"baseMeshIndex\"") != std::string::npos, "Morphology — canonicalize has baseMeshIndex");
    ASSERT(morphCanon.find("\"scaleX\"") != std::string::npos, "Morphology — canonicalize has scaleX");

    forge.reset();
}

void testPhenotypeClassification() {
    std::cout << "\n=== Phenotype Classification ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string metalHash = "000000000000ff00" + std::string(48, '0');
    auto metalP = forge.forge(metalHash);

    std::set<std::string> validClasses = {
        "ORGANIC", "CRYSTALLINE", "METALLIC", "ETHEREAL", "VOLCANIC", "AQUEOUS", "UNKNOWN"
    };
    ASSERT(validClasses.count(metalP.classificationName) > 0, "Classification — valid class name");

    std::set<Sovereign::PhenotypeClass> seenClasses;
    for (int i = 0; i < 100; i++) {
        std::string h = Sovereign::SovereignSHA256::hash("classify-" + std::to_string(i));
        auto p = forge.forge(h);
        seenClasses.insert(p.classification);
    }
    ASSERT(seenClasses.size() >= 2, "Classification — at least 2 different classes from 100 inputs");

    for (auto cls : seenClasses) {
        std::string name = Sovereign::phenotypeClassToString(cls);
        ASSERT(validClasses.count(name) > 0, "Classification — toString valid for " + name);
    }

    forge.reset();
}

void testLODChain() {
    std::cout << "\n=== LOD Chain Generation ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string hash = Sovereign::SovereignSHA256::hash("lod-test-vehicle");
    auto p = forge.forge(hash);

    ASSERT(p.lodChain.size() == 4, "LOD — 4 levels generated");
    ASSERT(p.lodChain[0].lodLevel == 0, "LOD — level 0 first");
    ASSERT(p.lodChain[1].lodLevel == 1, "LOD — level 1 second");
    ASSERT(p.lodChain[2].lodLevel == 2, "LOD — level 2 third");
    ASSERT(p.lodChain[3].lodLevel == 3, "LOD — level 3 fourth");

    ASSERT(p.lodChain[0].triangleReductionFactor == 1.0f, "LOD — LOD0 full triangles");
    ASSERT(p.lodChain[1].triangleReductionFactor == 0.5f, "LOD — LOD1 half triangles");
    ASSERT(p.lodChain[2].triangleReductionFactor == 0.25f, "LOD — LOD2 quarter triangles");
    ASSERT(p.lodChain[3].triangleReductionFactor == 0.1f, "LOD — LOD3 tenth triangles");

    ASSERT(p.lodChain[0].screenSizeThreshold > p.lodChain[1].screenSizeThreshold,
           "LOD — decreasing screen thresholds");
    ASSERT(p.lodChain[1].screenSizeThreshold > p.lodChain[2].screenSizeThreshold,
           "LOD — LOD1 > LOD2 threshold");
    ASSERT(p.lodChain[0].castsShadow == true, "LOD — LOD0 casts shadow");
    ASSERT(p.lodChain[3].castsShadow == false, "LOD — LOD3 no shadow");

    forge.reset();
}

void testPhenotypeIntegrity() {
    std::cout << "\n=== Phenotype Integrity Verification ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string hash = Sovereign::SovereignSHA256::hash("integrity-test-entity");
    auto p = forge.forge(hash);

    ASSERT(!p.phenotypeHash.empty(), "Integrity — phenotype hash computed");
    ASSERT(p.phenotypeHash.size() == 64, "Integrity — hash is 64 hex chars (SHA-256)");
    ASSERT(p.verifyIntegrity(), "Integrity — freshly forged phenotype verifies");

    std::string recomputed = p.computePhenotypeHash();
    ASSERT(p.phenotypeHash == recomputed, "Integrity — hash matches recomputation");

    ASSERT(forge.verifyPhenotype(p), "Integrity — forge.verifyPhenotype() agrees");

    std::string canonical = p.canonicalize();
    ASSERT(canonical.find("\"sourceHash\"") != std::string::npos, "Integrity — canonical has sourceHash");
    ASSERT(canonical.find("\"primaryColor\"") != std::string::npos, "Integrity — canonical has primaryColor");
    ASSERT(canonical.find("\"classification\"") != std::string::npos, "Integrity — canonical has classification");
    ASSERT(canonical.find("\"material\"") != std::string::npos, "Integrity — canonical has material");
    ASSERT(canonical.find("\"morphology\"") != std::string::npos, "Integrity — canonical has morphology");

    forge.reset();
}

void testReproducibility() {
    std::cout << "\n=== Forge Reproducibility ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string hash = Sovereign::SovereignSHA256::hash("reproducibility-test-object");
    ASSERT(forge.verifyForgeReproducibility(hash), "Reproducibility — double-forge same hash");

    for (int i = 0; i < 5; i++) {
        std::string h = Sovereign::SovereignSHA256::hash("repro-" + std::to_string(i));
        ASSERT(forge.verifyForgeReproducibility(h), "Reproducibility — trial " + std::to_string(i));
    }

    forge.reset();
}

void testBatchForge() {
    std::cout << "\n=== Batch Forge ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    int progressCount = 0;
    forge.onBatchProgress([&](int current, int total, const std::string& key) {
        progressCount++;
    });

    std::vector<std::pair<std::string, std::string>> batch;
    for (int i = 0; i < 5; i++) {
        std::string h = Sovereign::SovereignSHA256::hash("batch-item-" + std::to_string(i));
        batch.push_back({h, "entity-" + std::to_string(i)});
    }

    auto results = forge.forgeBatch(batch);

    ASSERT(results.size() == 5, "Batch — 5 results returned");
    ASSERT(progressCount == 5, "Batch — progress delegate fired 5 times");

    std::set<std::string> hashes;
    for (const auto& r : results) {
        hashes.insert(r.phenotypeHash);
        ASSERT(r.verifyIntegrity(), "Batch — item integrity verified");
    }
    ASSERT(hashes.size() == 5, "Batch — all 5 phenotype hashes unique");

    ASSERT(forge.stats().totalBatchesProcessed == 1, "Batch — 1 batch processed");

    forge.reset();
}

void testForgeFromPayload() {
    std::cout << "\n=== Forge from Payload ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    Sovereign::JsonValue payload(std::map<std::string, Sovereign::JsonValue>{
        {"make", Sovereign::JsonValue("Lexus")},
        {"model", Sovereign::JsonValue("RX300")},
        {"year", Sovereign::JsonValue(2024)},
        {"price", Sovereign::JsonValue(52000.0)}
    });

    auto p = forge.forgeFromPayload(payload, "lexus-rx300");
    ASSERT(!p.sourceHash.empty(), "FromPayload — source hash computed from payload");
    ASSERT(p.sourceHash.size() == 64, "FromPayload — SHA-256 from canonical JSON");
    ASSERT(p.verifyIntegrity(), "FromPayload — integrity verified");

    std::string canonical = payload.canonicalize();
    std::string expectedHash = Sovereign::SovereignSHA256::hash(canonical);
    ASSERT(p.sourceHash == expectedHash, "FromPayload — hash matches manual computation");

    auto p2 = forge.forgeFromPayload(payload, "lexus-rx300");
    ASSERT(p.phenotypeHash == p2.phenotypeHash, "FromPayload — deterministic from same payload");

    forge.reset();
}

void testUE5MaterialGeneration() {
    std::cout << "\n=== UE5 Material Instance Generation ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string hash = Sovereign::SovereignSHA256::hash("ue5-material-test");
    auto p = forge.forge(hash, "test-entity");

    std::string ue5Code = forge.generateUE5MaterialInstance(p);

    ASSERT(ue5Code.find("USTRUCT(BlueprintType)") != std::string::npos, "UE5 — has USTRUCT(BlueprintType)");
    ASSERT(ue5Code.find("GENERATED_BODY()") != std::string::npos, "UE5 — has GENERATED_BODY()");
    ASSERT(ue5Code.find("UPROPERTY(EditAnywhere") != std::string::npos, "UE5 — has UPROPERTY");
    ASSERT(ue5Code.find("FLinearColor PrimaryColor") != std::string::npos, "UE5 — has PrimaryColor");
    ASSERT(ue5Code.find("FLinearColor AccentColor") != std::string::npos, "UE5 — has AccentColor");
    ASSERT(ue5Code.find("Metallic") != std::string::npos, "UE5 — has Metallic");
    ASSERT(ue5Code.find("Roughness") != std::string::npos, "UE5 — has Roughness");
    ASSERT(ue5Code.find("EmissionIntensity") != std::string::npos, "UE5 — has EmissionIntensity");
    ASSERT(ue5Code.find("Opacity") != std::string::npos, "UE5 — has Opacity");
    ASSERT(ue5Code.find("SubsurfaceScattering") != std::string::npos, "UE5 — has SubsurfaceScattering");
    ASSERT(ue5Code.find("MeshFamily") != std::string::npos, "UE5 — has MeshFamily");
    ASSERT(ue5Code.find("FVector Scale") != std::string::npos, "UE5 — has Scale vector");
    ASSERT(ue5Code.find("FVector2D UVTiling") != std::string::npos, "UE5 — has UV tiling");
    ASSERT(ue5Code.find("AnimationFrequency") != std::string::npos, "UE5 — has AnimationFrequency");
    ASSERT(ue5Code.find("PhenotypeClass") != std::string::npos, "UE5 — has PhenotypeClass");
    ASSERT(ue5Code.find("FForgedMaterial_") != std::string::npos, "UE5 — struct name includes hash prefix");
    ASSERT(ue5Code.find("DO NOT EDIT") != std::string::npos, "UE5 — auto-generated warning");
    ASSERT(ue5Code.find("Source Hash") != std::string::npos, "UE5 — source hash in comment");
    ASSERT(ue5Code.find("Phenotype Hash") != std::string::npos, "UE5 — phenotype hash in comment");
    ASSERT(ue5Code.find("ClampMin") != std::string::npos, "UE5 — clamp meta on bounded values");

    forge.reset();
}

void testAuditTrail() {
    std::cout << "\n=== Forge Audit Trail ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string h1 = Sovereign::SovereignSHA256::hash("audit-1");
    std::string h2 = Sovereign::SovereignSHA256::hash("audit-2");
    std::string h3 = Sovereign::SovereignSHA256::hash("audit-3");

    forge.forge(h1, "entity-a");
    forge.forge(h2, "entity-b");
    forge.forge(h3, "entity-c");

    const auto& trail = forge.auditTrail();
    ASSERT(trail.size() == 3, "Audit — 3 entries recorded");
    ASSERT(trail[0].entityKey == "entity-a", "Audit — first entity key correct");
    ASSERT(trail[1].entityKey == "entity-b", "Audit — second entity key correct");
    ASSERT(trail[2].entityKey == "entity-c", "Audit — third entity key correct");
    ASSERT(trail[0].inputHash == h1, "Audit — input hash preserved");
    ASSERT(!trail[0].outputPhenotypeHash.empty(), "Audit — output hash recorded");
    ASSERT(trail[0].verified, "Audit — entry 0 verified");
    ASSERT(trail[1].verified, "Audit — entry 1 verified");
    ASSERT(trail[2].verified, "Audit — entry 2 verified");
    ASSERT(trail[0].forgedTimestamp > 0, "Audit — timestamp recorded");

    forge.reset();
}

void testForgeStats() {
    std::cout << "\n=== Forge Statistics ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    ASSERT(forge.stats().totalForged == 0, "Stats — initial totalForged = 0");
    ASSERT(forge.stats().totalVerified == 0, "Stats — initial totalVerified = 0");

    for (int i = 0; i < 10; i++) {
        std::string h = Sovereign::SovereignSHA256::hash("stats-" + std::to_string(i));
        forge.forge(h, "s-" + std::to_string(i));
    }

    ASSERT(forge.stats().totalForged == 10, "Stats — totalForged = 10");
    ASSERT(forge.stats().totalVerified == 10, "Stats — totalVerified = 10");
    ASSERT(forge.stats().totalFailed == 0, "Stats — totalFailed = 0");
    ASSERT(forge.stats().lastForgeTimestamp > 0, "Stats — lastForgeTimestamp set");

    auto& dist = forge.stats().classificationDistribution;
    int total = 0;
    for (const auto& [cls, count] : dist) total += count;
    ASSERT(total == 10, "Stats — classification distribution sums to 10");

    forge.reset();
}

void testCache() {
    std::cout << "\n=== Phenotype Cache ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    ASSERT(forge.cacheSize() == 0, "Cache — empty after reset");

    std::string h1 = Sovereign::SovereignSHA256::hash("cache-test-1");
    forge.forge(h1);
    ASSERT(forge.cacheSize() == 1, "Cache — 1 entry after first forge");

    forge.forge(h1);
    ASSERT(forge.cacheSize() == 1, "Cache — still 1 entry (cache hit)");

    std::string h2 = Sovereign::SovereignSHA256::hash("cache-test-2");
    forge.forge(h2);
    ASSERT(forge.cacheSize() == 2, "Cache — 2 entries after second unique hash");

    forge.clearCache();
    ASSERT(forge.cacheSize() == 0, "Cache — 0 after clearCache()");

    forge.reset();
}

void testForgeDelegate() {
    std::cout << "\n=== Forge Complete Delegate ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    int delegateFired = 0;
    std::string lastEntityKey;
    forge.onForgeComplete([&](const Sovereign::FVisualPhenotype& p, const std::string& key) {
        delegateFired++;
        lastEntityKey = key;
    });

    std::string h1 = Sovereign::SovereignSHA256::hash("delegate-test");
    forge.forge(h1, "my-entity");

    ASSERT(delegateFired == 1, "Delegate — fired on forge");
    ASSERT(lastEntityKey == "my-entity", "Delegate — received correct entity key");

    std::string h2 = Sovereign::SovereignSHA256::hash("delegate-test-2");
    forge.forge(h2, "other-entity");
    ASSERT(delegateFired == 2, "Delegate — fired again for new hash");

    forge.forge(h2, "other-entity");
    ASSERT(delegateFired == 2, "Delegate — NOT fired on cache hit");

    forge.reset();
}

void testCrossLayerIntegrity() {
    std::cout << "\n=== Cross-Layer Integrity (Serializer → Forge) ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    Sovereign::JsonValue payload(std::map<std::string, Sovereign::JsonValue>{
        {"entityId", Sovereign::JsonValue("lexus-rx300-001")},
        {"bidAmount", Sovereign::JsonValue(55000.0)},
        {"stateVersion", Sovereign::JsonValue(7)},
        {"timestamp", Sovereign::JsonValue(1700000000)}
    });

    std::string canonical = payload.canonicalize();
    std::string hash = Sovereign::SovereignSHA256::hash(canonical);
    ASSERT(hash.size() == 64, "CrossLayer — SHA-256 from serializer");

    auto p = forge.forge(hash, "lexus-rx300-001");
    ASSERT(p.sourceHash == hash, "CrossLayer — forge used serializer hash");
    ASSERT(p.verifyIntegrity(), "CrossLayer — phenotype integrity verified");

    std::string reHash = Sovereign::SovereignSHA256::hash(canonical);
    ASSERT(hash == reHash, "CrossLayer — hash deterministic across calls");

    auto p2 = forge.forgeFromPayload(payload, "lexus-rx300-001");
    ASSERT(p.phenotypeHash == p2.phenotypeHash, "CrossLayer — forge() == forgeFromPayload() for same data");

    forge.reset();
}

void testEdgeCases() {
    std::cout << "\n=== Edge Cases ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();
    forge.reset();

    std::string allZeros(64, '0');
    auto pZero = forge.forge(allZeros, "zero-entity");
    ASSERT(pZero.verifyIntegrity(), "Edge — all-zeros hash forges valid phenotype");
    ASSERT(pZero.primaryColor.R == 0.0f, "Edge — all-zeros primary R = 0");
    ASSERT(pZero.primaryColor.G == 0.0f, "Edge — all-zeros primary G = 0");
    ASSERT(pZero.primaryColor.B == 0.0f, "Edge — all-zeros primary B = 0");
    ASSERT(pZero.material.metallic == 0.0f, "Edge — all-zeros metallic = 0");
    ASSERT(pZero.material.opacity >= 0.3f, "Edge — all-zeros opacity >= 0.3 (floor)");

    std::string allFs(64, 'f');
    auto pMax = forge.forge(allFs, "max-entity");
    ASSERT(pMax.verifyIntegrity(), "Edge — all-ff hash forges valid phenotype");
    ASSERT(pMax.primaryColor.R == 1.0f, "Edge — all-ff primary R = 1.0");
    ASSERT(pMax.material.metallic == 1.0f, "Edge — all-ff metallic = 1.0");

    std::string shortHash = "abcdef";
    auto pShort = forge.forge(shortHash, "short-hash");
    ASSERT(pShort.verifyIntegrity(), "Edge — short hash pads to 32 bytes");

    forge.reset();
}

void testResetClearsAll() {
    std::cout << "\n=== Reset Clears Everything ===" << std::endl;
    auto& forge = Sovereign::BiologicalForge::Get();

    forge.forge(Sovereign::SovereignSHA256::hash("pre-reset"), "pre");
    forge.reset();

    ASSERT(forge.cacheSize() == 0, "Reset — cache cleared");
    ASSERT(forge.auditTrail().size() == 0, "Reset — audit trail cleared");
    ASSERT(forge.stats().totalForged == 0, "Reset — stats cleared");
    ASSERT(forge.stats().totalVerified == 0, "Reset — verified cleared");
    ASSERT(forge.stats().classificationDistribution.empty(), "Reset — distribution cleared");

    forge.reset();
}

int main() {
    std::cout << "=== The Biological Forge: Asset Assembler ===" << std::endl;

    testSingleton();
    testGenomeParser();
    testDeterministicForge();
    testDifferentHashesDifferentPhenotypes();
    testColorExtraction();
    testMaterialProfile();
    testMorphologyDescriptor();
    testPhenotypeClassification();
    testLODChain();
    testPhenotypeIntegrity();
    testReproducibility();
    testBatchForge();
    testForgeFromPayload();
    testUE5MaterialGeneration();
    testAuditTrail();
    testForgeStats();
    testCache();
    testForgeDelegate();
    testCrossLayerIntegrity();
    testEdgeCases();
    testResetClearsAll();

    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "FORGE RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;

    return failed > 0 ? 1 : 0;
}
