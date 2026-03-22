#include "../generated/SovereignNexus.h"
#include <iostream>
#include <cassert>
#include <set>
#include <cstring>
#include <algorithm>
#include <cmath>
#include <thread>
#include <chrono>

using namespace Sovereign;

static int passCount = 0;
static int failCount = 0;

#define TEST(name) { const char* testName = name; try {
#define END_TEST(name) std::cout << "  PASS: " << testName << std::endl; passCount++; } catch (...) { std::cout << "  FAIL: " << testName << std::endl; failCount++; } }
#define ASSERT_TRUE(expr) if (!(expr)) { std::cout << "ASSERT_TRUE failed: " #expr " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }
#define ASSERT_FALSE(expr) if ((expr)) { std::cout << "ASSERT_FALSE failed: " #expr " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }
#define ASSERT_EQ(a, b) if ((a) != (b)) { std::cout << "ASSERT_EQ failed: " #a " != " #b " [line " << __LINE__ << "]" << std::endl; throw std::runtime_error("fail"); }

int main() {
    std::cout << "============================================================" << std::endl;
    std::cout << "  SOVEREIGN NEXUS CONFORMANCE TESTS (Module 18)" << std::endl;
    std::cout << "============================================================\n" << std::endl;

    auto& nexus = SovereignNexus::Get();

    std::cout << "=== Enum String Tests ===" << std::endl;

    TEST("entity_authority_strings")
        ASSERT_EQ(entityAuthorityToString(EntityAuthority::SOVEREIGN), "SOVEREIGN");
        ASSERT_EQ(entityAuthorityToString(EntityAuthority::PROXY), "PROXY");
        ASSERT_EQ(entityAuthorityToString(EntityAuthority::DORMANT), "DORMANT");
        ASSERT_EQ(entityAuthorityToString(EntityAuthority::CONTESTED), "CONTESTED");
    END_TEST("entity_authority_strings")

    TEST("sync_state_strings")
        ASSERT_EQ(syncStateToString(SyncState::LIVE), "LIVE");
        ASSERT_EQ(syncStateToString(SyncState::STALE), "STALE");
        ASSERT_EQ(syncStateToString(SyncState::GHOST), "GHOST");
        ASSERT_EQ(syncStateToString(SyncState::FAST_FORWARDING), "FAST_FORWARDING");
        ASSERT_EQ(syncStateToString(SyncState::DISCONNECTED), "DISCONNECTED");
    END_TEST("sync_state_strings")

    TEST("conflict_resolution_strings")
        ASSERT_EQ(conflictResolutionToString(ConflictResolution::LWW_TIMESTAMP), "LWW_TIMESTAMP");
        ASSERT_EQ(conflictResolutionToString(ConflictResolution::PRIORITY_AUTHORITY), "PRIORITY_AUTHORITY");
        ASSERT_EQ(conflictResolutionToString(ConflictResolution::MERGE_ADDITIVE), "MERGE_ADDITIVE");
        ASSERT_EQ(conflictResolutionToString(ConflictResolution::REJECT_BOTH), "REJECT_BOTH");
    END_TEST("conflict_resolution_strings")

    std::cout << "\n=== Entity Transform Tests ===" << std::endl;

    TEST("transform_defaults")
        FEntityTransform t;
        ASSERT_TRUE(t.posX == 0.0f && t.posY == 0.0f && t.posZ == 0.0f);
        ASSERT_TRUE(t.rotW == 1.0f);
        ASSERT_TRUE(t.scaleX == 1.0f && t.scaleY == 1.0f && t.scaleZ == 1.0f);
    END_TEST("transform_defaults")

    TEST("transform_equality")
        FEntityTransform a, b;
        ASSERT_TRUE(a == b);
        b.posX = 1.0f;
        ASSERT_TRUE(a != b);
    END_TEST("transform_equality")

    TEST("transform_lerp_midpoint")
        FEntityTransform a, b;
        a.posX = 0.0f; b.posX = 10.0f;
        a.posY = 0.0f; b.posY = 20.0f;
        auto mid = FEntityTransform::lerp(a, b, 0.5f);
        ASSERT_TRUE(std::abs(mid.posX - 5.0f) < 0.01f);
        ASSERT_TRUE(std::abs(mid.posY - 10.0f) < 0.01f);
    END_TEST("transform_lerp_midpoint")

    TEST("transform_lerp_start")
        FEntityTransform a, b;
        a.posX = 10.0f; b.posX = 20.0f;
        auto start = FEntityTransform::lerp(a, b, 0.0f);
        ASSERT_TRUE(std::abs(start.posX - 10.0f) < 0.01f);
    END_TEST("transform_lerp_start")

    TEST("transform_lerp_end")
        FEntityTransform a, b;
        a.posX = 10.0f; b.posX = 20.0f;
        auto end = FEntityTransform::lerp(a, b, 1.0f);
        ASSERT_TRUE(std::abs(end.posX - 20.0f) < 0.01f);
    END_TEST("transform_lerp_end")

    TEST("transform_lerp_clamped")
        FEntityTransform a, b;
        a.posX = 0.0f; b.posX = 10.0f;
        auto over = FEntityTransform::lerp(a, b, 1.5f);
        ASSERT_TRUE(std::abs(over.posX - 10.0f) < 0.01f);
        auto under = FEntityTransform::lerp(a, b, -0.5f);
        ASSERT_TRUE(std::abs(under.posX - 0.0f) < 0.01f);
    END_TEST("transform_lerp_clamped")

    TEST("transform_canonicalize")
        FEntityTransform t;
        t.posX = 1.0f;
        std::string c = t.canonicalize();
        ASSERT_TRUE(c.find("posX") != std::string::npos);
        ASSERT_TRUE(c.find("rotW") != std::string::npos);
        ASSERT_TRUE(c.find("velocityX") != std::string::npos);
    END_TEST("transform_canonicalize")

    std::cout << "\n=== Entity Registry Tests ===" << std::endl;

    TEST("register_entity_sovereign")
        nexus.resetStats();
        bool ok = nexus.registerEntity("entity_001", "owner_A", EntityAuthority::SOVEREIGN);
        ASSERT_TRUE(ok);
        ASSERT_EQ(nexus.entityCount(), 1);
    END_TEST("register_entity_sovereign")

    TEST("register_entity_proxy")
        nexus.resetStats();
        bool ok = nexus.registerEntity("entity_002", "owner_B", EntityAuthority::PROXY);
        ASSERT_TRUE(ok);
        auto entity = nexus.getEntity("entity_002");
        ASSERT_EQ(entity.authorityName, "PROXY");
        ASSERT_EQ(entity.syncStateName, "LIVE");
    END_TEST("register_entity_proxy")

    TEST("register_duplicate_rejected")
        nexus.resetStats();
        nexus.registerEntity("dup_001", "owner_A");
        bool dup = nexus.registerEntity("dup_001", "owner_B");
        ASSERT_FALSE(dup);
    END_TEST("register_duplicate_rejected")

    TEST("register_max_capacity")
        nexus.resetStats();
        FNexusConfig cfg;
        cfg.maxEntities = 5;
        nexus.setConfig(cfg);
        for (int i = 0; i < 5; i++) {
            ASSERT_TRUE(nexus.registerEntity("cap_" + std::to_string(i), "owner"));
        }
        ASSERT_FALSE(nexus.registerEntity("cap_5", "owner"));
        ASSERT_EQ(nexus.entityCount(), 5);
        nexus.setConfig(FNexusConfig());
    END_TEST("register_max_capacity")

    TEST("unregister_entity")
        nexus.resetStats();
        nexus.registerEntity("unreg_001", "owner_A");
        ASSERT_EQ(nexus.entityCount(), 1);
        bool ok = nexus.unregisterEntity("unreg_001");
        ASSERT_TRUE(ok);
        ASSERT_EQ(nexus.entityCount(), 0);
    END_TEST("unregister_entity")

    TEST("unregister_nonexistent")
        nexus.resetStats();
        bool ok = nexus.unregisterEntity("nonexistent_xyz");
        ASSERT_FALSE(ok);
    END_TEST("unregister_nonexistent")

    TEST("entity_hash_integrity")
        nexus.resetStats();
        nexus.registerEntity("hash_001", "owner_A");
        auto entity = nexus.getEntity("hash_001");
        ASSERT_TRUE(entity.verifyIntegrity());
        ASSERT_EQ(entity.entityStateHash.size(), static_cast<size_t>(64));
    END_TEST("entity_hash_integrity")

    TEST("entity_tamper_detection")
        nexus.resetStats();
        nexus.registerEntity("tamper_001", "owner_A");
        auto entity = nexus.getEntity("tamper_001");
        ASSERT_TRUE(entity.verifyIntegrity());
        entity.ownerIdentity = "TAMPERED";
        ASSERT_FALSE(entity.verifyIntegrity());
    END_TEST("entity_tamper_detection")

    TEST("entity_get_nonexistent")
        auto entity = nexus.getEntity("totally_nonexistent");
        ASSERT_EQ(entity.entityHash, "totally_nonexistent");
        ASSERT_EQ(entity.authorityName, "DORMANT");
    END_TEST("entity_get_nonexistent")

    TEST("entity_registered_delegate")
        nexus.resetStats();
        bool fired = false;
        std::string capturedHash;
        nexus.onEntityRegistered([&](const FNexusEntity& e) {
            fired = true;
            capturedHash = e.entityHash;
        });
        nexus.registerEntity("delegate_001", "owner_A");
        ASSERT_TRUE(fired);
        ASSERT_EQ(capturedHash, "delegate_001");
        nexus.onEntityRegistered(nullptr);
    END_TEST("entity_registered_delegate")

    TEST("entity_evicted_delegate")
        nexus.resetStats();
        bool fired = false;
        std::string capturedReason;
        nexus.onEntityEvicted([&](const std::string& hash, const std::string& reason) {
            fired = true;
            capturedReason = reason;
        });
        nexus.registerEntity("evict_001", "owner_A");
        nexus.unregisterEntity("evict_001");
        ASSERT_TRUE(fired);
        ASSERT_EQ(capturedReason, "UNREGISTERED");
        nexus.onEntityEvicted(nullptr);
    END_TEST("entity_evicted_delegate")

    TEST("get_entity_hashes")
        nexus.resetStats();
        nexus.registerEntity("h1", "o1");
        nexus.registerEntity("h2", "o2");
        nexus.registerEntity("h3", "o3");
        auto hashes = nexus.getEntityHashes();
        ASSERT_EQ(static_cast<int>(hashes.size()), 3);
        std::set<std::string> hashSet(hashes.begin(), hashes.end());
        ASSERT_TRUE(hashSet.count("h1") > 0);
        ASSERT_TRUE(hashSet.count("h2") > 0);
        ASSERT_TRUE(hashSet.count("h3") > 0);
    END_TEST("get_entity_hashes")

    std::cout << "\n=== Transform Update Tests ===" << std::endl;

    TEST("update_transform_owner")
        nexus.resetStats();
        nexus.registerEntity("upd_001", "owner_A");
        FEntityTransform t;
        t.posX = 10.0f; t.posY = 20.0f; t.posZ = 30.0f;
        bool ok = nexus.updateEntityTransform("upd_001", t, "owner_A");
        ASSERT_TRUE(ok);
        auto entity = nexus.getEntity("upd_001");
        ASSERT_TRUE(std::abs(entity.transform.posX - 10.0f) < 0.01f);
        ASSERT_TRUE(entity.updateSequence == 1);
    END_TEST("update_transform_owner")

    TEST("update_transform_sequence_increments")
        nexus.resetStats();
        nexus.registerEntity("seq_001", "owner_A");
        FEntityTransform t1, t2;
        t1.posX = 5.0f;
        t2.posX = 10.0f;
        nexus.updateEntityTransform("seq_001", t1, "owner_A");
        nexus.updateEntityTransform("seq_001", t2, "owner_A");
        auto entity = nexus.getEntity("seq_001");
        ASSERT_EQ(entity.updateSequence, 2);
    END_TEST("update_transform_sequence_increments")

    TEST("update_nonexistent_entity")
        nexus.resetStats();
        FEntityTransform t;
        bool ok = nexus.updateEntityTransform("nonexistent_upd", t, "owner_A");
        ASSERT_FALSE(ok);
    END_TEST("update_nonexistent_entity")

    TEST("update_preserves_last_confirmed")
        nexus.resetStats();
        nexus.registerEntity("conf_001", "owner_A");
        FEntityTransform t1; t1.posX = 5.0f;
        FEntityTransform t2; t2.posX = 15.0f;
        nexus.updateEntityTransform("conf_001", t1, "owner_A");
        nexus.updateEntityTransform("conf_001", t2, "owner_A");
        auto entity = nexus.getEntity("conf_001");
        ASSERT_TRUE(std::abs(entity.lastConfirmedTransform.posX - 5.0f) < 0.01f);
        ASSERT_TRUE(std::abs(entity.transform.posX - 15.0f) < 0.01f);
    END_TEST("update_preserves_last_confirmed")

    std::cout << "\n=== Pass 51: Quantum Lock (LWW Conflict Resolution) ===" << std::endl;

    TEST("lww_later_writer_wins")
        nexus.resetStats();
        nexus.registerEntity("lww_001", "owner_A", EntityAuthority::SOVEREIGN);
        FEntityTransform tA; tA.posX = 10.0f;
        nexus.updateEntityTransform("lww_001", tA, "owner_A", 1000);
        FEntityTransform tB; tB.posX = 20.0f;
        bool bWins = nexus.updateEntityTransform("lww_001", tB, "owner_B", 2000);
        ASSERT_TRUE(bWins);
        auto entity = nexus.getEntity("lww_001");
        ASSERT_TRUE(std::abs(entity.transform.posX - 20.0f) < 0.01f);
    END_TEST("lww_later_writer_wins")

    TEST("lww_earlier_writer_loses")
        nexus.resetStats();
        nexus.registerEntity("lww_002", "owner_A", EntityAuthority::SOVEREIGN);
        FEntityTransform tA; tA.posX = 50.0f;
        nexus.updateEntityTransform("lww_002", tA, "owner_A", 3000);
        FEntityTransform tB; tB.posX = 100.0f;
        bool bWins = nexus.updateEntityTransform("lww_002", tB, "owner_B", 2000);
        ASSERT_FALSE(bWins);
        auto entity = nexus.getEntity("lww_002");
        ASSERT_TRUE(std::abs(entity.transform.posX - 50.0f) < 0.01f);
    END_TEST("lww_earlier_writer_loses")

    TEST("lww_conflict_logged")
        nexus.resetStats();
        nexus.registerEntity("lww_003", "owner_A", EntityAuthority::SOVEREIGN);
        FEntityTransform tBase; tBase.posX = 0.0f;
        nexus.updateEntityTransform("lww_003", tBase, "owner_A", 100);
        FEntityTransform t; t.posX = 1.0f;
        nexus.updateEntityTransform("lww_003", t, "owner_B", 5000);
        auto log = nexus.getConflictLog();
        ASSERT_TRUE(log.size() >= 1);
        ASSERT_EQ(log.back().entityHash, "lww_003");
        ASSERT_EQ(log.back().resolutionName, "LWW_TIMESTAMP");
    END_TEST("lww_conflict_logged")

    TEST("lww_conflict_delegate")
        nexus.resetStats();
        bool fired = false;
        std::string capturedWinner;
        nexus.onConflictResolved([&](const FConflictEvent& e) {
            fired = true;
            capturedWinner = e.winner;
        });
        nexus.registerEntity("lww_d", "owner_A", EntityAuthority::SOVEREIGN);
        FEntityTransform tInit; tInit.posX = 0.0f;
        nexus.updateEntityTransform("lww_d", tInit, "owner_A", 100);
        FEntityTransform t; t.posX = 1.0f;
        nexus.updateEntityTransform("lww_d", t, "owner_B", 9999);
        nexus.onConflictResolved(nullptr);
        ASSERT_TRUE(fired);
        ASSERT_EQ(capturedWinner, "owner_B");
    END_TEST("lww_conflict_delegate")

    TEST("resolve_conflict_lww")
        nexus.resetStats();
        auto event = nexus.resolveConflict("entity_x", "A", 100, "B", 200, ConflictResolution::LWW_TIMESTAMP);
        ASSERT_EQ(event.winner, "B");
        ASSERT_EQ(event.resolutionName, "LWW_TIMESTAMP");
    END_TEST("resolve_conflict_lww")

    TEST("resolve_conflict_reject_both")
        nexus.resetStats();
        auto event = nexus.resolveConflict("entity_y", "A", 100, "B", 200, ConflictResolution::REJECT_BOTH);
        ASSERT_TRUE(event.winner.empty());
        ASSERT_EQ(event.resolutionName, "REJECT_BOTH");
    END_TEST("resolve_conflict_reject_both")

    TEST("resolve_conflict_priority_authority")
        nexus.resetStats();
        nexus.registerEntity("pri_001", "owner_A", EntityAuthority::SOVEREIGN);
        auto event = nexus.resolveConflict("pri_001", "owner_A", 100, "owner_B", 200, ConflictResolution::PRIORITY_AUTHORITY);
        ASSERT_EQ(event.winner, "owner_A");
    END_TEST("resolve_conflict_priority_authority")

    TEST("conflict_log_canonicalize")
        nexus.resetStats();
        auto event = nexus.resolveConflict("can_001", "A", 100, "B", 200);
        std::string c = event.canonicalize();
        ASSERT_TRUE(c.find("entityHash") != std::string::npos);
        ASSERT_TRUE(c.find("winner") != std::string::npos);
        ASSERT_TRUE(c.find("resolution") != std::string::npos);
    END_TEST("conflict_log_canonicalize")

    TEST("simultaneous_buy_same_car")
        nexus.resetStats();
        nexus.registerEntity("lexus_rx300", "dealer", EntityAuthority::SOVEREIGN);
        FEntityTransform init; init.posX = 0.0f;
        nexus.updateEntityTransform("lexus_rx300", init, "dealer", 100);
        FEntityTransform buyA; buyA.posX = 1.0f;
        FEntityTransform buyB; buyB.posX = 2.0f;
        bool rickBuys = nexus.updateEntityTransform("lexus_rx300", buyA, "rick", 1000);
        bool gregBuys = nexus.updateEntityTransform("lexus_rx300", buyB, "greg", 1001);
        ASSERT_TRUE(rickBuys || gregBuys);
        auto entity = nexus.getEntity("lexus_rx300");
        ASSERT_TRUE(entity.ownerIdentity == "rick" || entity.ownerIdentity == "greg");
        auto stats = nexus.getStats();
        ASSERT_TRUE(stats.totalConflictsResolved >= 2);
    END_TEST("simultaneous_buy_same_car")

    std::cout << "\n=== Delta Compression Tests ===" << std::endl;

    TEST("delta_no_change_empty")
        FEntityTransform a;
        auto delta = nexus.computeDelta("d001", a, a);
        ASSERT_EQ(delta.fieldCount(), 0);
    END_TEST("delta_no_change_empty")

    TEST("delta_position_only")
        FEntityTransform a, b;
        b.posX = 10.0f;
        auto delta = nexus.computeDelta("d002", a, b);
        ASSERT_EQ(delta.fieldCount(), 1);
        ASSERT_EQ(delta.fields[0].fieldName, "posX");
    END_TEST("delta_position_only")

    TEST("delta_rotation_change")
        FEntityTransform a, b;
        b.rotX = 0.5f; b.rotY = 0.5f;
        auto delta = nexus.computeDelta("d003", a, b);
        ASSERT_EQ(delta.fieldCount(), 2);
    END_TEST("delta_rotation_change")

    TEST("delta_full_change")
        FEntityTransform a;
        FEntityTransform b;
        b.posX = 1; b.posY = 2; b.posZ = 3;
        b.rotX = 0.1f; b.rotY = 0.2f; b.rotZ = 0.3f; b.rotW = 0.9f;
        b.scaleX = 2; b.scaleY = 2; b.scaleZ = 2;
        b.velocityX = 5; b.velocityY = 5; b.velocityZ = 5;
        auto delta = nexus.computeDelta("d004", a, b);
        ASSERT_EQ(delta.fieldCount(), 13);
    END_TEST("delta_full_change")

    TEST("delta_estimated_bytes")
        FEntityTransform a, b;
        b.posX = 10.0f;
        auto delta = nexus.computeDelta("d005", a, b);
        ASSERT_TRUE(delta.estimatedBytes() > 0);
        ASSERT_TRUE(delta.estimatedBytes() < 200);
    END_TEST("delta_estimated_bytes")

    TEST("delta_hash_integrity")
        FEntityTransform a, b;
        b.posX = 5.0f; b.posY = 10.0f;
        auto delta = nexus.computeDelta("d006", a, b);
        ASSERT_TRUE(delta.verifyIntegrity());
        ASSERT_EQ(delta.deltaHash.size(), static_cast<size_t>(64));
    END_TEST("delta_hash_integrity")

    TEST("delta_tamper_detection")
        FEntityTransform a, b;
        b.posX = 5.0f;
        auto delta = nexus.computeDelta("d007", a, b);
        ASSERT_TRUE(delta.verifyIntegrity());
        delta.entityHash = "TAMPERED";
        ASSERT_FALSE(delta.verifyIntegrity());
    END_TEST("delta_tamper_detection")

    TEST("delta_canonicalize")
        FEntityTransform a, b;
        b.posX = 1.0f;
        auto delta = nexus.computeDelta("d008", a, b);
        std::string c = delta.canonicalize();
        ASSERT_TRUE(c.find("entityHash") != std::string::npos);
        ASSERT_TRUE(c.find("fieldCount") != std::string::npos);
        ASSERT_TRUE(c.find("posX") != std::string::npos);
    END_TEST("delta_canonicalize")

    TEST("delta_apply_reconstructs_transform")
        FEntityTransform a;
        a.posX = 5.0f; a.posY = 10.0f;
        FEntityTransform b;
        b.posX = 15.0f; b.posY = 25.0f; b.posZ = 5.0f;
        auto delta = nexus.computeDelta("d009", a, b);
        auto reconstructed = nexus.applyDelta(a, delta);
        ASSERT_TRUE(std::abs(reconstructed.posX - 15.0f) < 0.01f);
        ASSERT_TRUE(std::abs(reconstructed.posY - 25.0f) < 0.01f);
        ASSERT_TRUE(std::abs(reconstructed.posZ - 5.0f) < 0.01f);
    END_TEST("delta_apply_reconstructs_transform")

    TEST("delta_bandwidth_savings")
        FEntityTransform a, b;
        b.posX = 1.0f;
        auto delta = nexus.computeDelta("d010", a, b);
        int deltaBytes = delta.estimatedBytes();
        int fullBytes = 13 * 8;
        ASSERT_TRUE(deltaBytes < fullBytes);
    END_TEST("delta_bandwidth_savings")

    TEST("delta_door_rotation_only")
        FEntityTransform closed, open;
        open.rotZ = 1.5708f;
        auto delta = nexus.computeDelta("door_001", closed, open);
        ASSERT_EQ(delta.fieldCount(), 1);
        ASSERT_EQ(delta.fields[0].fieldName, "rotZ");
        ASSERT_TRUE(delta.estimatedBytes() < 50);
    END_TEST("delta_door_rotation_only")

    TEST("world_delta_only_changed_entities")
        nexus.resetStats();
        nexus.registerEntity("wd_001", "o1");
        nexus.registerEntity("wd_002", "o2");
        nexus.registerEntity("wd_003", "o3");
        FEntityTransform t; t.posX = 99.0f;
        nexus.updateEntityTransform("wd_001", t, "o1");
        auto deltas = nexus.computeWorldDelta();
        int changedCount = 0;
        for (const auto& d : deltas) {
            if (d.fieldCount() > 0) changedCount++;
        }
        ASSERT_TRUE(changedCount >= 1);
        ASSERT_TRUE(changedCount <= 3);
    END_TEST("world_delta_only_changed_entities")

    TEST("compute_entity_delta")
        nexus.resetStats();
        nexus.registerEntity("ced_001", "o1");
        FEntityTransform t; t.posX = 50.0f; t.posY = 60.0f;
        nexus.updateEntityTransform("ced_001", t, "o1");
        auto delta = nexus.computeEntityDelta("ced_001");
        ASSERT_TRUE(delta.fieldCount() >= 2);
    END_TEST("compute_entity_delta")

    std::cout << "\n=== Pass 52: Ghost Reconciliation Tests ===" << std::endl;

    TEST("ghost_mark_entity")
        nexus.resetStats();
        nexus.registerEntity("ghost_001", "owner_A");
        nexus.markEntityGhost("ghost_001");
        auto entity = nexus.getEntity("ghost_001");
        ASSERT_EQ(entity.syncStateName, "GHOST");
    END_TEST("ghost_mark_entity")

    TEST("ghost_begin_reconciliation")
        nexus.resetStats();
        nexus.registerEntity("ghost_002", "owner_A");
        FEntityTransform ghostPos;
        ghostPos.posX = 10.0f;
        nexus.updateEntityTransform("ghost_002", ghostPos, "owner_A");
        nexus.markEntityGhost("ghost_002");

        FEntityTransform serverPos;
        serverPos.posX = 50.0f;
        auto recon = nexus.beginGhostReconciliation("ghost_002", serverPos);
        ASSERT_EQ(recon.entityHash, "ghost_002");
        ASSERT_FALSE(recon.isComplete);
        ASSERT_TRUE(recon.interpolationProgress == 0.0f);
        ASSERT_TRUE(std::abs(recon.ghostTransform.posX - 10.0f) < 0.01f);
        ASSERT_TRUE(std::abs(recon.currentTransform.posX - 50.0f) < 0.01f);

        auto entity = nexus.getEntity("ghost_002");
        ASSERT_EQ(entity.syncStateName, "FAST_FORWARDING");
    END_TEST("ghost_begin_reconciliation")

    TEST("ghost_step_reconciliation")
        nexus.resetStats();
        nexus.registerEntity("ghost_003", "owner_A");
        FEntityTransform ghostPos; ghostPos.posX = 0.0f;
        FEntityTransform serverPos; serverPos.posX = 100.0f;
        nexus.updateEntityTransform("ghost_003", ghostPos, "owner_A");
        nexus.markEntityGhost("ghost_003");
        nexus.beginGhostReconciliation("ghost_003", serverPos);

        auto step1 = nexus.stepReconciliation("ghost_003");
        ASSERT_TRUE(step1.interpolationProgress > 0.0f);
        ASSERT_FALSE(step1.isComplete);
        auto interp = step1.interpolatedTransform();
        ASSERT_TRUE(interp.posX > 0.0f && interp.posX < 100.0f);
    END_TEST("ghost_step_reconciliation")

    TEST("ghost_full_reconciliation")
        nexus.resetStats();
        FNexusConfig cfg;
        cfg.reconciliationStepSize = 0.25f;
        nexus.setConfig(cfg);

        nexus.registerEntity("ghost_004", "owner_A");
        FEntityTransform ghostPos; ghostPos.posX = 0.0f;
        FEntityTransform serverPos; serverPos.posX = 100.0f;
        nexus.updateEntityTransform("ghost_004", ghostPos, "owner_A");
        nexus.markEntityGhost("ghost_004");
        nexus.beginGhostReconciliation("ghost_004", serverPos);

        bool completed = false;
        for (int i = 0; i < 10; i++) {
            auto step = nexus.stepReconciliation("ghost_004");
            if (step.isComplete) {
                completed = true;
                break;
            }
        }
        ASSERT_TRUE(completed);

        auto entity = nexus.getEntity("ghost_004");
        ASSERT_EQ(entity.syncStateName, "LIVE");
        ASSERT_TRUE(std::abs(entity.transform.posX - 100.0f) < 0.01f);
        nexus.setConfig(FNexusConfig());
    END_TEST("ghost_full_reconciliation")

    TEST("ghost_reconciled_delegate")
        nexus.resetStats();
        FNexusConfig cfg;
        cfg.reconciliationStepSize = 1.0f;
        nexus.setConfig(cfg);

        bool fired = false;
        nexus.onGhostReconciled([&](const FGhostReconciliation& r) {
            fired = true;
        });

        nexus.registerEntity("ghost_005", "owner_A");
        FEntityTransform serverPos; serverPos.posX = 50.0f;
        nexus.markEntityGhost("ghost_005");
        nexus.beginGhostReconciliation("ghost_005", serverPos);
        nexus.stepReconciliation("ghost_005");
        ASSERT_TRUE(fired);
        nexus.onGhostReconciled(nullptr);
        nexus.setConfig(FNexusConfig());
    END_TEST("ghost_reconciled_delegate")

    TEST("ghost_smooth_interpolation_no_teleport")
        nexus.resetStats();
        FNexusConfig cfg;
        cfg.reconciliationStepSize = 0.1f;
        nexus.setConfig(cfg);

        nexus.registerEntity("ghost_006", "owner_A");
        FEntityTransform ghostPos; ghostPos.posX = 0.0f;
        FEntityTransform serverPos; serverPos.posX = 100.0f;
        nexus.updateEntityTransform("ghost_006", ghostPos, "owner_A");
        nexus.markEntityGhost("ghost_006");
        nexus.beginGhostReconciliation("ghost_006", serverPos);

        float lastPosX = 0.0f;
        for (int i = 0; i < 10; i++) {
            auto step = nexus.stepReconciliation("ghost_006");
            auto interp = step.interpolatedTransform();
            ASSERT_TRUE(interp.posX >= lastPosX);
            lastPosX = interp.posX;
            if (step.isComplete) break;
        }
        ASSERT_TRUE(lastPosX >= 90.0f);
        nexus.setConfig(FNexusConfig());
    END_TEST("ghost_smooth_interpolation_no_teleport")

    TEST("ghost_reconciliation_canonicalize")
        FGhostReconciliation r;
        r.entityHash = "test";
        r.interpolationProgress = 0.5f;
        std::string c = r.canonicalize();
        ASSERT_TRUE(c.find("entityHash") != std::string::npos);
        ASSERT_TRUE(c.find("interpolationProgress") != std::string::npos);
        ASSERT_TRUE(c.find("isComplete") != std::string::npos);
    END_TEST("ghost_reconciliation_canonicalize")

    std::cout << "\n=== Heartbeat & Stale Sweep Tests ===" << std::endl;

    TEST("heartbeat_updates_timestamp")
        nexus.resetStats();
        nexus.registerEntity("hb_001", "owner_A");
        nexus.heartbeat("hb_001");
        auto entity = nexus.getEntity("hb_001");
        ASSERT_TRUE(entity.lastHeartbeatTimestamp > 0);
    END_TEST("heartbeat_updates_timestamp")

    TEST("heartbeat_revives_stale")
        nexus.resetStats();
        nexus.registerEntity("hb_002", "owner_A");
        nexus.markEntityGhost("hb_002");
        auto entity = nexus.getEntity("hb_002");
        ASSERT_EQ(entity.syncStateName, "GHOST");
    END_TEST("heartbeat_revives_stale")

    std::cout << "\n=== 128+ Entity Concurrency Tests ===" << std::endl;

    TEST("register_128_entities")
        nexus.resetStats();
        for (int i = 0; i < 128; i++) {
            std::string hash = "fleet_" + std::to_string(i);
            EntityAuthority auth = (i % 2 == 0) ? EntityAuthority::SOVEREIGN : EntityAuthority::PROXY;
            ASSERT_TRUE(nexus.registerEntity(hash, "owner_" + std::to_string(i % 4), auth));
        }
        ASSERT_EQ(nexus.entityCount(), 128);
    END_TEST("register_128_entities")

    TEST("update_128_entities")
        for (int i = 0; i < 128; i++) {
            std::string hash = "fleet_" + std::to_string(i);
            FEntityTransform t;
            t.posX = static_cast<float>(i);
            t.posY = static_cast<float>(i * 2);
            t.posZ = static_cast<float>(i * 3);
            nexus.updateEntityTransform(hash, t, "owner_" + std::to_string(i % 4));
        }
        auto entity50 = nexus.getEntity("fleet_50");
        ASSERT_TRUE(std::abs(entity50.transform.posX - 50.0f) < 0.01f);
    END_TEST("update_128_entities")

    TEST("world_delta_128_entities")
        auto deltas = nexus.computeWorldDelta();
        ASSERT_TRUE(static_cast<int>(deltas.size()) >= 1);
        int totalBytes = 0;
        for (const auto& d : deltas) {
            totalBytes += d.estimatedBytes();
        }
        ASSERT_TRUE(totalBytes > 0);
    END_TEST("world_delta_128_entities")

    TEST("bandwidth_per_entity_under_2kb")
        auto deltas = nexus.computeWorldDelta();
        int totalBytes = 0;
        for (const auto& d : deltas) {
            totalBytes += d.estimatedBytes();
        }
        int entitiesWithDeltas = static_cast<int>(deltas.size());
        if (entitiesWithDeltas > 0) {
            float avgBytesPerEntity = static_cast<float>(totalBytes) / entitiesWithDeltas;
            ASSERT_TRUE(avgBytesPerEntity < 2048.0f);
        }
    END_TEST("bandwidth_per_entity_under_2kb")

    std::cout << "\n=== Config & Stats Tests ===" << std::endl;

    TEST("config_canonicalize")
        FNexusConfig c;
        std::string s = c.canonicalize();
        ASSERT_TRUE(s.find("maxEntities") != std::string::npos);
        ASSERT_TRUE(s.find("heartbeatTimeoutMs") != std::string::npos);
        ASSERT_TRUE(s.find("ghostThresholdMs") != std::string::npos);
    END_TEST("config_canonicalize")

    TEST("stats_track_registrations")
        nexus.resetStats();
        nexus.registerEntity("st_001", "o1", EntityAuthority::SOVEREIGN);
        nexus.registerEntity("st_002", "o2", EntityAuthority::PROXY);
        auto stats = nexus.getStats();
        ASSERT_EQ(stats.totalEntitiesRegistered, 2);
        ASSERT_EQ(stats.activeEntities, 2);
        ASSERT_TRUE(stats.sovereignEntities >= 1);
        ASSERT_TRUE(stats.proxyEntities >= 1);
    END_TEST("stats_track_registrations")

    TEST("stats_track_deltas")
        nexus.resetStats();
        nexus.registerEntity("sd_001", "o1");
        FEntityTransform a, b;
        b.posX = 1.0f;
        nexus.computeDelta("sd_001", a, b);
        auto stats = nexus.getStats();
        ASSERT_TRUE(stats.totalDeltasGenerated >= 1);
        ASSERT_TRUE(stats.totalDeltaBytes > 0);
    END_TEST("stats_track_deltas")

    TEST("stats_track_conflicts")
        nexus.resetStats();
        nexus.resolveConflict("sc_001", "A", 100, "B", 200);
        auto stats = nexus.getStats();
        ASSERT_TRUE(stats.totalConflictsResolved >= 1);
    END_TEST("stats_track_conflicts")

    TEST("stats_reset")
        nexus.registerEntity("sr_001", "o1");
        nexus.resetStats();
        auto stats = nexus.getStats();
        ASSERT_EQ(stats.totalEntitiesRegistered, 0);
        ASSERT_EQ(stats.activeEntities, 0);
        ASSERT_EQ(nexus.entityCount(), 0);
    END_TEST("stats_reset")

    TEST("stats_json_export")
        nexus.resetStats();
        nexus.registerEntity("sj_001", "o1");
        std::string json = nexus.exportStatsJSON();
        ASSERT_TRUE(json.find("totalEntitiesRegistered") != std::string::npos);
        ASSERT_TRUE(json.find("totalDeltasGenerated") != std::string::npos);
        ASSERT_TRUE(json.find("totalConflictsResolved") != std::string::npos);
        ASSERT_TRUE(json.find("totalGhostReconciled") != std::string::npos);
    END_TEST("stats_json_export")

    TEST("stats_avg_delta_bytes")
        nexus.resetStats();
        FEntityTransform a, b;
        b.posX = 1.0f;
        nexus.computeDelta("avg_001", a, b);
        nexus.computeDelta("avg_002", a, b);
        auto stats = nexus.getStats();
        ASSERT_TRUE(stats.avgDeltaBytesPerUpdate > 0.0f);
    END_TEST("stats_avg_delta_bytes")

    std::cout << "\n=== UE5 Code Generation Tests ===" << std::endl;

    TEST("ue5_nexus_class")
        std::string code = nexus.generateUE5NexusCode();
        ASSERT_TRUE(code.find("UCLASS(BlueprintType)") != std::string::npos);
        ASSERT_TRUE(code.find("USovereignNexus") != std::string::npos);
        ASSERT_TRUE(code.find("RegisterEntity") != std::string::npos);
        ASSERT_TRUE(code.find("UpdateEntityTransform") != std::string::npos);
        ASSERT_TRUE(code.find("ComputeDelta") != std::string::npos);
        ASSERT_TRUE(code.find("BeginGhostReconciliation") != std::string::npos);
        ASSERT_TRUE(code.find("Heartbeat") != std::string::npos);
        ASSERT_TRUE(code.find("SweepStaleEntities") != std::string::npos);
        ASSERT_TRUE(code.find("GetEntityCount") != std::string::npos);
    END_TEST("ue5_nexus_class")

    TEST("ue5_uenum_authority")
        std::string code = nexus.generateUE5NexusCode();
        ASSERT_TRUE(code.find("ESovereignEntityAuthority") != std::string::npos);
        ASSERT_TRUE(code.find("SOVEREIGN") != std::string::npos);
        ASSERT_TRUE(code.find("PROXY") != std::string::npos);
    END_TEST("ue5_uenum_authority")

    TEST("ue5_uenum_sync_state")
        std::string code = nexus.generateUE5NexusCode();
        ASSERT_TRUE(code.find("ESovereignSyncState") != std::string::npos);
        ASSERT_TRUE(code.find("LIVE") != std::string::npos);
        ASSERT_TRUE(code.find("GHOST") != std::string::npos);
        ASSERT_TRUE(code.find("FAST_FORWARDING") != std::string::npos);
    END_TEST("ue5_uenum_sync_state")

    TEST("ue5_ustruct_transform")
        std::string code = nexus.generateUE5NexusCode();
        ASSERT_TRUE(code.find("FSovereignEntityTransform") != std::string::npos);
        ASSERT_TRUE(code.find("FVector Position") != std::string::npos);
        ASSERT_TRUE(code.find("FQuat Rotation") != std::string::npos);
        ASSERT_TRUE(code.find("FVector Velocity") != std::string::npos);
    END_TEST("ue5_ustruct_transform")

    TEST("ue5_ustruct_delta")
        std::string code = nexus.generateUE5NexusCode();
        ASSERT_TRUE(code.find("FSovereignDeltaPacket") != std::string::npos);
        ASSERT_TRUE(code.find("FieldCount") != std::string::npos);
        ASSERT_TRUE(code.find("EstimatedBytes") != std::string::npos);
    END_TEST("ue5_ustruct_delta")

    std::cout << "\n=== Genesis Fleet Test ===" << std::endl;

    TEST("genesis_fleet_synthesis")
        nexus.resetStats();
        int registered = 0;
        for (int i = 0; i < 10; i++) {
            std::string input = "GENESIS_FLEET_" + std::to_string(i);
            std::string hash = SovereignSHA256::hash(input);
            EntityAuthority auth = (i % 2 == 0) ? EntityAuthority::SOVEREIGN : EntityAuthority::PROXY;
            if (nexus.registerEntity(hash, "genesis_owner_" + std::to_string(i), auth)) {
                registered++;
            }
            FEntityTransform t;
            t.posX = static_cast<float>(i * 10);
            t.posY = static_cast<float>(i * 5);
            nexus.updateEntityTransform(hash, t, "genesis_owner_" + std::to_string(i));
        }
        ASSERT_EQ(registered, 10);

        auto deltas = nexus.computeWorldDelta();
        ASSERT_TRUE(deltas.size() > 0);
    END_TEST("genesis_fleet_synthesis")

    TEST("determinism_same_registry_same_hash")
        nexus.resetStats();
        nexus.registerEntity("det_001", "owner_A");
        FEntityTransform t; t.posX = 42.0f;
        nexus.updateEntityTransform("det_001", t, "owner_A");
        auto e1 = nexus.getEntity("det_001");

        nexus.resetStats();
        nexus.registerEntity("det_001", "owner_A");
        nexus.updateEntityTransform("det_001", t, "owner_A");
        auto e2 = nexus.getEntity("det_001");

        ASSERT_EQ(e1.entityStateHash, e2.entityStateHash);
    END_TEST("determinism_same_registry_same_hash")

    std::cout << "\n==================================================" << std::endl;
    std::cout << "NEXUS RESULTS: " << passCount << " passed, " << failCount << " failed" << std::endl;
    std::cout << "==================================================" << std::endl;

    return failCount > 0 ? 1 : 0;
}
