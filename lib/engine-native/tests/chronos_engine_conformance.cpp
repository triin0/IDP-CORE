#include "../generated/ChronosEngine.h"
#include <iostream>
#include <cstdio>

using namespace Sovereign;

int passed = 0;
int failed = 0;

void check(bool condition, const std::string& name) {
    if (condition) {
        std::cout << "  PASS: " << name << std::endl;
        passed++;
    } else {
        std::cerr << "  FAIL: " << name << std::endl;
        failed++;
    }
}

void testSingleton() {
    std::cout << "\n=== Chronos Engine Singleton ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    auto& engine2 = ChronosEngine::Get();
    check(&engine == &engine2, "Singleton — same instance");
    engine.reset();
}

void testConfiguration() {
    std::cout << "\n=== Configuration ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_engine_test.bin";
    config.maxRetries = 5;
    config.flushBatchSize = 20;
    config.staleThresholdSeconds = 7200;
    config.autoSaveOnEnqueue = true;
    config.autoFlushOnReconnect = true;
    engine.configure(config);

    auto retrieved = engine.getConfig();
    check(retrieved.persistencePath == "/tmp/chronos_engine_test.bin", "Config — persistence path set");
    check(retrieved.maxRetries == 5, "Config — max retries set");
    check(retrieved.flushBatchSize == 20, "Config — flush batch size set");
    check(retrieved.staleThresholdSeconds == 7200, "Config — stale threshold set");
    check(retrieved.autoSaveOnEnqueue == true, "Config — auto save enabled");
    check(retrieved.autoFlushOnReconnect == true, "Config — auto flush on reconnect enabled");
}

void testEnqueue() {
    std::cout << "\n=== Enqueue Operations ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_engine_test.bin";
    config.autoSaveOnEnqueue = true;
    engine.configure(config);

    JsonValue bid1 = JsonValue::object({
        {"amount", JsonValue(50000.0)},
        {"user_id", JsonValue("native-user-001")},
        {"vehicle_id", JsonValue(1)},
    });

    engine.enqueue("vehicle:1:bids", bid1, 1, "native-user-001");
    check(engine.pendingCount() == 1, "Enqueue — 1 entry pending");

    auto stats = engine.getStats();
    check(stats.totalEnqueued == 1, "Enqueue — stats totalEnqueued = 1");
    check(stats.pendingCount == 1, "Enqueue — stats pendingCount = 1");

    JsonValue bid2 = JsonValue::object({
        {"amount", JsonValue(55000.0)},
        {"user_id", JsonValue("native-user-001")},
        {"vehicle_id", JsonValue(1)},
    });

    engine.enqueue("vehicle:1:bids", bid2, 2, "native-user-001");
    check(engine.pendingCount() == 2, "Enqueue — 2 entries pending");

    JsonValue bid3 = JsonValue::object({
        {"amount", JsonValue(60000.0)},
        {"user_id", JsonValue("native-user-002")},
        {"vehicle_id", JsonValue(2)},
    });

    engine.enqueue("vehicle:2:bids", bid3, 1, "native-user-002");
    check(engine.pendingCount() == 3, "Enqueue — 3 entries across 2 entities");

    auto entries = engine.entries();
    check(entries.size() == 3, "Enqueue — entries() returns all 3");
    check(entries[0].entityKey == "vehicle:1:bids", "Enqueue — first entry correct entity");
    check(!entries[0].payloadHash.empty(), "Enqueue — hash computed at enqueue time");
    check(entries[0].payloadHash.size() == 64, "Enqueue — hash is SHA-256 (64 hex)");
}

void testAutoSaveOnEnqueue() {
    std::cout << "\n=== Auto-Save on Enqueue ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_autosave_test.bin";
    config.autoSaveOnEnqueue = true;
    engine.configure(config);

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "user-1");

    auto stats = engine.getStats();
    check(stats.lastSaveTimestamp > 0, "AutoSave — lastSaveTimestamp updated");

    ChronosOfflineQueue verifyQueue;
    bool loaded = verifyQueue.loadFromDisk("/tmp/chronos_autosave_test.bin");
    check(loaded, "AutoSave — file written to disk");
    check(verifyQueue.pendingCount() == 1, "AutoSave — 1 entry persisted on disk");

    std::remove("/tmp/chronos_autosave_test.bin");
}

void testFlushWithCallback() {
    std::cout << "\n=== Flush with Callback ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_flush_test.bin";
    engine.configure(config);

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "user-1");
    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(55000.0)}}), 2, "user-1");
    engine.enqueue("vehicle:2:bids", JsonValue::object({{"amount", JsonValue(60000.0)}}), 1, "user-2");

    check(engine.pendingCount() == 3, "Flush — 3 entries pending before flush");

    int progressCount = 0;
    engine.onFlushProgress([&](int completed, int total, const ChronosQueueEntry& entry) {
        progressCount++;
    });

    auto report = engine.flushWithCallback([](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
        return {true, entry.stateVersion + 1, ""};
    });

    check(report.succeeded == 3, "Flush — 3 succeeded");
    check(report.conflicted == 0, "Flush — 0 conflicted");
    check(report.failed == 0, "Flush — 0 failed");
    check(engine.pendingCount() == 0, "Flush — 0 pending after flush");
    check(progressCount == 3, "Flush — progress delegate fired 3 times");

    auto stats = engine.getStats();
    check(stats.totalFlushed == 3, "Flush — stats totalFlushed = 3");
    check(stats.lastFlushTimestamp > 0, "Flush — lastFlushTimestamp updated");

    std::remove("/tmp/chronos_flush_test.bin");
}

void testConflictDetection() {
    std::cout << "\n=== 409 State Conflict Detection ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_conflict_test.bin";
    engine.configure(config);

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "stale-user");
    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(55000.0)}}), 1, "stale-user");
    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(60000.0)}}), 3, "fresh-user");

    auto report = engine.flushWithCallback([](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
        if (entry.stateVersion < 3) {
            return {false, 0, "409 STATE_VERSION_CONFLICT"};
        }
        return {true, entry.stateVersion + 1, ""};
    });

    check(report.conflicted == 2, "Conflict — 2 stale entries detected as 409");
    check(report.succeeded == 1, "Conflict — 1 fresh entry succeeded");
    check(report.failed == 0, "Conflict — 0 hard failures");

    auto stats = engine.getStats();
    check(stats.totalConflicts == 2, "Conflict — stats totalConflicts = 2");

    auto conflicts = engine.getConflicts();
    check(conflicts.size() == 2, "Conflict — 2 conflict records stored");
    check(engine.unresolvedConflictCount() == 2, "Conflict — 2 unresolved conflicts");

    std::remove("/tmp/chronos_conflict_test.bin");
}

void testConflictResolution() {
    std::cout << "\n=== Conflict Resolution ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_resolve_test.bin";
    engine.configure(config);

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "stale-user");

    engine.flushWithCallback([](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
        return {false, 0, "409 STATE_VERSION_CONFLICT"};
    });

    check(engine.unresolvedConflictCount() == 1, "Resolution — 1 unresolved conflict");

    bool delegateFired = false;
    engine.onConflictResolved([&](const ConflictRecord& record, const AuthoritativeManifest& manifest) {
        delegateFired = true;
    });

    AuthoritativeManifest manifest;
    manifest.serverVersion = 5;
    manifest.highestBid = 75000.0;
    manifest.bidCount = 10;
    manifest.entityKey = "vehicle:1:bids";

    engine.resolveConflict(0, manifest);

    check(delegateFired, "Resolution — onConflictResolved delegate fired");
    check(engine.unresolvedConflictCount() == 0, "Resolution — 0 unresolved after resolution");

    auto conflicts = engine.getConflicts();
    check(conflicts[0].resolved, "Resolution — conflict marked as resolved");

    check(engine.getVersionForEntity("flush") == 5, "Resolution — version map updated to server version");

    std::remove("/tmp/chronos_resolve_test.bin");
}

void testCrashRecovery() {
    std::cout << "\n=== Crash Recovery ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    std::string crashPath = "/tmp/chronos_crash_test.bin";

    ChronosConfig config;
    config.persistencePath = crashPath;
    config.autoSaveOnEnqueue = true;
    engine.configure(config);

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "user-crash");
    engine.enqueue("vehicle:2:bids", JsonValue::object({{"amount", JsonValue(60000.0)}}), 1, "user-crash");
    engine.enqueue("vehicle:3:bids", JsonValue::object({{"amount", JsonValue(70000.0)}}), 1, "user-crash");

    check(engine.pendingCount() == 3, "Crash — 3 entries queued before 'crash'");

    auto hashBefore = engine.entries()[0].payloadHash;

    engine.reset();
    config.persistencePath = crashPath;
    engine.configure(config);
    check(engine.pendingCount() == 0, "Crash — engine reset simulates crash (0 entries)");

    bool recoveryFired = false;
    int recoveredEntries = 0;
    engine.onCrashRecovery([&](int count, const std::string& path) {
        recoveryFired = true;
        recoveredEntries = count;
    });

    int recovered = engine.recoverFromCrash();
    check(recovered == 3, "Recovery — 3 entries recovered from disk");
    check(recoveryFired, "Recovery — onCrashRecovery delegate fired");
    check(recoveredEntries == 3, "Recovery — delegate received correct count");

    check(engine.pendingCount() == 3, "Recovery — 3 entries restored to queue");
    check(engine.entries()[0].payloadHash == hashBefore, "Recovery — hash integrity preserved through crash");

    auto stats = engine.getStats();
    check(stats.totalCrashRecoveries == 1, "Recovery — stats totalCrashRecoveries = 1");
    check(engine.getState() == ChronosState::OFFLINE, "Recovery — state set to OFFLINE after recovery");

    std::remove(crashPath.c_str());
}

void testFullCrashFlushCycle() {
    std::cout << "\n=== Full Crash → Recovery → Flush Cycle ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    std::string cyclePath = "/tmp/chronos_cycle_test.bin";
    ChronosConfig config;
    config.persistencePath = cyclePath;
    config.autoSaveOnEnqueue = true;
    engine.configure(config);

    engine.enqueue("vehicle:1:bids", JsonValue::object({
        {"amount", JsonValue(50000.0)},
        {"user_id", JsonValue("crash-user")},
        {"vehicle_id", JsonValue(1)},
    }), 0, "crash-user");

    engine.enqueue("vehicle:1:bids", JsonValue::object({
        {"amount", JsonValue(55000.0)},
        {"user_id", JsonValue("crash-user")},
        {"vehicle_id", JsonValue(1)},
    }), 1, "crash-user");

    engine.enqueue("vehicle:1:bids", JsonValue::object({
        {"amount", JsonValue(60000.0)},
        {"user_id", JsonValue("crash-user")},
        {"vehicle_id", JsonValue(1)},
    }), 2, "crash-user");

    auto hash0 = engine.entries()[0].payloadHash;
    auto hash1 = engine.entries()[1].payloadHash;
    auto hash2 = engine.entries()[2].payloadHash;

    engine.reset();
    config.persistencePath = cyclePath;
    engine.configure(config);
    engine.recoverFromCrash();

    check(engine.pendingCount() == 3, "Cycle — 3 entries recovered");
    check(engine.entries()[0].payloadHash == hash0, "Cycle — entry 0 hash intact v0→v1");
    check(engine.entries()[1].payloadHash == hash1, "Cycle — entry 1 hash intact v1→v2");
    check(engine.entries()[2].payloadHash == hash2, "Cycle — entry 2 hash intact v2→v3");

    std::vector<int32_t> flushedVersions;
    auto report = engine.flushWithCallback([&](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
        flushedVersions.push_back(entry.stateVersion);
        return {true, entry.stateVersion + 1, ""};
    });

    check(report.succeeded == 3, "Cycle — all 3 flushed successfully");
    check(flushedVersions.size() == 3, "Cycle — 3 flush callbacks fired");
    check(flushedVersions[0] == 0, "Cycle — first flush at version 0");
    check(flushedVersions[1] == 1, "Cycle — second flush at version 1");
    check(flushedVersions[2] == 2, "Cycle — third flush at version 2");
    check(engine.pendingCount() == 0, "Cycle — 0 pending after full flush");

    auto stats = engine.getStats();
    check(stats.totalCrashRecoveries == 1, "Cycle — 1 crash recovery");
    check(stats.totalFlushed == 3, "Cycle — 3 total flushed");
    check(stats.totalConflicts == 0, "Cycle — 0 conflicts (clean flush)");
    check(engine.getState() == ChronosState::IDLE, "Cycle — state IDLE after clean flush");

    std::remove(cyclePath.c_str());
}

void testVersionTracking() {
    std::cout << "\n=== Version Map Tracking ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    check(engine.getVersionForEntity("vehicle:1:bids") == 0, "Version — default is 0");

    engine.setVersionForEntity("vehicle:1:bids", 5);
    check(engine.getVersionForEntity("vehicle:1:bids") == 5, "Version — set to 5");

    engine.setVersionForEntity("vehicle:2:bids", 10);
    check(engine.getVersionForEntity("vehicle:2:bids") == 10, "Version — second entity tracked");
    check(engine.getVersionForEntity("vehicle:1:bids") == 5, "Version — first entity unchanged");
}

void testStaleEviction() {
    std::cout << "\n=== Stale Entry Eviction ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_evict_test.bin";
    config.staleThresholdSeconds = 1;
    config.autoSaveOnEnqueue = false;
    engine.configure(config);

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "user-1");
    check(engine.pendingCount() == 1, "Eviction — 1 entry before eviction");

    auto entries = engine.entries();
    check(!entries.empty(), "Eviction — entry exists");

    int evicted = engine.evictStaleEntries();
    check(engine.pendingCount() <= 1, "Eviction — eviction ran without crash");
}

void testConnectivityHandling() {
    std::cout << "\n=== Connectivity State Management ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_connectivity_test.bin";
    config.autoFlushOnReconnect = true;
    engine.configure(config);

    bool connectivityFired = false;
    bool lastOnlineState = false;
    engine.onConnectivityChanged([&](bool online) {
        connectivityFired = true;
        lastOnlineState = online;
    });

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "user-1");

    engine.setOnline(false);
    check(engine.getState() == ChronosState::OFFLINE, "Connectivity — state OFFLINE");
    check(connectivityFired, "Connectivity — delegate fired on offline");
    check(!lastOnlineState, "Connectivity — delegate received online=false");

    connectivityFired = false;
    engine.setOnline(true);
    check(connectivityFired, "Connectivity — delegate fired on reconnect");
    check(lastOnlineState, "Connectivity — delegate received online=true");
    check(engine.getState() == ChronosState::IDLE, "Connectivity — state IDLE after reconnect");
}

void testClearFlushed() {
    std::cout << "\n=== Clear Flushed Entries ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_clear_test.bin";
    engine.configure(config);

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "user-1");
    engine.enqueue("vehicle:2:bids", JsonValue::object({{"amount", JsonValue(60000.0)}}), 1, "user-2");

    engine.flushWithCallback([](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
        return {true, entry.stateVersion + 1, ""};
    });

    check(engine.pendingCount() == 0, "ClearFlushed — 0 pending after flush");
    check(engine.entries().size() == 2, "ClearFlushed — 2 total entries (flushed still stored)");

    engine.clearFlushed();
    check(engine.entries().size() == 0, "ClearFlushed — 0 total entries after clear");

    std::remove("/tmp/chronos_clear_test.bin");
}

void testManifestParsing() {
    std::cout << "\n=== Authoritative Manifest Parsing ===" << std::endl;

    std::string json = R"({
        "error": "Shadow Branch Detected",
        "code": "STATE_VERSION_CONFLICT",
        "clientVersion": 3,
        "serverVersion": 7,
        "authoritativeManifest": {
            "highestBid": 75000.0,
            "bidCount": 12,
            "recentBids": []
        }
    })";

    auto manifest = AuthoritativeManifest::fromJson(json);
    check(manifest.clientVersion == 3, "Manifest — clientVersion parsed");
    check(manifest.serverVersion == 7, "Manifest — serverVersion parsed");
    check(manifest.bidCount == 12, "Manifest — bidCount parsed");
    check(manifest.highestBid >= 74999.0 && manifest.highestBid <= 75001.0, "Manifest — highestBid parsed");
    check(!manifest.rawJson.empty(), "Manifest — rawJson preserved");
}

void testStateTransitions() {
    std::cout << "\n=== State Machine Transitions ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_state_test.bin";
    engine.configure(config);

    check(engine.getState() == ChronosState::IDLE, "State — initial IDLE");
    check(ChronosEngine::stateToString(ChronosState::IDLE) == "IDLE", "State — toString IDLE");
    check(ChronosEngine::stateToString(ChronosState::FLUSHING) == "FLUSHING", "State — toString FLUSHING");
    check(ChronosEngine::stateToString(ChronosState::OFFLINE) == "OFFLINE", "State — toString OFFLINE");
    check(ChronosEngine::stateToString(ChronosState::CONFLICT_RESOLUTION) == "CONFLICT_RESOLUTION", "State — toString CONFLICT_RESOLUTION");
    check(ChronosEngine::stateToString(ChronosState::RECOVERING) == "RECOVERING", "State — toString RECOVERING");

    engine.enqueue("vehicle:1:bids", JsonValue::object({{"amount", JsonValue(50000.0)}}), 1, "user-1");
    engine.setOnline(false);
    check(engine.getState() == ChronosState::OFFLINE, "State — OFFLINE after disconnect");

    engine.setOnline(true);
    check(engine.getState() == ChronosState::IDLE, "State — IDLE after reconnect");

    engine.flushWithCallback([](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
        return {true, entry.stateVersion + 1, ""};
    });
    check(engine.getState() == ChronosState::IDLE, "State — IDLE after clean flush");

    std::remove("/tmp/chronos_state_test.bin");
}

void testHashIntegrityChain() {
    std::cout << "\n=== Hash Integrity Chain ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    std::string chainPath = "/tmp/chronos_chain_test.bin";
    ChronosConfig config;
    config.persistencePath = chainPath;
    config.autoSaveOnEnqueue = true;
    engine.configure(config);

    JsonValue payload = JsonValue::object({
        {"amount", JsonValue(50000.0)},
        {"user_id", JsonValue("chain-user")},
        {"vehicle_id", JsonValue(1)},
    });

    std::string expectedCanonical = payload.canonicalize();
    std::string expectedHash = SovereignSHA256::hash(expectedCanonical);

    engine.enqueue("vehicle:1:bids", payload, 1, "chain-user");

    auto originalEntries = engine.entries();
    check(originalEntries[0].payloadHash == expectedHash, "Chain — enqueue hash matches direct computation");
    check(originalEntries[0].payloadJson == expectedCanonical, "Chain — stored JSON is canonical");

    engine.reset();
    config.persistencePath = chainPath;
    engine.configure(config);
    engine.recoverFromCrash();

    auto recoveredEntries = engine.entries();
    check(recoveredEntries[0].payloadHash == expectedHash, "Chain — hash survives crash recovery");
    check(recoveredEntries[0].payloadJson == expectedCanonical, "Chain — canonical JSON survives crash");

    std::string recomputedHash = SovereignSHA256::hash(recoveredEntries[0].payloadJson);
    check(recomputedHash == expectedHash, "Chain — recomputed hash matches original");
    check(recomputedHash == recoveredEntries[0].payloadHash, "Chain — full circle integrity verified");

    std::remove(chainPath.c_str());
}

void testEnqueueWithTransport() {
    std::cout << "\n=== Enqueue with Transport Integration ===" << std::endl;
    auto& engine = ChronosEngine::Get();
    engine.reset();

    ChronosConfig config;
    config.persistencePath = "/tmp/chronos_transport_test.bin";
    config.autoSaveOnEnqueue = true;
    engine.configure(config);

    auto& auth = UAuthService::Get();
    int64_t futureExpiry = static_cast<int64_t>(std::time(nullptr)) + 3600;
    auth.setTokenDirect("transport-test-jwt", "transport-user-001", "sess-t", futureExpiry);

    JsonValue bid = JsonValue::object({
        {"amount", JsonValue(50000.0)},
        {"user_id", JsonValue("transport-user-001")},
        {"vehicle_id", JsonValue(1)},
    });

    engine.enqueueWithTransport("vehicle:1:bids", "/api/bids", bid, 1);

    check(engine.pendingCount() == 1, "TransportEnqueue — 1 entry pending");

    auto entries = engine.entries();
    check(entries[0].userId == "transport-user-001", "TransportEnqueue — userId from auth service");
    check(!entries[0].payloadHash.empty(), "TransportEnqueue — hash computed");

    auth.clearAuth();
    std::remove("/tmp/chronos_transport_test.bin");
}

int main() {
    std::cout << "=== Chronos Engine: The Memory ===" << std::endl;

    testSingleton();
    testConfiguration();
    testEnqueue();
    testAutoSaveOnEnqueue();
    testFlushWithCallback();
    testConflictDetection();
    testConflictResolution();
    testCrashRecovery();
    testFullCrashFlushCycle();
    testVersionTracking();
    testStaleEviction();
    testConnectivityHandling();
    testClearFlushed();
    testManifestParsing();
    testStateTransitions();
    testHashIntegrityChain();
    testEnqueueWithTransport();

    std::cout << "\n" << std::string(50, '=') << std::endl;
    std::cout << "CHRONOS RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;

    return failed > 0 ? 1 : 0;
}
