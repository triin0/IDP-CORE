#pragma once

#include "SovereignSerializer.h"
#include "SovereignTransport.h"
#include "SovereignSpawner.h"
#include "ChronosEngine.h"
#include <string>
#include <map>
#include <vector>
#include <mutex>
#include <functional>
#include <algorithm>
#include <ctime>
#include <cmath>
#include <sstream>
#include <iomanip>

namespace Sovereign {

enum class OwnershipLockState {
    UNLOCKED,
    LOCKED_OWNER,
    LOCKED_LISTING,
    LOCKED_TRADE
};

enum class TradeStatus {
    PENDING_SELLER,
    PENDING_BUYER,
    COMMITTED,
    EXECUTED,
    CANCELLED,
    EXPIRED,
    FAILED
};

struct FOwnershipRecord {
    std::string entityHash;
    std::string ownerIdentity;
    std::string previousOwner;
    OwnershipLockState lockState = OwnershipLockState::UNLOCKED;
    int64_t acquiredTimestamp = 0;
    int64_t lockTimestamp = 0;
    std::string lockReason;
    std::string ownershipHash;
    int transferCount = 0;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"acquiredTimestamp\":" << acquiredTimestamp
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"lockState\":" << static_cast<int>(lockState)
            << ",\"ownerIdentity\":\"" << ownerIdentity << "\""
            << ",\"previousOwner\":\"" << previousOwner << "\""
            << ",\"transferCount\":" << transferCount
            << "}";
        return oss.str();
    }

    std::string computeOwnershipHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void updateHash() {
        ownershipHash = computeOwnershipHash();
    }

    bool verifyIntegrity() const {
        return !ownershipHash.empty() && ownershipHash == computeOwnershipHash();
    }
};

struct FTradeCommitSell {
    std::string sellerIdentity;
    std::string entityHash;
    int64_t priceCredits;
    int64_t timestamp;
    std::string commitHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"entityHash\":\"" << entityHash << "\""
            << ",\"priceCredits\":" << priceCredits
            << ",\"sellerIdentity\":\"" << sellerIdentity << "\""
            << ",\"timestamp\":" << timestamp
            << "}";
        return oss.str();
    }

    std::string computeCommitHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void sign() {
        commitHash = computeCommitHash();
    }

    bool verifySignature() const {
        return !commitHash.empty() && commitHash == computeCommitHash();
    }
};

struct FTradeCommitBuy {
    std::string buyerIdentity;
    std::string entityHash;
    int64_t creditsOffered;
    int64_t timestamp;
    std::string commitHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"buyerIdentity\":\"" << buyerIdentity << "\""
            << ",\"creditsOffered\":" << creditsOffered
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"timestamp\":" << timestamp
            << "}";
        return oss.str();
    }

    std::string computeCommitHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void sign() {
        commitHash = computeCommitHash();
    }

    bool verifySignature() const {
        return !commitHash.empty() && commitHash == computeCommitHash();
    }
};

struct FTransactionRecord {
    std::string transactionId;
    std::string entityHash;
    std::string sellerIdentity;
    std::string buyerIdentity;
    int64_t priceCredits;
    int64_t royaltyCredits;
    std::string genesisArchitect;
    int royaltyBps;
    int64_t timestamp;
    std::string sellCommitHash;
    std::string buyCommitHash;
    TradeStatus status;
    std::string transactionHash;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"buyCommitHash\":\"" << buyCommitHash << "\""
            << ",\"buyerIdentity\":\"" << buyerIdentity << "\""
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"genesisArchitect\":\"" << genesisArchitect << "\""
            << ",\"priceCredits\":" << priceCredits
            << ",\"royaltyBps\":" << royaltyBps
            << ",\"royaltyCredits\":" << royaltyCredits
            << ",\"sellCommitHash\":\"" << sellCommitHash << "\""
            << ",\"sellerIdentity\":\"" << sellerIdentity << "\""
            << ",\"timestamp\":" << timestamp
            << ",\"transactionId\":\"" << transactionId << "\""
            << "}";
        return oss.str();
    }

    std::string computeTransactionHash() const {
        return SovereignSHA256::hash(canonicalize());
    }

    void seal() {
        transactionHash = computeTransactionHash();
    }

    bool verifyIntegrity() const {
        return !transactionHash.empty() && transactionHash == computeTransactionHash();
    }
};

struct FMarketplaceListing {
    std::string entityHash;
    std::string sellerIdentity;
    int64_t askPrice;
    int64_t listedTimestamp;
    bool active = true;
    std::string listingHash;
    std::string phenotypeClassName;
    std::string meshFamilyName;
    int generation;
    int totalMutations;
    std::string genesisArchitect;
    int royaltyBps;

    std::string canonicalize() const {
        std::ostringstream oss;
        oss << "{\"askPrice\":" << askPrice
            << ",\"entityHash\":\"" << entityHash << "\""
            << ",\"listedTimestamp\":" << listedTimestamp
            << ",\"sellerIdentity\":\"" << sellerIdentity << "\""
            << "}";
        return oss.str();
    }

    void seal() {
        listingHash = SovereignSHA256::hash(canonicalize());
    }

    bool verifyIntegrity() const {
        return !listingHash.empty() && listingHash == SovereignSHA256::hash(canonicalize());
    }
};

struct OwnershipStats {
    int totalEntitiesOwned = 0;
    int totalTransfers = 0;
    int totalListings = 0;
    int totalTradesExecuted = 0;
    int totalTradesFailed = 0;
    int totalTradesCancelled = 0;
    int64_t totalRoyaltiesCollected = 0;
    int64_t totalVolumeTraded = 0;
};

using OwnershipTransferDelegate = std::function<void(const FOwnershipRecord&, const std::string& fromOwner, const std::string& toOwner)>;
using TradeExecutedDelegate = std::function<void(const FTransactionRecord&)>;
using ListingCreatedDelegate = std::function<void(const FMarketplaceListing&)>;
using RoyaltyCollectedDelegate = std::function<void(const std::string& genesisArchitect, int64_t amount, const std::string& entityHash)>;

class USovereignOwnershipComponent {
public:
    static USovereignOwnershipComponent& Get() {
        static USovereignOwnershipComponent instance;
        return instance;
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        registry_.clear();
        stats_ = OwnershipStats{};
        ownershipTransferDelegate_ = nullptr;
    }

    bool claimOwnership(const std::string& entityHash, const std::string& ownerIdentity) {
        std::lock_guard<std::mutex> lock(mutex_);

        auto it = registry_.find(entityHash);
        if (it != registry_.end() && !it->second.ownerIdentity.empty()) {
            return false;
        }

        FOwnershipRecord record;
        record.entityHash = entityHash;
        record.ownerIdentity = ownerIdentity;
        record.lockState = OwnershipLockState::LOCKED_OWNER;
        record.acquiredTimestamp = currentTimestamp();
        record.lockTimestamp = record.acquiredTimestamp;
        record.lockReason = "initial_claim";
        record.transferCount = 0;
        record.updateHash();

        registry_[entityHash] = record;
        stats_.totalEntitiesOwned++;

        return true;
    }

    bool isOwnedBy(const std::string& entityHash, const std::string& identity) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return false;
        return it->second.ownerIdentity == identity;
    }

    bool isOwned(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return false;
        return !it->second.ownerIdentity.empty();
    }

    bool canInteract(const std::string& entityHash, const std::string& sessionUserId) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return true;
        if (it->second.ownerIdentity.empty()) return true;
        if (it->second.ownerIdentity == sessionUserId) return true;
        if (it->second.lockState == OwnershipLockState::UNLOCKED) return true;
        return false;
    }

    bool transferOwnership(const std::string& entityHash,
                            const std::string& fromOwner,
                            const std::string& toOwner,
                            bool bypassTradeLock = false) {
        OwnershipTransferDelegate delegateCopy;
        FOwnershipRecord recordCopy;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = registry_.find(entityHash);
            if (it == registry_.end()) return false;
            if (it->second.ownerIdentity != fromOwner) return false;
            if (!bypassTradeLock && it->second.lockState == OwnershipLockState::LOCKED_TRADE) return false;

            it->second.previousOwner = fromOwner;
            it->second.ownerIdentity = toOwner;
            it->second.acquiredTimestamp = currentTimestamp();
            it->second.transferCount++;
            it->second.lockState = OwnershipLockState::LOCKED_OWNER;
            it->second.lockTimestamp = currentTimestamp();
            it->second.lockReason = bypassTradeLock ? "atomic_swap_transfer" : "transfer";
            it->second.updateHash();

            stats_.totalTransfers++;

            recordCopy = it->second;
            delegateCopy = ownershipTransferDelegate_;
        }

        if (delegateCopy) {
            delegateCopy(recordCopy, fromOwner, toOwner);
        }

        return true;
    }

    bool lockForListing(const std::string& entityHash, const std::string& ownerIdentity) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return false;
        if (it->second.ownerIdentity != ownerIdentity) return false;
        if (it->second.lockState == OwnershipLockState::LOCKED_TRADE) return false;
        if (it->second.lockState == OwnershipLockState::LOCKED_LISTING) return false;

        it->second.lockState = OwnershipLockState::LOCKED_LISTING;
        it->second.lockTimestamp = currentTimestamp();
        it->second.lockReason = "marketplace_listing";
        it->second.updateHash();
        return true;
    }

    bool lockForTrade(const std::string& entityHash) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return false;

        it->second.lockState = OwnershipLockState::LOCKED_TRADE;
        it->second.lockTimestamp = currentTimestamp();
        it->second.lockReason = "atomic_swap";
        it->second.updateHash();
        return true;
    }

    bool unlockEntity(const std::string& entityHash, const std::string& ownerIdentity) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return false;
        if (it->second.ownerIdentity != ownerIdentity) return false;

        it->second.lockState = OwnershipLockState::UNLOCKED;
        it->second.lockTimestamp = currentTimestamp();
        it->second.lockReason = "unlocked_by_owner";
        it->second.updateHash();
        return true;
    }

    FOwnershipRecord getOwnership(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return FOwnershipRecord{};
        return it->second;
    }

    std::vector<FOwnershipRecord> getOwnedEntities(const std::string& ownerIdentity) const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<FOwnershipRecord> result;
        for (const auto& pair : registry_) {
            if (pair.second.ownerIdentity == ownerIdentity) {
                result.push_back(pair.second);
            }
        }
        return result;
    }

    bool verifyOwnershipIntegrity(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = registry_.find(entityHash);
        if (it == registry_.end()) return false;
        return it->second.verifyIntegrity();
    }

    bool persistOwnership(const std::string& entityHash) {
        FOwnershipRecord recordCopy;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = registry_.find(entityHash);
            if (it == registry_.end()) return false;
            recordCopy = it->second;
        }

        auto& chronos = ChronosEngine::Get();
        JsonValue payload(std::map<std::string, JsonValue>{
            {"entityHash", JsonValue(recordCopy.entityHash)},
            {"ownerIdentity", JsonValue(recordCopy.ownerIdentity)},
            {"previousOwner", JsonValue(recordCopy.previousOwner)},
            {"lockState", JsonValue(static_cast<int64_t>(recordCopy.lockState))},
            {"acquiredTimestamp", JsonValue(recordCopy.acquiredTimestamp)},
            {"transferCount", JsonValue(static_cast<int64_t>(recordCopy.transferCount))},
            {"ownershipHash", JsonValue(recordCopy.ownershipHash)}
        });

        std::string chronosKey = "ownership:" + entityHash.substr(0, 16);
        chronos.enqueue(chronosKey, payload, recordCopy.transferCount, "ownership-system");

        return true;
    }

    FOwnershipRecord recoverOwnership(const std::string& entityHash) {
        std::lock_guard<std::mutex> lock(mutex_);

        auto& chronos = ChronosEngine::Get();
        const auto& entries = chronos.getEntries();
        std::string chronosKey = "ownership:" + entityHash.substr(0, 16);
        const ChronosQueueEntry* latest = nullptr;

        for (const auto& entry : entries) {
            if (entry.entityKey == chronosKey) {
                if (!latest || entry.timestamp > latest->timestamp) {
                    latest = &entry;
                }
            }
        }

        FOwnershipRecord record;
        record.entityHash = entityHash;

        if (latest) {
            record = parseOwnershipFromJson(latest->payloadJson, entityHash);
            registry_[entityHash] = record;
        }

        return record;
    }

    OwnershipStats stats() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    std::map<std::string, FOwnershipRecord> registry() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return registry_;
    }

    void onOwnershipTransfer(OwnershipTransferDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        ownershipTransferDelegate_ = std::move(delegate);
    }

private:
    USovereignOwnershipComponent() = default;
    USovereignOwnershipComponent(const USovereignOwnershipComponent&) = delete;
    USovereignOwnershipComponent& operator=(const USovereignOwnershipComponent&) = delete;

    static int64_t currentTimestamp() {
        return static_cast<int64_t>(std::time(nullptr));
    }

    FOwnershipRecord parseOwnershipFromJson(const std::string& json, const std::string& entityHash) const {
        FOwnershipRecord record;
        record.entityHash = entityHash;

        auto extractStr = [&](const std::string& key) -> std::string {
            std::string search = "\"" + key + "\":\"";
            auto pos = json.find(search);
            if (pos == std::string::npos) return "";
            pos += search.size();
            auto end = json.find("\"", pos);
            if (end == std::string::npos) return "";
            return json.substr(pos, end - pos);
        };

        auto extractInt = [&](const std::string& key) -> int64_t {
            std::string search = "\"" + key + "\":";
            auto pos = json.find(search);
            if (pos == std::string::npos) return 0;
            pos += search.size();
            while (pos < json.size() && json[pos] == ' ') pos++;
            std::string num;
            while (pos < json.size() && (json[pos] == '-' || (json[pos] >= '0' && json[pos] <= '9'))) {
                num += json[pos++];
            }
            return num.empty() ? 0 : std::stoll(num);
        };

        record.ownerIdentity = extractStr("ownerIdentity");
        record.previousOwner = extractStr("previousOwner");
        record.ownershipHash = extractStr("ownershipHash");
        record.acquiredTimestamp = extractInt("acquiredTimestamp");
        record.transferCount = static_cast<int>(extractInt("transferCount"));
        record.lockState = static_cast<OwnershipLockState>(extractInt("lockState"));

        return record;
    }

    mutable std::mutex mutex_;
    std::map<std::string, FOwnershipRecord> registry_;
    OwnershipStats stats_;
    OwnershipTransferDelegate ownershipTransferDelegate_;
};

struct GeneticTaxConfig {
    int royaltyBps = 300;
    int minRoyaltyBps = 200;
    int maxRoyaltyBps = 500;
    std::string genesisArchitectId = "50529956";

    int64_t computeRoyalty(int64_t tradePrice) const {
        int effectiveBps = std::max(minRoyaltyBps, std::min(maxRoyaltyBps, royaltyBps));
        int64_t royalty = (tradePrice * effectiveBps + 9999) / 10000;
        return std::max(static_cast<int64_t>(1), royalty);
    }

    int effectiveBps() const {
        return std::max(minRoyaltyBps, std::min(maxRoyaltyBps, royaltyBps));
    }
};

struct AtomicSwapResult {
    bool success;
    std::string error;
    FTransactionRecord transaction;
    int64_t sellerProceeds;
    int64_t royaltyPaid;
    int64_t buyerCost;
};

class AtomicSwapEngine {
public:
    static AtomicSwapEngine& Get() {
        static AtomicSwapEngine instance;
        return instance;
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        pendingSells_.clear();
        pendingBuys_.clear();
        transactionHistory_.clear();
        stats_ = OwnershipStats{};
        tradeExecutedDelegate_ = nullptr;
        royaltyCollectedDelegate_ = nullptr;
    }

    void configureGenesisTax(const GeneticTaxConfig& config) {
        std::lock_guard<std::mutex> lock(mutex_);
        taxConfig_ = config;
    }

    GeneticTaxConfig getTaxConfig() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return taxConfig_;
    }

    bool commitSell(const FTradeCommitSell& commit) {
        std::lock_guard<std::mutex> lock(mutex_);

        if (commit.entityHash.empty() || commit.sellerIdentity.empty()) return false;
        if (commit.priceCredits <= 0) return false;
        if (!commit.verifySignature()) return false;

        auto& ownership = USovereignOwnershipComponent::Get();
        if (!ownership.isOwnedBy(commit.entityHash, commit.sellerIdentity)) return false;

        pendingSells_[commit.entityHash] = commit;
        return true;
    }

    bool commitBuy(const FTradeCommitBuy& commit) {
        std::lock_guard<std::mutex> lock(mutex_);

        if (commit.entityHash.empty() || commit.buyerIdentity.empty()) return false;
        if (commit.creditsOffered <= 0) return false;
        if (!commit.verifySignature()) return false;

        pendingBuys_[commit.entityHash] = commit;
        return true;
    }

    bool cancelSell(const std::string& entityHash, const std::string& sellerIdentity) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = pendingSells_.find(entityHash);
        if (it == pendingSells_.end()) return false;
        if (it->second.sellerIdentity != sellerIdentity) return false;

        pendingSells_.erase(it);
        stats_.totalTradesCancelled++;

        auto& ownership = USovereignOwnershipComponent::Get();
        ownership.unlockEntity(entityHash, sellerIdentity);

        return true;
    }

    AtomicSwapResult executeSwap(const std::string& entityHash) {
        TradeExecutedDelegate tradeDelegateCopy;
        RoyaltyCollectedDelegate royaltyDelegateCopy;
        AtomicSwapResult result;
        result.success = false;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            auto sellIt = pendingSells_.find(entityHash);
            if (sellIt == pendingSells_.end()) {
                result.error = "NO_SELL_COMMIT";
                stats_.totalTradesFailed++;
                return result;
            }

            auto buyIt = pendingBuys_.find(entityHash);
            if (buyIt == pendingBuys_.end()) {
                result.error = "NO_BUY_COMMIT";
                stats_.totalTradesFailed++;
                return result;
            }

            const auto& sell = sellIt->second;
            const auto& buy = buyIt->second;

            if (sell.entityHash != buy.entityHash) {
                result.error = "ENTITY_HASH_MISMATCH";
                stats_.totalTradesFailed++;
                return result;
            }

            if (!sell.verifySignature()) {
                result.error = "INVALID_SELL_SIGNATURE";
                stats_.totalTradesFailed++;
                return result;
            }

            if (!buy.verifySignature()) {
                result.error = "INVALID_BUY_SIGNATURE";
                stats_.totalTradesFailed++;
                return result;
            }

            if (buy.creditsOffered < sell.priceCredits) {
                result.error = "INSUFFICIENT_CREDITS";
                stats_.totalTradesFailed++;
                return result;
            }

            if (sell.sellerIdentity == buy.buyerIdentity) {
                result.error = "SELF_TRADE_PROHIBITED";
                stats_.totalTradesFailed++;
                return result;
            }

            int64_t tradePrice = sell.priceCredits;
            int64_t royalty = taxConfig_.computeRoyalty(tradePrice);
            int64_t sellerProceeds = tradePrice - royalty;

            FTransactionRecord tx;
            tx.transactionId = generateTransactionId(sell, buy);
            tx.entityHash = entityHash;
            tx.sellerIdentity = sell.sellerIdentity;
            tx.buyerIdentity = buy.buyerIdentity;
            tx.priceCredits = sell.priceCredits;
            tx.royaltyCredits = royalty;
            tx.genesisArchitect = taxConfig_.genesisArchitectId;
            tx.royaltyBps = taxConfig_.effectiveBps();
            tx.timestamp = currentTimestamp();
            tx.sellCommitHash = sell.commitHash;
            tx.buyCommitHash = buy.commitHash;
            tx.status = TradeStatus::EXECUTED;
            tx.seal();

            auto& ownership = USovereignOwnershipComponent::Get();
            ownership.lockForTrade(entityHash);

            bool transferred = ownership.transferOwnership(
                entityHash, sell.sellerIdentity, buy.buyerIdentity, true);

            if (!transferred) {
                ownership.unlockEntity(entityHash, sell.sellerIdentity);
                result.error = "TRANSFER_FAILED";
                tx.status = TradeStatus::FAILED;
                tx.seal();
                stats_.totalTradesFailed++;
                return result;
            }

            transactionHistory_.push_back(tx);
            stats_.totalTradesExecuted++;
            stats_.totalRoyaltiesCollected += royalty;
            stats_.totalVolumeTraded += sell.priceCredits;

            flushTransactionToChronos(tx);

            pendingSells_.erase(sellIt);
            pendingBuys_.erase(buyIt);

            result.success = true;
            result.transaction = tx;
            result.sellerProceeds = sellerProceeds;
            result.royaltyPaid = royalty;
            result.buyerCost = tradePrice;

            tradeDelegateCopy = tradeExecutedDelegate_;
            royaltyDelegateCopy = royaltyCollectedDelegate_;
        }

        if (tradeDelegateCopy) {
            tradeDelegateCopy(result.transaction);
        }
        if (royaltyDelegateCopy && result.royaltyPaid > 0) {
            royaltyDelegateCopy(result.transaction.genesisArchitect,
                                result.royaltyPaid,
                                entityHash);
        }

        return result;
    }

    std::vector<FTransactionRecord> getTransactionHistory() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return transactionHistory_;
    }

    std::vector<FTransactionRecord> getEntityTransactions(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<FTransactionRecord> result;
        for (const auto& tx : transactionHistory_) {
            if (tx.entityHash == entityHash) {
                result.push_back(tx);
            }
        }
        return result;
    }

    std::vector<FTransactionRecord> getUserTransactions(const std::string& userId) const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<FTransactionRecord> result;
        for (const auto& tx : transactionHistory_) {
            if (tx.sellerIdentity == userId || tx.buyerIdentity == userId) {
                result.push_back(tx);
            }
        }
        return result;
    }

    bool hasPendingSell(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        return pendingSells_.find(entityHash) != pendingSells_.end();
    }

    bool hasPendingBuy(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        return pendingBuys_.find(entityHash) != pendingBuys_.end();
    }

    OwnershipStats stats() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    void onTradeExecuted(TradeExecutedDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        tradeExecutedDelegate_ = std::move(delegate);
    }

    void onRoyaltyCollected(RoyaltyCollectedDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        royaltyCollectedDelegate_ = std::move(delegate);
    }

    bool verifyDeterminism(const std::string& entityHash,
                            const std::string& sellerIdentity,
                            const std::string& buyerIdentity,
                            int64_t price,
                            const std::string& seed) {
        reset();
        USovereignOwnershipComponent::Get().reset();

        USovereignOwnershipComponent::Get().claimOwnership(entityHash, sellerIdentity);

        FTradeCommitSell sell;
        sell.sellerIdentity = sellerIdentity;
        sell.entityHash = entityHash;
        sell.priceCredits = price;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = buyerIdentity;
        buy.entityHash = entityHash;
        buy.creditsOffered = price;
        buy.timestamp = 1000001;
        buy.sign();

        commitSell(sell);
        commitBuy(buy);
        auto r1 = executeSwap(entityHash);

        std::string hash1 = r1.transaction.transactionHash;

        reset();
        USovereignOwnershipComponent::Get().reset();

        USovereignOwnershipComponent::Get().claimOwnership(entityHash, sellerIdentity);

        FTradeCommitSell sell2;
        sell2.sellerIdentity = sellerIdentity;
        sell2.entityHash = entityHash;
        sell2.priceCredits = price;
        sell2.timestamp = 1000000;
        sell2.sign();

        FTradeCommitBuy buy2;
        buy2.buyerIdentity = buyerIdentity;
        buy2.entityHash = entityHash;
        buy2.creditsOffered = price;
        buy2.timestamp = 1000001;
        buy2.sign();

        commitSell(sell2);
        commitBuy(buy2);
        auto r2 = executeSwap(entityHash);

        std::string hash2 = r2.transaction.transactionHash;

        return r1.success && r2.success && hash1 == hash2;
    }

private:
    AtomicSwapEngine() = default;
    AtomicSwapEngine(const AtomicSwapEngine&) = delete;
    AtomicSwapEngine& operator=(const AtomicSwapEngine&) = delete;

    static int64_t currentTimestamp() {
        return static_cast<int64_t>(std::time(nullptr));
    }

    std::string generateTransactionId(const FTradeCommitSell& sell, const FTradeCommitBuy& buy) const {
        std::string combined = sell.commitHash + ":" + buy.commitHash;
        return SovereignSHA256::hash(combined).substr(0, 32);
    }

    void flushTransactionToChronos(const FTransactionRecord& tx) {
        auto& chronos = ChronosEngine::Get();
        JsonValue payload(std::map<std::string, JsonValue>{
            {"transactionId", JsonValue(tx.transactionId)},
            {"entityHash", JsonValue(tx.entityHash)},
            {"sellerIdentity", JsonValue(tx.sellerIdentity)},
            {"buyerIdentity", JsonValue(tx.buyerIdentity)},
            {"priceCredits", JsonValue(tx.priceCredits)},
            {"royaltyCredits", JsonValue(tx.royaltyCredits)},
            {"genesisArchitect", JsonValue(tx.genesisArchitect)},
            {"royaltyBps", JsonValue(static_cast<int64_t>(tx.royaltyBps))},
            {"sellCommitHash", JsonValue(tx.sellCommitHash)},
            {"buyCommitHash", JsonValue(tx.buyCommitHash)},
            {"transactionHash", JsonValue(tx.transactionHash)},
            {"status", JsonValue(std::string("EXECUTED"))}
        });

        std::string chronosKey = "trade:" + tx.transactionId.substr(0, 16);
        chronos.enqueue(chronosKey, payload, 0, "swap-engine");
    }

    mutable std::mutex mutex_;
    std::map<std::string, FTradeCommitSell> pendingSells_;
    std::map<std::string, FTradeCommitBuy> pendingBuys_;
    std::vector<FTransactionRecord> transactionHistory_;
    OwnershipStats stats_;
    GeneticTaxConfig taxConfig_;
    TradeExecutedDelegate tradeExecutedDelegate_;
    RoyaltyCollectedDelegate royaltyCollectedDelegate_;
};

class SovereignMarketplace {
public:
    static SovereignMarketplace& Get() {
        static SovereignMarketplace instance;
        return instance;
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mutex_);
        listings_.clear();
        stats_ = MarketplaceStats{};
        listingCreatedDelegate_ = nullptr;
    }

    struct MarketplaceStats {
        int totalListingsCreated = 0;
        int totalListingsActive = 0;
        int totalListingsRemoved = 0;
        int totalPurchases = 0;
    };

    struct ListResult {
        bool success;
        std::string error;
        FMarketplaceListing listing;
    };

    struct BuyResult {
        bool success;
        std::string error;
        AtomicSwapResult swapResult;
    };

    struct AuditResult {
        bool success;
        std::string entityHash;
        std::string phenotypeClassName;
        std::string meshFamilyName;
        int generation;
        int totalMutations;
        std::string lineageHash;
        std::string genesisArchitect;
        int royaltyBps;
        std::vector<FTransactionRecord> transactionHistory;
        FSpawnLineage lineage;
        bool hasLineage;
        int ancestryDepth;
    };

    ListResult listEntity(const std::string& entityHash,
                           const std::string& sellerIdentity,
                           int64_t askPrice) {
        ListResult result;
        result.success = false;

        auto& ownership = USovereignOwnershipComponent::Get();
        if (!ownership.isOwnedBy(entityHash, sellerIdentity)) {
            result.error = "NOT_OWNER";
            return result;
        }

        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = listings_.find(entityHash);
            if (it != listings_.end() && it->second.active) {
                result.error = "ALREADY_LISTED";
                return result;
            }
        }

        if (!ownership.lockForListing(entityHash, sellerIdentity)) {
            result.error = "LOCK_FAILED";
            return result;
        }

        auto& spawner = SovereignSpawner::Get();
        FSpawnLineage lineage;
        bool hasLineage = false;
        const FSpawnLineage* lineagePtr = spawner.getLineage(entityHash);
        if (lineagePtr && !lineagePtr->childHash.empty()) {
            lineage = *lineagePtr;
            hasLineage = true;
        }

        FMarketplaceListing listing;
        listing.entityHash = entityHash;
        listing.sellerIdentity = sellerIdentity;
        listing.askPrice = askPrice;
        listing.listedTimestamp = currentTimestamp();
        listing.active = true;

        auto& forge = BiologicalForge::Get();
        auto phenotype = forge.forge(entityHash, "marketplace-lookup");
        listing.phenotypeClassName = phenotype.classificationName;
        listing.meshFamilyName = phenotype.morphology.meshFamilyName();

        if (hasLineage) {
            listing.generation = lineage.generation;
            listing.totalMutations = lineage.totalMutations;
        } else {
            listing.generation = 0;
            listing.totalMutations = 0;
        }

        auto taxCfg = AtomicSwapEngine::Get().getTaxConfig();
        listing.genesisArchitect = taxCfg.genesisArchitectId;
        listing.royaltyBps = taxCfg.effectiveBps();

        listing.seal();

        ListingCreatedDelegate delegateCopy;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            listings_[entityHash] = listing;
            stats_.totalListingsCreated++;
            stats_.totalListingsActive++;

            delegateCopy = listingCreatedDelegate_;
        }

        flushListingToChronos(listing);

        if (delegateCopy) {
            delegateCopy(listing);
        }

        result.success = true;
        result.listing = listing;
        return result;
    }

    BuyResult buyEntity(const std::string& entityHash,
                         const std::string& buyerIdentity,
                         int64_t creditsAvailable) {
        BuyResult result;
        result.success = false;

        FMarketplaceListing listing;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = listings_.find(entityHash);
            if (it == listings_.end() || !it->second.active) {
                result.error = "NOT_LISTED";
                return result;
            }
            listing = it->second;
        }

        if (listing.sellerIdentity == buyerIdentity) {
            result.error = "SELF_PURCHASE_PROHIBITED";
            return result;
        }

        if (creditsAvailable < listing.askPrice) {
            result.error = "INSUFFICIENT_CREDITS";
            return result;
        }

        FTradeCommitSell sell;
        sell.sellerIdentity = listing.sellerIdentity;
        sell.entityHash = entityHash;
        sell.priceCredits = listing.askPrice;
        sell.timestamp = currentTimestamp();
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = buyerIdentity;
        buy.entityHash = entityHash;
        buy.creditsOffered = listing.askPrice;
        buy.timestamp = currentTimestamp();
        buy.sign();

        auto& swap = AtomicSwapEngine::Get();
        swap.commitSell(sell);
        swap.commitBuy(buy);

        auto swapResult = swap.executeSwap(entityHash);

        if (!swapResult.success) {
            result.error = "SWAP_FAILED: " + swapResult.error;
            auto& ownership = USovereignOwnershipComponent::Get();
            ownership.unlockEntity(entityHash, listing.sellerIdentity);
            return result;
        }

        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto it = listings_.find(entityHash);
            if (it != listings_.end()) {
                it->second.active = false;
                stats_.totalListingsActive--;
                stats_.totalPurchases++;
            }
        }

        result.success = true;
        result.swapResult = swapResult;
        return result;
    }

    AuditResult auditEntity(const std::string& entityHash) const {
        AuditResult result;
        result.success = false;
        result.entityHash = entityHash;
        result.hasLineage = false;
        result.ancestryDepth = 0;

        auto& forge = BiologicalForge::Get();
        auto phenotype = forge.forge(entityHash, "audit-lookup");
        result.phenotypeClassName = phenotype.classificationName;
        result.meshFamilyName = phenotype.morphology.meshFamilyName();

        auto& spawner = SovereignSpawner::Get();
        const FSpawnLineage* lineagePtr = spawner.getLineage(entityHash);
        if (lineagePtr && !lineagePtr->childHash.empty()) {
            result.hasLineage = true;
            result.lineage = *lineagePtr;
            result.generation = lineagePtr->generation;
            result.totalMutations = lineagePtr->totalMutations;
            result.lineageHash = lineagePtr->lineageHash;

            auto ancestry = spawner.getAncestry(entityHash, 10);
            result.ancestryDepth = static_cast<int>(ancestry.size());
        }

        auto taxCfg = AtomicSwapEngine::Get().getTaxConfig();
        result.genesisArchitect = taxCfg.genesisArchitectId;
        result.royaltyBps = taxCfg.effectiveBps();

        result.transactionHistory = AtomicSwapEngine::Get().getEntityTransactions(entityHash);
        result.success = true;

        return result;
    }

    bool removeListing(const std::string& entityHash, const std::string& ownerIdentity) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = listings_.find(entityHash);
        if (it == listings_.end() || !it->second.active) return false;
        if (it->second.sellerIdentity != ownerIdentity) return false;

        it->second.active = false;
        stats_.totalListingsActive--;
        stats_.totalListingsRemoved++;

        auto& ownership = USovereignOwnershipComponent::Get();
        ownership.unlockEntity(entityHash, ownerIdentity);

        return true;
    }

    FMarketplaceListing getListing(const std::string& entityHash) const {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = listings_.find(entityHash);
        if (it == listings_.end()) return FMarketplaceListing{};
        return it->second;
    }

    std::vector<FMarketplaceListing> getActiveListings() const {
        std::lock_guard<std::mutex> lock(mutex_);
        std::vector<FMarketplaceListing> result;
        for (const auto& pair : listings_) {
            if (pair.second.active) {
                result.push_back(pair.second);
            }
        }
        return result;
    }

    MarketplaceStats getStats() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return stats_;
    }

    void onListingCreated(ListingCreatedDelegate delegate) {
        std::lock_guard<std::mutex> lock(mutex_);
        listingCreatedDelegate_ = std::move(delegate);
    }

private:
    SovereignMarketplace() = default;
    SovereignMarketplace(const SovereignMarketplace&) = delete;
    SovereignMarketplace& operator=(const SovereignMarketplace&) = delete;

    static int64_t currentTimestamp() {
        return static_cast<int64_t>(std::time(nullptr));
    }

    void flushListingToChronos(const FMarketplaceListing& listing) {
        auto& chronos = ChronosEngine::Get();
        JsonValue payload(std::map<std::string, JsonValue>{
            {"entityHash", JsonValue(listing.entityHash)},
            {"sellerIdentity", JsonValue(listing.sellerIdentity)},
            {"askPrice", JsonValue(listing.askPrice)},
            {"phenotypeClassName", JsonValue(listing.phenotypeClassName)},
            {"meshFamilyName", JsonValue(listing.meshFamilyName)},
            {"generation", JsonValue(static_cast<int64_t>(listing.generation))},
            {"totalMutations", JsonValue(static_cast<int64_t>(listing.totalMutations))},
            {"royaltyBps", JsonValue(static_cast<int64_t>(listing.royaltyBps))},
            {"listingHash", JsonValue(listing.listingHash)}
        });

        std::string chronosKey = "listing:" + listing.entityHash.substr(0, 16);
        chronos.enqueue(chronosKey, payload, 0, "marketplace-system");
    }

    mutable std::mutex mutex_;
    std::map<std::string, FMarketplaceListing> listings_;
    MarketplaceStats stats_;
    ListingCreatedDelegate listingCreatedDelegate_;
};

}
