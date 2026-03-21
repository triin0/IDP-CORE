#pragma once

#include "SovereignTransport.h"
#include <string>
#include <vector>
#include <map>
#include <functional>
#include <mutex>
#include <chrono>
#include <algorithm>

namespace Sovereign {

struct AuthoritativeManifest {
    double highestBid;
    int bidCount;
    int32_t serverVersion;
    int32_t clientVersion;
    std::string entityKey;
    std::string rawJson;

    static AuthoritativeManifest fromJson(const std::string& json) {
        AuthoritativeManifest m{};
        m.rawJson = json;

        auto findInt = [&](const std::string& key) -> int {
            std::string patterns[] = {
                "\"" + key + "\":",
                "\"" + key + "\": ",
            };
            for (auto& search : patterns) {
                size_t pos = json.find(search);
                if (pos != std::string::npos) {
                    size_t start = pos + search.size();
                    while (start < json.size() && (json[start] == ' ' || json[start] == '\t')) start++;
                    std::string num;
                    while (start < json.size() && (json[start] >= '0' && json[start] <= '9')) {
                        num += json[start++];
                    }
                    if (!num.empty()) return std::stoi(num);
                }
            }
            return 0;
        };

        auto findDouble = [&](const std::string& key) -> double {
            std::string patterns[] = {
                "\"" + key + "\":",
                "\"" + key + "\": ",
            };
            for (auto& search : patterns) {
                size_t pos = json.find(search);
                if (pos != std::string::npos) {
                    size_t start = pos + search.size();
                    while (start < json.size() && (json[start] == ' ' || json[start] == '\t')) start++;
                    std::string num;
                    while (start < json.size() && (json[start] >= '0' && json[start] <= '9' || json[start] == '.' || json[start] == '-')) {
                        num += json[start++];
                    }
                    if (!num.empty()) return std::stod(num);
                }
            }
            return 0.0;
        };

        m.serverVersion = findInt("serverVersion");
        m.clientVersion = findInt("clientVersion");
        m.bidCount = findInt("bidCount");
        m.highestBid = findDouble("highestBid");
        return m;
    }
};

struct ConflictRecord {
    std::string entityKey;
    int32_t clientVersion;
    int32_t serverVersion;
    int64_t timestamp;
    std::string payloadHash;
    AuthoritativeManifest manifest;
    bool resolved;
};

struct ChronosConfig {
    std::string persistencePath = "/tmp/chronos_queue.bin";
    int maxRetries = 3;
    int flushBatchSize = 10;
    int64_t staleThresholdSeconds = 86400;
    bool autoSaveOnEnqueue = true;
    bool autoFlushOnReconnect = true;
    int maxConflictHistory = 100;
};

enum class ChronosState {
    IDLE,
    FLUSHING,
    OFFLINE,
    CONFLICT_RESOLUTION,
    RECOVERING,
};

struct ChronosStats {
    int totalEnqueued;
    int totalFlushed;
    int totalConflicts;
    int totalRetries;
    int totalCrashRecoveries;
    int pendingCount;
    int conflictCount;
    ChronosState state;
    int64_t lastFlushTimestamp;
    int64_t lastSaveTimestamp;
};

using ConflictResolvedDelegate = std::function<void(const ConflictRecord&, const AuthoritativeManifest&)>;
using FlushProgressDelegate = std::function<void(int completed, int total, const ChronosQueueEntry& current)>;
using CrashRecoveryDelegate = std::function<void(int recoveredEntries, const std::string& filepath)>;
using ConnectivityChangedDelegate = std::function<void(bool online)>;

class ChronosEngine {
public:
    static ChronosEngine& Get() {
        static ChronosEngine instance;
        return instance;
    }

    void configure(const ChronosConfig& config) {
        std::lock_guard<std::mutex> lock(mutex_);
        config_ = config;
    }

    ChronosConfig getConfig() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return config_;
    }

    void enqueue(const std::string& entityKey, const JsonValue& payload,
                 int32_t stateVersion, const std::string& userId) {
        std::lock_guard<std::mutex> lock(mutex_);
        queue_.enqueue(entityKey, payload, stateVersion, userId);
        stats_.totalEnqueued++;
        stats_.pendingCount = static_cast<int>(queue_.pendingCount());

        if (config_.autoSaveOnEnqueue) {
            queue_.saveToDisk(config_.persistencePath);
            stats_.lastSaveTimestamp = currentTimestamp();
        }
    }

    void enqueueWithTransport(const std::string& entityKey, const std::string& apiPath,
                               const JsonValue& payload, int32_t stateVersion) {
        auto& auth = UAuthService::Get();
        std::string userId = auth.getUserId();

        std::lock_guard<std::mutex> lock(mutex_);
        queue_.enqueue(entityKey, payload, stateVersion, userId);
        stats_.totalEnqueued++;
        stats_.pendingCount = static_cast<int>(queue_.pendingCount());

        pathMap_[entityKey] = apiPath;

        if (config_.autoSaveOnEnqueue) {
            queue_.saveToDisk(config_.persistencePath);
            stats_.lastSaveTimestamp = currentTimestamp();
        }
    }

    ChronosOfflineQueue::FlushReport flush() {
        std::lock_guard<std::mutex> lock(mutex_);
        state_ = ChronosState::FLUSHING;

        auto& client = USovereignHttpClient::Get();
        int total = static_cast<int>(queue_.pendingCount());
        int completed = 0;

        auto report = queue_.flush([&](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
            std::string path = "/api/bids";
            auto it = pathMap_.find(entry.entityKey);
            if (it != pathMap_.end()) path = it->second;

            JsonValue payload = JsonValue(entry.payloadJson);

            auto prepared = client.prepareRequest(HttpMethod::POST, path);
            prepared.body = entry.payloadJson;
            prepared.payloadHash = entry.payloadHash;
            prepared.headers["X-Payload-Hash"] = entry.payloadHash;
            prepared.hasPayloadHash = true;

            completed++;
            if (flushProgressDelegate_) {
                flushProgressDelegate_(completed, total, entry);
            }

            return simulateFlush(entry);
        });

        stats_.totalFlushed += report.succeeded;
        stats_.totalConflicts += report.conflicted;
        stats_.pendingCount = static_cast<int>(queue_.pendingCount());
        stats_.lastFlushTimestamp = currentTimestamp();

        for (int i = 0; i < report.conflicted; i++) {
            if (i < static_cast<int>(report.errors.size())) {
                ConflictRecord conflict;
                conflict.entityKey = "unknown";
                conflict.clientVersion = 0;
                conflict.serverVersion = 0;
                conflict.timestamp = currentTimestamp();
                conflict.payloadHash = "";
                conflict.resolved = false;
                conflicts_.push_back(conflict);
                stats_.conflictCount = static_cast<int>(conflicts_.size());
            }
        }

        queue_.saveToDisk(config_.persistencePath);
        stats_.lastSaveTimestamp = currentTimestamp();

        state_ = (queue_.pendingCount() > 0) ? ChronosState::OFFLINE : ChronosState::IDLE;
        return report;
    }

    ChronosOfflineQueue::FlushReport flushWithCallback(ChronosOfflineQueue::FlushCallback callback) {
        std::lock_guard<std::mutex> lock(mutex_);
        state_ = ChronosState::FLUSHING;

        int total = static_cast<int>(queue_.pendingCount());
        int completed = 0;

        auto wrappedCallback = [&](const ChronosQueueEntry& entry) -> ChronosOfflineQueue::FlushResult {
            completed++;
            if (flushProgressDelegate_) {
                flushProgressDelegate_(completed, total, entry);
            }
            return callback(entry);
        };

        auto report = queue_.flush(wrappedCallback);

        stats_.totalFlushed += report.succeeded;
        stats_.totalConflicts += report.conflicted;
        stats_.pendingCount = static_cast<int>(queue_.pendingCount());
        stats_.lastFlushTimestamp = currentTimestamp();

        for (const auto& err : report.errors) {
            if (err.find("409") != std::string::npos || err.find("CONFLICT") != std::string::npos) {
                ConflictRecord conflict;
                conflict.entityKey = "flush";
                conflict.timestamp = currentTimestamp();
                conflict.resolved = false;
                conflicts_.push_back(conflict);
            }
        }
        stats_.conflictCount = static_cast<int>(conflicts_.size());

        queue_.saveToDisk(config_.persistencePath);
        stats_.lastSaveTimestamp = currentTimestamp();

        state_ = (queue_.pendingCount() > 0) ? ChronosState::OFFLINE : ChronosState::IDLE;
        return report;
    }

    int recoverFromCrash() {
        std::lock_guard<std::mutex> lock(mutex_);
        state_ = ChronosState::RECOVERING;

        ChronosOfflineQueue recovered;
        if (!recovered.loadFromDisk(config_.persistencePath)) {
            state_ = ChronosState::IDLE;
            return 0;
        }

        int recoveredCount = static_cast<int>(recovered.pendingCount());

        if (recoveredCount > 0) {
            queue_ = recovered;
            stats_.totalCrashRecoveries++;
            stats_.pendingCount = recoveredCount;

            if (crashRecoveryDelegate_) {
                crashRecoveryDelegate_(recoveredCount, config_.persistencePath);
            }
        }

        state_ = (recoveredCount > 0) ? ChronosState::OFFLINE : ChronosState::IDLE;
        return recoveredCount;
    }

    bool saveToDisk() {
        std::lock_guard<std::mutex> lock(mutex_);
        bool result = queue_.saveToDisk(config_.persistencePath);
        if (result) {
            stats_.lastSaveTimestamp = currentTimestamp();
        }
        return result;
    }

    void resolveConflict(size_t conflictIndex, const AuthoritativeManifest& manifest) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (conflictIndex < conflicts_.size()) {
            conflicts_[conflictIndex].resolved = true;
            conflicts_[conflictIndex].manifest = manifest;

            auto it = versionMap_.find(conflicts_[conflictIndex].entityKey);
            if (it != versionMap_.end()) {
                it->second = manifest.serverVersion;
            } else {
                versionMap_[conflicts_[conflictIndex].entityKey] = manifest.serverVersion;
            }

            if (conflictResolvedDelegate_) {
                conflictResolvedDelegate_(conflicts_[conflictIndex], manifest);
            }
        }
    }

    void setOnline(bool online) {
        std::lock_guard<std::mutex> lock(mutex_);
        bool wasOffline = (state_ == ChronosState::OFFLINE);
        if (online && wasOffline && config_.autoFlushOnReconnect && queue_.pendingCount() > 0) {
            state_ = ChronosState::IDLE;
            if (connectivityDelegate_) {
                connectivityDelegate_(true);
            }
        } else if (!online) {
            state_ = ChronosState::OFFLINE;
            if (connectivityDelegate_) {
                connectivityDelegate_(false);
            }
        }
    }

    int32_t getVersionForEntity(const std::string& entityKey) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = versionMap_.find(entityKey);
        return (it != versionMap_.end()) ? it->second : 0;
    }

    void setVersionForEntity(const std::string& entityKey, int32_t version) {
        std::lock_guard<std::mutex> lock(mutex_);
        versionMap_[entityKey] = version;
    }

    int evictStaleEntries() {
        std::lock_guard<std::mutex> lock(mutex_);
        int64_t now = currentTimestamp();
        int evicted = 0;
        auto& entries = const_cast<std::vector<ChronosQueueEntry>&>(queue_.entries());
        entries.erase(
            std::remove_if(entries.begin(), entries.end(),
                [&](const ChronosQueueEntry& e) {
                    if (!e.flushed && (now - e.timestamp) > config_.staleThresholdSeconds) {
                        evicted++;
                        return true;
                    }
                    return false;
                }),
            entries.end()
        );
        stats_.pendingCount = static_cast<int>(queue_.pendingCount());
        return evicted;
    }

    void clearFlushed() {
        std::lock_guard<std::mutex> lock(mutex_);
        queue_.clearFlushed();
        stats_.pendingCount = static_cast<int>(queue_.pendingCount());
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        queue_ = ChronosOfflineQueue();
        conflicts_.clear();
        versionMap_.clear();
        pathMap_.clear();
        stats_ = ChronosStats{};
        state_ = ChronosState::IDLE;
        conflictResolvedDelegate_ = nullptr;
        flushProgressDelegate_ = nullptr;
        crashRecoveryDelegate_ = nullptr;
        connectivityDelegate_ = nullptr;
    }

    size_t pendingCount() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.pendingCount();
    }

    ChronosState getState() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return state_;
    }

    ChronosStats getStats() const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto s = stats_;
        s.state = state_;
        return s;
    }

    const std::vector<ConflictRecord>& getConflicts() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return conflicts_;
    }

    int unresolvedConflictCount() const {
        std::lock_guard<std::mutex> lock(mutex_);
        int count = 0;
        for (const auto& c : conflicts_) if (!c.resolved) count++;
        return count;
    }

    const std::vector<ChronosQueueEntry>& entries() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.entries();
    }

    void onConflictResolved(ConflictResolvedDelegate callback) {
        std::lock_guard<std::mutex> lock(mutex_);
        conflictResolvedDelegate_ = std::move(callback);
    }

    void onFlushProgress(FlushProgressDelegate callback) {
        std::lock_guard<std::mutex> lock(mutex_);
        flushProgressDelegate_ = std::move(callback);
    }

    void onCrashRecovery(CrashRecoveryDelegate callback) {
        std::lock_guard<std::mutex> lock(mutex_);
        crashRecoveryDelegate_ = std::move(callback);
    }

    void onConnectivityChanged(ConnectivityChangedDelegate callback) {
        std::lock_guard<std::mutex> lock(mutex_);
        connectivityDelegate_ = std::move(callback);
    }

    static std::string stateToString(ChronosState s) {
        switch (s) {
            case ChronosState::IDLE: return "IDLE";
            case ChronosState::FLUSHING: return "FLUSHING";
            case ChronosState::OFFLINE: return "OFFLINE";
            case ChronosState::CONFLICT_RESOLUTION: return "CONFLICT_RESOLUTION";
            case ChronosState::RECOVERING: return "RECOVERING";
        }
        return "UNKNOWN";
    }

private:
    ChronosEngine() = default;
    ChronosEngine(const ChronosEngine&) = delete;
    ChronosEngine& operator=(const ChronosEngine&) = delete;

    ChronosOfflineQueue::FlushResult simulateFlush(const ChronosQueueEntry& entry) {
        return {true, entry.stateVersion + 1, ""};
    }

    static int64_t currentTimestamp() {
        return static_cast<int64_t>(std::time(nullptr));
    }

    mutable std::mutex mutex_;
    ChronosOfflineQueue queue_;
    ChronosConfig config_;
    ChronosState state_ = ChronosState::IDLE;
    ChronosStats stats_{};
    std::vector<ConflictRecord> conflicts_;
    std::map<std::string, int32_t> versionMap_;
    std::map<std::string, std::string> pathMap_;

    ConflictResolvedDelegate conflictResolvedDelegate_;
    FlushProgressDelegate flushProgressDelegate_;
    CrashRecoveryDelegate crashRecoveryDelegate_;
    ConnectivityChangedDelegate connectivityDelegate_;
};

}
