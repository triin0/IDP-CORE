#pragma once

#include "SovereignSynapse.h"
#include <string>
#include <vector>
#include <array>
#include <cmath>
#include <algorithm>
#include <mutex>
#include <functional>
#include <cstdint>
#include <unordered_map>
#include <unordered_set>
#include <ctime>
#include <sstream>
#include <chrono>
#include <deque>
#include <numeric>
#include <iomanip>

namespace Sovereign {

enum class EntityAuthority {
    SOVEREIGN,
    PROXY,
    DORMANT,
    CONTESTED
};

inline std::string entityAuthorityToString(EntityAuthority a) {
    switch (a) {
        case EntityAuthority::SOVEREIGN: return "SOVEREIGN";
        case EntityAuthority::PROXY:     return "PROXY";
        case EntityAuthority::DORMANT:   return "DORMANT";
        case EntityAuthority::CONTESTED: return "CONTESTED";
        default: return "UNKNOWN";
    }
}

enum class SyncState {
    LIVE,
    STALE,
    GHOST,
    FAST_FORWARDING,
    DISCONNECTED
};

inline std::string syncStateToString(SyncState s) {
    switch (s) {
        case SyncState::LIVE:             return "LIVE";
        case SyncState::STALE:            return "STALE";
        case SyncState::GHOST:            return "GHOST";
        case SyncState::FAST_FORWARDING:  return "FAST_FORWARDING";
        case SyncState::DISCONNECTED:     return "DISCONNECTED";
        default: return "UNKNOWN";
    }
}

enum class ConflictResolution {
    LWW_TIMESTAMP,
    PRIORITY_AUTHORITY,
    MERGE_ADDITIVE,
    REJECT_BOTH
};

inline std::string conflictResolutionToString(ConflictResolution c) {
    switch (c) {
        case ConflictResolution::LWW_TIMESTAMP:       return "LWW_TIMESTAMP";
        case ConflictResolution::PRIORITY_AUTHORITY:   return "PRIORITY_AUTHORITY";
        case ConflictResolution::MERGE_ADDITIVE:       return "MERGE_ADDITIVE";
        case ConflictResolution::REJECT_BOTH:          return "REJECT_BOTH";
        default: return "UNKNOWN";
    }
}

struct FEntityTransform {
    float posX = 0.0f, posY = 0.0f, posZ = 0.0f;
    float rotX = 0.0f, rotY = 0.0f, rotZ = 0.0f, rotW = 1.0f;
    float scaleX = 1.0f, scaleY = 1.0f, scaleZ = 1.0f;
    float velocityX = 0.0f, velocityY = 0.0f, velocityZ = 0.0f;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6)
            << "{\"posX\":" << posX << ",\"posY\":" << posY << ",\"posZ\":" << posZ
            << ",\"rotW\":" << rotW << ",\"rotX\":" << rotX << ",\"rotY\":" << rotY << ",\"rotZ\":" << rotZ
            << ",\"scaleX\":" << scaleX << ",\"scaleY\":" << scaleY << ",\"scaleZ\":" << scaleZ
            << ",\"velocityX\":" << velocityX << ",\"velocityY\":" << velocityY << ",\"velocityZ\":" << velocityZ
            << "}";
        return oss.str();
    }

    bool operator==(const FEntityTransform& o) const {
        return posX == o.posX && posY == o.posY && posZ == o.posZ &&
               rotX == o.rotX && rotY == o.rotY && rotZ == o.rotZ && rotW == o.rotW &&
               scaleX == o.scaleX && scaleY == o.scaleY && scaleZ == o.scaleZ &&
               velocityX == o.velocityX && velocityY == o.velocityY && velocityZ == o.velocityZ;
    }

    bool operator!=(const FEntityTransform& o) const { return !(*this == o); }

    static FEntityTransform lerp(const FEntityTransform& a, const FEntityTransform& b, float t) {
        t = std::max(0.0f, std::min(1.0f, t));
        FEntityTransform r;
        r.posX = a.posX + (b.posX - a.posX) * t;
        r.posY = a.posY + (b.posY - a.posY) * t;
        r.posZ = a.posZ + (b.posZ - a.posZ) * t;
        r.rotX = a.rotX + (b.rotX - a.rotX) * t;
        r.rotY = a.rotY + (b.rotY - a.rotY) * t;
        r.rotZ = a.rotZ + (b.rotZ - a.rotZ) * t;
        r.rotW = a.rotW + (b.rotW - a.rotW) * t;
        r.scaleX = a.scaleX + (b.scaleX - a.scaleX) * t;
        r.scaleY = a.scaleY + (b.scaleY - a.scaleY) * t;
        r.scaleZ = a.scaleZ + (b.scaleZ - a.scaleZ) * t;
        r.velocityX = a.velocityX + (b.velocityX - a.velocityX) * t;
        r.velocityY = a.velocityY + (b.velocityY - a.velocityY) * t;
        r.velocityZ = a.velocityZ + (b.velocityZ - a.velocityZ) * t;
        return r;
    }
};

struct FNexusEntity {
    std::string entityHash;
    std::string ownerIdentity;
    EntityAuthority authority   = EntityAuthority::DORMANT;
    std::string authorityName   = "DORMANT";
    SyncState syncState         = SyncState::DISCONNECTED;
    std::string syncStateName   = "DISCONNECTED";

    FEntityTransform transform;
    FEntityTransform lastConfirmedTransform;

    int64_t lastUpdateTimestamp  = 0;
    int64_t registrationTimestamp = 0;
    int64_t lastHeartbeatTimestamp = 0;
    int     updateSequence      = 0;
    int     priority            = 0;

    std::string entityStateHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"authority\":\"" << authorityName << "\""
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"ownerIdentity\":\"" << ownerIdentity << "\""
            << ",\"priority\":" << priority
            << ",\"syncState\":\"" << syncStateName << "\""
            << ",\"transform\":" << transform.canonicalize()
            << ",\"updateSequence\":" << updateSequence
            << "}";
        return oss.str();
    }

    void updateHash() {
        entityStateHash = SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !entityStateHash.empty() && entityStateHash == SovereignSHA256::hash(canonicalize());
    }
};

struct FDeltaField {
    std::string fieldName;
    std::string oldValue;
    std::string newValue;
};

struct FDeltaPacket {
    std::string entityHash;
    int64_t timestamp           = 0;
    int     sequenceNumber      = 0;
    std::vector<FDeltaField> fields;
    std::string deltaHash;

    int fieldCount() const { return static_cast<int>(fields.size()); }

    int estimatedBytes() const {
        int bytes = 16;
        for (const auto& f : fields) {
            bytes += static_cast<int>(f.fieldName.size()) + static_cast<int>(f.newValue.size()) + 4;
        }
        return bytes;
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"entityHash\":\"" << entityHash << "\""
            << ",\"fieldCount\":" << fieldCount()
            << ",\"sequenceNumber\":" << sequenceNumber
            << ",\"timestamp\":" << timestamp
            << ",\"fields\":[";
        for (size_t i = 0; i < fields.size(); i++) {
            if (i > 0) oss << ",";
            oss << "{\"field\":\"" << fields[i].fieldName
                << "\",\"new\":\"" << fields[i].newValue << "\"}";
        }
        oss << "]}";
        return oss.str();
    }

    void updateHash() {
        deltaHash = SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !deltaHash.empty() && deltaHash == SovereignSHA256::hash(canonicalize());
    }
};

struct FConflictEvent {
    std::string entityHash;
    std::string writerA;
    std::string writerB;
    int64_t timestampA          = 0;
    int64_t timestampB          = 0;
    ConflictResolution resolution = ConflictResolution::LWW_TIMESTAMP;
    std::string resolutionName  = "LWW_TIMESTAMP";
    std::string winner;
    int64_t resolvedTimestamp    = 0;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"entityHash\":\"" << entityHash << "\""
            << ",\"resolution\":\"" << resolutionName << "\""
            << ",\"resolvedTimestamp\":" << resolvedTimestamp
            << ",\"timestampA\":" << timestampA
            << ",\"timestampB\":" << timestampB
            << ",\"winner\":\"" << winner << "\""
            << ",\"writerA\":\"" << writerA << "\""
            << ",\"writerB\":\"" << writerB << "\""
            << "}";
        return oss.str();
    }
};

struct FGhostReconciliation {
    std::string entityHash;
    FEntityTransform ghostTransform;
    FEntityTransform currentTransform;
    float interpolationProgress = 0.0f;
    int missedUpdates           = 0;
    int64_t disconnectTimestamp  = 0;
    int64_t reconnectTimestamp   = 0;
    bool isComplete             = false;

    float disconnectDurationMs() const {
        return static_cast<float>(reconnectTimestamp - disconnectTimestamp) * 1000.0f;
    }

    FEntityTransform interpolatedTransform() const {
        return FEntityTransform::lerp(ghostTransform, currentTransform, interpolationProgress);
    }

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"disconnectTimestamp\":" << disconnectTimestamp
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"interpolationProgress\":" << std::fixed << std::setprecision(4) << interpolationProgress
            << ",\"isComplete\":" << (isComplete ? "true" : "false")
            << ",\"missedUpdates\":" << missedUpdates
            << ",\"reconnectTimestamp\":" << reconnectTimestamp
            << "}";
        return oss.str();
    }
};

struct FNexusConfig {
    int maxEntities             = 256;
    float heartbeatTimeoutMs    = 5000.0f;
    float staleThresholdMs      = 2000.0f;
    float ghostThresholdMs      = 10000.0f;
    int maxDeltaFieldsPerPacket = 32;
    float reconciliationStepSize = 0.1f;
    int maxConflictLogSize      = 1000;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(1)
            << "{\"ghostThresholdMs\":" << ghostThresholdMs
            << ",\"heartbeatTimeoutMs\":" << heartbeatTimeoutMs
            << ",\"maxDeltaFieldsPerPacket\":" << maxDeltaFieldsPerPacket
            << ",\"maxEntities\":" << maxEntities
            << ",\"reconciliationStepSize\":" << std::setprecision(2) << reconciliationStepSize
            << ",\"staleThresholdMs\":" << std::setprecision(1) << staleThresholdMs
            << "}";
        return oss.str();
    }
};

struct FNexusStats {
    int totalEntitiesRegistered = 0;
    int activeEntities          = 0;
    int sovereignEntities       = 0;
    int proxyEntities           = 0;
    int dormantEntities         = 0;
    int ghostEntities           = 0;
    int totalUpdatesProcessed   = 0;
    int totalDeltasGenerated    = 0;
    int totalDeltaBytes         = 0;
    int totalConflictsResolved  = 0;
    int totalGhostReconciled    = 0;
    int totalEntitiesEvicted    = 0;
    float avgDeltaBytesPerUpdate = 0.0f;
    float avgUpdateLatencyMs    = 0.0f;

    std::unordered_map<std::string, int> authorityCounts;
    std::unordered_map<std::string, int> syncStateCounts;
};

using NexusEntityRegisteredDelegate = std::function<void(const FNexusEntity&)>;
using NexusConflictResolvedDelegate = std::function<void(const FConflictEvent&)>;
using NexusGhostReconciledDelegate  = std::function<void(const FGhostReconciliation&)>;
using NexusEntityEvictedDelegate    = std::function<void(const std::string& entityHash, const std::string& reason)>;

class SovereignNexus {
public:
    static SovereignNexus& Get() {
        static SovereignNexus instance;
        return instance;
    }

    bool registerEntity(const std::string& entityHash,
                        const std::string& ownerIdentity,
                        EntityAuthority authority = EntityAuthority::SOVEREIGN,
                        int priority = 0) {
        FNexusEntity entityCopy;
        NexusEntityRegisteredDelegate delegateCopy;
        {
            std::lock_guard<std::mutex> lock(registryMutex_);

            int maxEnt;
            { std::lock_guard<std::mutex> cg(configMutex_); maxEnt = config_.maxEntities; }

            if (static_cast<int>(registry_.size()) >= maxEnt) {
                return false;
            }

            if (registry_.count(entityHash)) {
                return false;
            }

            FNexusEntity entity;
            entity.entityHash = entityHash;
            entity.ownerIdentity = ownerIdentity;
            entity.authority = authority;
            entity.authorityName = entityAuthorityToString(authority);
            entity.syncState = SyncState::LIVE;
            entity.syncStateName = "LIVE";
            entity.registrationTimestamp = std::time(nullptr);
            entity.lastUpdateTimestamp = entity.registrationTimestamp;
            entity.lastHeartbeatTimestamp = entity.registrationTimestamp;
            entity.priority = priority;
            entity.updateHash();

            registry_[entityHash] = entity;
            entityCopy = entity;

            {
                std::lock_guard<std::mutex> slock(statsMutex_);
                stats_.totalEntitiesRegistered++;
                stats_.activeEntities++;
                stats_.authorityCounts[entity.authorityName]++;
                stats_.syncStateCounts["LIVE"]++;
                if (authority == EntityAuthority::SOVEREIGN) stats_.sovereignEntities++;
                else if (authority == EntityAuthority::PROXY) stats_.proxyEntities++;
            }

            { std::lock_guard<std::mutex> dg(delegateMutex_); delegateCopy = entityRegisteredDelegate_; }
        }

        if (delegateCopy) {
            delegateCopy(entityCopy);
        }

        return true;
    }

    bool unregisterEntity(const std::string& entityHash) {
        std::string hashCopy = entityHash;
        NexusEntityEvictedDelegate delegateCopy;
        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            auto it = registry_.find(entityHash);
            if (it == registry_.end()) return false;

            std::string authName = it->second.authorityName;
            registry_.erase(it);

            {
                std::lock_guard<std::mutex> slock(statsMutex_);
                stats_.activeEntities = std::max(0, stats_.activeEntities - 1);
                stats_.totalEntitiesEvicted++;
                if (authName == "SOVEREIGN") stats_.sovereignEntities = std::max(0, stats_.sovereignEntities - 1);
                else if (authName == "PROXY") stats_.proxyEntities = std::max(0, stats_.proxyEntities - 1);
            }

            { std::lock_guard<std::mutex> dg(delegateMutex_); delegateCopy = entityEvictedDelegate_; }
        }

        if (delegateCopy) {
            delegateCopy(hashCopy, "UNREGISTERED");
        }

        return true;
    }

    bool updateEntityTransform(const std::string& entityHash,
                                const FEntityTransform& newTransform,
                                const std::string& writerIdentity,
                                int64_t writeTimestamp = 0) {
        bool isConflict = false;
        bool writerWins = false;
        FConflictEvent conflictCopy;
        NexusConflictResolvedDelegate delegateCopy;

        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            auto it = registry_.find(entityHash);
            if (it == registry_.end()) return false;

            auto& entity = it->second;

            if (writeTimestamp == 0) writeTimestamp = std::time(nullptr);

            if (entity.ownerIdentity != writerIdentity && entity.authority == EntityAuthority::SOVEREIGN) {
                isConflict = true;
                FConflictEvent conflict;
                conflict.entityHash = entityHash;
                conflict.writerA = entity.ownerIdentity;
                conflict.writerB = writerIdentity;
                conflict.timestampA = entity.lastUpdateTimestamp;
                conflict.timestampB = writeTimestamp;
                conflict.resolution = ConflictResolution::LWW_TIMESTAMP;
                conflict.resolutionName = "LWW_TIMESTAMP";

                if (writeTimestamp >= entity.lastUpdateTimestamp) {
                    conflict.winner = writerIdentity;
                    entity.lastConfirmedTransform = entity.transform;
                    entity.transform = newTransform;
                    entity.lastUpdateTimestamp = writeTimestamp;
                    entity.ownerIdentity = writerIdentity;
                    entity.updateSequence++;
                    entity.updateHash();
                    writerWins = true;
                } else {
                    conflict.winner = entity.ownerIdentity;
                    writerWins = false;
                }

                conflict.resolvedTimestamp = std::time(nullptr);
                conflictCopy = conflict;

                int maxLog;
                { std::lock_guard<std::mutex> cg(configMutex_); maxLog = config_.maxConflictLogSize; }

                {
                    std::lock_guard<std::mutex> clock(conflictMutex_);
                    conflictLog_.push_back(conflict);
                    if (static_cast<int>(conflictLog_.size()) > maxLog) {
                        conflictLog_.pop_front();
                    }
                }

                {
                    std::lock_guard<std::mutex> slock(statsMutex_);
                    stats_.totalConflictsResolved++;
                }

                { std::lock_guard<std::mutex> dg(delegateMutex_); delegateCopy = conflictResolvedDelegate_; }
            } else {
                entity.lastConfirmedTransform = entity.transform;
                entity.transform = newTransform;
                entity.lastUpdateTimestamp = writeTimestamp;
                entity.updateSequence++;
                entity.updateHash();
                writerWins = true;

                {
                    std::lock_guard<std::mutex> slock(statsMutex_);
                    stats_.totalUpdatesProcessed++;
                }
            }
        }

        if (isConflict && delegateCopy) {
            delegateCopy(conflictCopy);
        }

        return writerWins;
    }

    FDeltaPacket computeDelta(const std::string& entityHash,
                               const FEntityTransform& oldTransform,
                               const FEntityTransform& newTransform,
                               int sequenceNumber = 0) {
        FDeltaPacket packet;
        packet.entityHash = entityHash;
        packet.timestamp = std::time(nullptr);
        packet.sequenceNumber = sequenceNumber;

        auto addField = [&](const std::string& name, float oldVal, float newVal) {
            if (std::abs(oldVal - newVal) > 1e-6f) {
                FDeltaField f;
                f.fieldName = name;
                f.oldValue = floatToStr(oldVal);
                f.newValue = floatToStr(newVal);
                packet.fields.push_back(f);
            }
        };

        addField("posX", oldTransform.posX, newTransform.posX);
        addField("posY", oldTransform.posY, newTransform.posY);
        addField("posZ", oldTransform.posZ, newTransform.posZ);
        addField("rotX", oldTransform.rotX, newTransform.rotX);
        addField("rotY", oldTransform.rotY, newTransform.rotY);
        addField("rotZ", oldTransform.rotZ, newTransform.rotZ);
        addField("rotW", oldTransform.rotW, newTransform.rotW);
        addField("scaleX", oldTransform.scaleX, newTransform.scaleX);
        addField("scaleY", oldTransform.scaleY, newTransform.scaleY);
        addField("scaleZ", oldTransform.scaleZ, newTransform.scaleZ);
        addField("velocityX", oldTransform.velocityX, newTransform.velocityX);
        addField("velocityY", oldTransform.velocityY, newTransform.velocityY);
        addField("velocityZ", oldTransform.velocityZ, newTransform.velocityZ);

        packet.updateHash();

        {
            std::lock_guard<std::mutex> slock(statsMutex_);
            stats_.totalDeltasGenerated++;
            stats_.totalDeltaBytes += packet.estimatedBytes();
            int totalDeltas = stats_.totalDeltasGenerated;
            stats_.avgDeltaBytesPerUpdate = static_cast<float>(stats_.totalDeltaBytes) / totalDeltas;
        }

        return packet;
    }

    FDeltaPacket computeEntityDelta(const std::string& entityHash) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) {
            FDeltaPacket empty;
            empty.entityHash = entityHash;
            return empty;
        }

        auto& entity = it->second;
        return computeDelta(entityHash, entity.lastConfirmedTransform, entity.transform, entity.updateSequence);
    }

    std::vector<FDeltaPacket> computeWorldDelta() {
        std::lock_guard<std::mutex> lock(registryMutex_);
        std::vector<FDeltaPacket> deltas;
        for (auto& [hash, entity] : registry_) {
            if (entity.syncState == SyncState::LIVE || entity.syncState == SyncState::FAST_FORWARDING) {
                auto delta = computeDelta(hash, entity.lastConfirmedTransform, entity.transform, entity.updateSequence);
                if (delta.fieldCount() > 0) {
                    deltas.push_back(delta);
                }
            }
        }
        return deltas;
    }

    int computeWorldDeltaTotalBytes() {
        auto deltas = computeWorldDelta();
        int total = 0;
        for (const auto& d : deltas) {
            total += d.estimatedBytes();
        }
        return total;
    }

    FEntityTransform applyDelta(const FEntityTransform& base, const FDeltaPacket& delta) {
        FEntityTransform result = base;
        for (const auto& field : delta.fields) {
            float val = std::stof(field.newValue);
            if (field.fieldName == "posX") result.posX = val;
            else if (field.fieldName == "posY") result.posY = val;
            else if (field.fieldName == "posZ") result.posZ = val;
            else if (field.fieldName == "rotX") result.rotX = val;
            else if (field.fieldName == "rotY") result.rotY = val;
            else if (field.fieldName == "rotZ") result.rotZ = val;
            else if (field.fieldName == "rotW") result.rotW = val;
            else if (field.fieldName == "scaleX") result.scaleX = val;
            else if (field.fieldName == "scaleY") result.scaleY = val;
            else if (field.fieldName == "scaleZ") result.scaleZ = val;
            else if (field.fieldName == "velocityX") result.velocityX = val;
            else if (field.fieldName == "velocityY") result.velocityY = val;
            else if (field.fieldName == "velocityZ") result.velocityZ = val;
        }
        return result;
    }

    void markEntityGhost(const std::string& entityHash) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return;

        auto& entity = it->second;
        entity.syncState = SyncState::GHOST;
        entity.syncStateName = "GHOST";

        {
            std::lock_guard<std::mutex> slock(statsMutex_);
            stats_.ghostEntities++;
        }
    }

    FGhostReconciliation beginGhostReconciliation(const std::string& entityHash,
                                                    const FEntityTransform& currentServerTransform) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto it = registry_.find(entityHash);
        FGhostReconciliation recon;

        if (it == registry_.end()) {
            recon.entityHash = entityHash;
            recon.isComplete = true;
            return recon;
        }

        auto& entity = it->second;
        recon.entityHash = entityHash;
        recon.ghostTransform = entity.transform;
        recon.currentTransform = currentServerTransform;
        recon.disconnectTimestamp = entity.lastUpdateTimestamp;
        recon.reconnectTimestamp = std::time(nullptr);
        recon.missedUpdates = 0;
        recon.interpolationProgress = 0.0f;
        recon.isComplete = false;

        entity.syncState = SyncState::FAST_FORWARDING;
        entity.syncStateName = "FAST_FORWARDING";
        entity.lastConfirmedTransform = entity.transform;

        {
            std::lock_guard<std::mutex> rlock(reconMutex_);
            activeReconciliations_[entityHash] = recon;
        }

        return recon;
    }

    FGhostReconciliation stepReconciliation(const std::string& entityHash) {
        FGhostReconciliation resultCopy;
        NexusGhostReconciledDelegate delegateCopy;
        bool completed = false;

        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            std::lock_guard<std::mutex> rlock(reconMutex_);
            auto it = activeReconciliations_.find(entityHash);
            if (it == activeReconciliations_.end()) {
                FGhostReconciliation empty;
                empty.entityHash = entityHash;
                empty.isComplete = true;
                return empty;
            }

            auto& recon = it->second;
            float stepSize;
            { std::lock_guard<std::mutex> cg(configMutex_); stepSize = config_.reconciliationStepSize; }
            recon.interpolationProgress += stepSize;
            if (recon.interpolationProgress >= 1.0f) {
                recon.interpolationProgress = 1.0f;
                recon.isComplete = true;
                completed = true;

                auto eit = registry_.find(entityHash);
                if (eit != registry_.end()) {
                    eit->second.transform = recon.currentTransform;
                    eit->second.syncState = SyncState::LIVE;
                    eit->second.syncStateName = "LIVE";
                    eit->second.updateHash();
                }

                {
                    std::lock_guard<std::mutex> slock(statsMutex_);
                    stats_.totalGhostReconciled++;
                    stats_.ghostEntities = std::max(0, stats_.ghostEntities - 1);
                }

                resultCopy = recon;
                activeReconciliations_.erase(it);
                { std::lock_guard<std::mutex> dg(delegateMutex_); delegateCopy = ghostReconciledDelegate_; }
            } else {
                resultCopy = recon;
            }
        }

        if (completed && delegateCopy) {
            delegateCopy(resultCopy);
        }

        return resultCopy;
    }

    void heartbeat(const std::string& entityHash) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto it = registry_.find(entityHash);
        if (it != registry_.end()) {
            it->second.lastHeartbeatTimestamp = std::time(nullptr);
            if (it->second.syncState == SyncState::STALE) {
                it->second.syncState = SyncState::LIVE;
                it->second.syncStateName = "LIVE";
            }
        }
    }

    int sweepStaleEntities(int64_t currentTimestamp = 0) {
        if (currentTimestamp == 0) currentTimestamp = std::time(nullptr);
        float staleTh, ghostTh;
        { std::lock_guard<std::mutex> cg(configMutex_); staleTh = config_.staleThresholdMs; ghostTh = config_.ghostThresholdMs; }

        std::lock_guard<std::mutex> lock(registryMutex_);
        int swept = 0;

        for (auto& [hash, entity] : registry_) {
            float elapsedMs = static_cast<float>(currentTimestamp - entity.lastHeartbeatTimestamp) * 1000.0f;

            if (entity.syncState == SyncState::LIVE && elapsedMs > staleTh) {
                entity.syncState = SyncState::STALE;
                entity.syncStateName = "STALE";
                swept++;
            }

            if (entity.syncState == SyncState::STALE && elapsedMs > ghostTh) {
                entity.syncState = SyncState::GHOST;
                entity.syncStateName = "GHOST";

                std::lock_guard<std::mutex> slock(statsMutex_);
                stats_.ghostEntities++;
            }
        }

        return swept;
    }

    FConflictEvent resolveConflict(const std::string& entityHash,
                                    const std::string& writerA, int64_t tsA,
                                    const std::string& writerB, int64_t tsB,
                                    ConflictResolution strategy = ConflictResolution::LWW_TIMESTAMP) {
        FConflictEvent event;
        event.entityHash = entityHash;
        event.writerA = writerA;
        event.writerB = writerB;
        event.timestampA = tsA;
        event.timestampB = tsB;
        event.resolution = strategy;
        event.resolutionName = conflictResolutionToString(strategy);
        event.resolvedTimestamp = std::time(nullptr);

        switch (strategy) {
            case ConflictResolution::LWW_TIMESTAMP:
                event.winner = (tsA >= tsB) ? writerA : writerB;
                break;
            case ConflictResolution::PRIORITY_AUTHORITY: {
                std::lock_guard<std::mutex> lock(registryMutex_);
                auto it = registry_.find(entityHash);
                if (it != registry_.end()) {
                    event.winner = (it->second.ownerIdentity == writerA) ? writerA : writerB;
                } else {
                    event.winner = writerA;
                }
                break;
            }
            case ConflictResolution::REJECT_BOTH:
                event.winner = "";
                break;
            default:
                event.winner = (tsA >= tsB) ? writerA : writerB;
        }

        int maxLog;
        { std::lock_guard<std::mutex> cg(configMutex_); maxLog = config_.maxConflictLogSize; }

        {
            std::lock_guard<std::mutex> clock(conflictMutex_);
            conflictLog_.push_back(event);
            if (static_cast<int>(conflictLog_.size()) > maxLog) {
                conflictLog_.pop_front();
            }
        }

        {
            std::lock_guard<std::mutex> slock(statsMutex_);
            stats_.totalConflictsResolved++;
        }

        NexusConflictResolvedDelegate delegateCopy;
        { std::lock_guard<std::mutex> dg(delegateMutex_); delegateCopy = conflictResolvedDelegate_; }

        if (delegateCopy) {
            delegateCopy(event);
        }

        return event;
    }

    FNexusEntity getEntity(const std::string& entityHash) {
        std::lock_guard<std::mutex> lock(registryMutex_);
        auto it = registry_.find(entityHash);
        if (it != registry_.end()) return it->second;
        FNexusEntity empty;
        empty.entityHash = entityHash;
        return empty;
    }

    int entityCount() {
        std::lock_guard<std::mutex> lock(registryMutex_);
        return static_cast<int>(registry_.size());
    }

    std::vector<std::string> getEntityHashes() {
        std::lock_guard<std::mutex> lock(registryMutex_);
        std::vector<std::string> hashes;
        hashes.reserve(registry_.size());
        for (const auto& [hash, _] : registry_) {
            hashes.push_back(hash);
        }
        return hashes;
    }

    std::vector<FConflictEvent> getConflictLog() {
        std::lock_guard<std::mutex> lock(conflictMutex_);
        return std::vector<FConflictEvent>(conflictLog_.begin(), conflictLog_.end());
    }

    void setConfig(const FNexusConfig& config) { std::lock_guard<std::mutex> cg(configMutex_); config_ = config; }
    FNexusConfig getConfig() const { std::lock_guard<std::mutex> cg(configMutex_); return config_; }

    void onEntityRegistered(NexusEntityRegisteredDelegate d) { std::lock_guard<std::mutex> dg(delegateMutex_); entityRegisteredDelegate_ = d; }
    void onConflictResolved(NexusConflictResolvedDelegate d) { std::lock_guard<std::mutex> dg(delegateMutex_); conflictResolvedDelegate_ = d; }
    void onGhostReconciled(NexusGhostReconciledDelegate d)   { std::lock_guard<std::mutex> dg(delegateMutex_); ghostReconciledDelegate_ = d; }
    void onEntityEvicted(NexusEntityEvictedDelegate d)        { std::lock_guard<std::mutex> dg(delegateMutex_); entityEvictedDelegate_ = d; }

    FNexusStats getStats() {
        std::lock_guard<std::mutex> lock(statsMutex_);
        return stats_;
    }

    void resetStats() {
        {
            std::lock_guard<std::mutex> lock(registryMutex_);
            registry_.clear();
        }
        {
            std::lock_guard<std::mutex> lock(conflictMutex_);
            conflictLog_.clear();
        }
        {
            std::lock_guard<std::mutex> lock(reconMutex_);
            activeReconciliations_.clear();
        }
        {
            std::lock_guard<std::mutex> lock(statsMutex_);
            stats_ = FNexusStats();
        }
    }

    std::string exportStatsJSON() const {
        std::lock_guard<std::mutex> lock(statsMutex_);
        std::ostringstream oss;
        oss << "{\"activeEntities\":" << stats_.activeEntities
            << ",\"avgDeltaBytesPerUpdate\":" << std::fixed << std::setprecision(2) << stats_.avgDeltaBytesPerUpdate
            << ",\"dormantEntities\":" << stats_.dormantEntities
            << ",\"ghostEntities\":" << stats_.ghostEntities
            << ",\"proxyEntities\":" << stats_.proxyEntities
            << ",\"sovereignEntities\":" << stats_.sovereignEntities
            << ",\"totalConflictsResolved\":" << stats_.totalConflictsResolved
            << ",\"totalDeltaBytes\":" << stats_.totalDeltaBytes
            << ",\"totalDeltasGenerated\":" << stats_.totalDeltasGenerated
            << ",\"totalEntitiesEvicted\":" << stats_.totalEntitiesEvicted
            << ",\"totalEntitiesRegistered\":" << stats_.totalEntitiesRegistered
            << ",\"totalGhostReconciled\":" << stats_.totalGhostReconciled
            << ",\"totalUpdatesProcessed\":" << stats_.totalUpdatesProcessed
            << "}";
        return oss.str();
    }

    std::string generateUE5NexusCode() const {
        std::ostringstream oss;
        oss << "// Auto-generated UE5 Sovereign Nexus\n";
        oss << "#pragma once\n\n";
        oss << "#include \"CoreMinimal.h\"\n";
        oss << "#include \"SovereignNexus.generated.h\"\n\n";

        oss << "UENUM(BlueprintType)\n";
        oss << "enum class ESovereignEntityAuthority : uint8 {\n";
        oss << "    SOVEREIGN    UMETA(DisplayName = \"Sovereign\"),\n";
        oss << "    PROXY        UMETA(DisplayName = \"Proxy\"),\n";
        oss << "    DORMANT      UMETA(DisplayName = \"Dormant\"),\n";
        oss << "    CONTESTED    UMETA(DisplayName = \"Contested\")\n";
        oss << "};\n\n";

        oss << "UENUM(BlueprintType)\n";
        oss << "enum class ESovereignSyncState : uint8 {\n";
        oss << "    LIVE             UMETA(DisplayName = \"Live\"),\n";
        oss << "    STALE            UMETA(DisplayName = \"Stale\"),\n";
        oss << "    GHOST            UMETA(DisplayName = \"Ghost\"),\n";
        oss << "    FAST_FORWARDING  UMETA(DisplayName = \"Fast Forwarding\"),\n";
        oss << "    DISCONNECTED     UMETA(DisplayName = \"Disconnected\")\n";
        oss << "};\n\n";

        oss << "USTRUCT(BlueprintType)\n";
        oss << "struct FSovereignEntityTransform {\n";
        oss << "    GENERATED_BODY()\n\n";
        oss << "    UPROPERTY(BlueprintReadWrite) FVector Position;\n";
        oss << "    UPROPERTY(BlueprintReadWrite) FQuat Rotation;\n";
        oss << "    UPROPERTY(BlueprintReadWrite) FVector Scale;\n";
        oss << "    UPROPERTY(BlueprintReadWrite) FVector Velocity;\n";
        oss << "};\n\n";

        oss << "USTRUCT(BlueprintType)\n";
        oss << "struct FSovereignDeltaPacket {\n";
        oss << "    GENERATED_BODY()\n\n";
        oss << "    UPROPERTY(BlueprintReadOnly) FString EntityHash;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) int32 FieldCount;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) int32 EstimatedBytes;\n";
        oss << "    UPROPERTY(BlueprintReadOnly) int32 SequenceNumber;\n";
        oss << "};\n\n";

        oss << "UCLASS(BlueprintType)\n";
        oss << "class USovereignNexus : public UObject {\n";
        oss << "    GENERATED_BODY()\n";
        oss << "public:\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Nexus\")\n";
        oss << "    bool RegisterEntity(const FString& EntityHash, const FString& OwnerIdentity,\n";
        oss << "        ESovereignEntityAuthority Authority);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Nexus\")\n";
        oss << "    bool UpdateEntityTransform(const FString& EntityHash,\n";
        oss << "        const FSovereignEntityTransform& Transform, const FString& WriterIdentity);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Nexus\")\n";
        oss << "    FSovereignDeltaPacket ComputeDelta(const FString& EntityHash);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Nexus\")\n";
        oss << "    void BeginGhostReconciliation(const FString& EntityHash);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Nexus\")\n";
        oss << "    void StepReconciliation(const FString& EntityHash);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Nexus\")\n";
        oss << "    void Heartbeat(const FString& EntityHash);\n\n";
        oss << "    UFUNCTION(BlueprintCallable, Category = \"Sovereign|Nexus\")\n";
        oss << "    int32 SweepStaleEntities();\n\n";
        oss << "    UFUNCTION(BlueprintPure, Category = \"Sovereign|Nexus\")\n";
        oss << "    int32 GetEntityCount() const;\n";
        oss << "};\n";

        return oss.str();
    }

private:
    SovereignNexus() = default;
    SovereignNexus(const SovereignNexus&) = delete;
    SovereignNexus& operator=(const SovereignNexus&) = delete;

    mutable std::mutex registryMutex_;
    mutable std::mutex statsMutex_;
    mutable std::mutex configMutex_;
    mutable std::mutex delegateMutex_;
    std::mutex conflictMutex_;
    std::mutex reconMutex_;

    std::unordered_map<std::string, FNexusEntity> registry_;
    std::deque<FConflictEvent> conflictLog_;
    std::unordered_map<std::string, FGhostReconciliation> activeReconciliations_;
    FNexusConfig config_;
    FNexusStats stats_;

    NexusEntityRegisteredDelegate entityRegisteredDelegate_;
    NexusConflictResolvedDelegate conflictResolvedDelegate_;
    NexusGhostReconciledDelegate  ghostReconciledDelegate_;
    NexusEntityEvictedDelegate    entityEvictedDelegate_;

    static std::string floatToStr(float v) {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(6) << v;
        return oss.str();
    }
};

}
