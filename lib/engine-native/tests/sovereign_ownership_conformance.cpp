#include "../generated/SovereignOwnership.h"
#include <iostream>
#include <cassert>
#include <cmath>
#include <functional>

using namespace Sovereign;

static int passed = 0;
static int failed = 0;

static void TEST(const std::string& name, bool condition) {
    if (condition) {
        std::cout << "  PASS: " << name << std::endl;
        passed++;
    } else {
        std::cout << "  FAIL: " << name << std::endl;
        failed++;
    }
}

static void resetAll() {
    USovereignOwnershipComponent::Get().reset();
    AtomicSwapEngine::Get().reset();
    SovereignMarketplace::Get().reset();
    ChronosEngine::Get().reset();
    SovereignSpawner::Get().reset();
    BiologicalForge::Get().reset();

    ChronosConfig cfg;
    cfg.persistencePath = "/tmp/ownership_test.bin";
    cfg.autoSaveOnEnqueue = true;
    ChronosEngine::Get().configure(cfg);
}

static std::string hashOf(const std::string& s) {
    return SovereignSHA256::hash(s);
}

int main() {
    std::cout << "=== Sovereign Ownership Conformance Tests ===" << std::endl;
    std::cout << "=== Module 10: The Economic Layer ===" << std::endl;

    std::string entityA = hashOf("entity-alpha");
    std::string entityB = hashOf("entity-beta");
    std::string entityC = hashOf("entity-gamma");
    std::string ownerAlice = "alice-pubkey-hash";
    std::string ownerBob = "bob-pubkey-hash";
    std::string ownerCharlie = "charlie-pubkey-hash";
    std::string genesisId = "50529956";

    std::cout << "\n=== Ownership: Claim & Query ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();

        TEST("Claim — entity not owned before claim", !own.isOwned(entityA));
        TEST("Claim — isOwnedBy returns false before claim", !own.isOwnedBy(entityA, ownerAlice));

        bool claimed = own.claimOwnership(entityA, ownerAlice);
        TEST("Claim — claim succeeds", claimed);
        TEST("Claim — entity is now owned", own.isOwned(entityA));
        TEST("Claim — isOwnedBy Alice", own.isOwnedBy(entityA, ownerAlice));
        TEST("Claim — isOwnedBy Bob false", !own.isOwnedBy(entityA, ownerBob));

        bool duplicate = own.claimOwnership(entityA, ownerBob);
        TEST("Claim — duplicate claim rejected", !duplicate);
        TEST("Claim — still owned by Alice after rejected claim", own.isOwnedBy(entityA, ownerAlice));
    }

    std::cout << "\n=== Ownership: canInteract ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();

        TEST("Interact — unclaimed entity, anyone can interact", own.canInteract(entityA, ownerBob));

        own.claimOwnership(entityA, ownerAlice);
        TEST("Interact — owner can interact", own.canInteract(entityA, ownerAlice));
        TEST("Interact — non-owner blocked (locked state)", !own.canInteract(entityA, ownerBob));

        own.unlockEntity(entityA, ownerAlice);
        TEST("Interact — after unlock, non-owner can interact", own.canInteract(entityA, ownerBob));
    }

    std::cout << "\n=== Ownership: Transfer ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        own.claimOwnership(entityA, ownerAlice);

        bool wrongOwner = own.transferOwnership(entityA, ownerBob, ownerCharlie);
        TEST("Transfer — rejected when fromOwner doesn't match", !wrongOwner);

        bool success = own.transferOwnership(entityA, ownerAlice, ownerBob);
        TEST("Transfer — succeeds from correct owner", success);
        TEST("Transfer — now owned by Bob", own.isOwnedBy(entityA, ownerBob));
        TEST("Transfer — no longer owned by Alice", !own.isOwnedBy(entityA, ownerAlice));

        auto record = own.getOwnership(entityA);
        TEST("Transfer — previousOwner is Alice", record.previousOwner == ownerAlice);
        TEST("Transfer — transferCount is 1", record.transferCount == 1);
    }

    std::cout << "\n=== Ownership: Lock States ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        own.claimOwnership(entityA, ownerAlice);

        auto r1 = own.getOwnership(entityA);
        TEST("Lock — initial state LOCKED_OWNER", r1.lockState == OwnershipLockState::LOCKED_OWNER);

        bool locked = own.lockForListing(entityA, ownerAlice);
        TEST("Lock — listing lock succeeds", locked);
        auto r2 = own.getOwnership(entityA);
        TEST("Lock — state is LOCKED_LISTING", r2.lockState == OwnershipLockState::LOCKED_LISTING);

        bool doubleLock = own.lockForListing(entityA, ownerAlice);
        TEST("Lock — double listing lock rejected", !doubleLock);

        bool wrongLock = own.lockForListing(entityA, ownerBob);
        TEST("Lock — non-owner listing lock rejected", !wrongLock);

        own.unlockEntity(entityA, ownerAlice);
        auto r3 = own.getOwnership(entityA);
        TEST("Lock — unlock restores UNLOCKED", r3.lockState == OwnershipLockState::UNLOCKED);
    }

    std::cout << "\n=== Ownership: Integrity & Hash ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        own.claimOwnership(entityA, ownerAlice);

        TEST("Integrity — ownership hash verified", own.verifyOwnershipIntegrity(entityA));

        auto record = own.getOwnership(entityA);
        TEST("Integrity — hash is non-empty", !record.ownershipHash.empty());
        TEST("Integrity — record verifyIntegrity", record.verifyIntegrity());
    }

    std::cout << "\n=== Ownership: getOwnedEntities ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        own.claimOwnership(entityA, ownerAlice);
        own.claimOwnership(entityB, ownerAlice);
        own.claimOwnership(entityC, ownerBob);

        auto aliceEntities = own.getOwnedEntities(ownerAlice);
        TEST("OwnedEntities — Alice has 2", aliceEntities.size() == 2);

        auto bobEntities = own.getOwnedEntities(ownerBob);
        TEST("OwnedEntities — Bob has 1", bobEntities.size() == 1);

        auto charlieEntities = own.getOwnedEntities(ownerCharlie);
        TEST("OwnedEntities — Charlie has 0", charlieEntities.size() == 0);
    }

    std::cout << "\n=== Ownership: Chronos Persistence ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        own.claimOwnership(entityA, ownerAlice);

        bool persisted = own.persistOwnership(entityA);
        TEST("Persist — ownership persisted to Chronos", persisted);

        own.reset();
        auto recovered = own.recoverOwnership(entityA);
        TEST("Persist — recovered ownerIdentity matches", recovered.ownerIdentity == ownerAlice);
        TEST("Persist — recovered entityHash matches", recovered.entityHash == entityA);
    }

    std::cout << "\n=== Ownership: Session Reboot ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();

        own.claimOwnership(entityA, ownerAlice);
        own.claimOwnership(entityB, ownerBob);
        own.persistOwnership(entityA);
        own.persistOwnership(entityB);

        TEST("Reboot — pre-reboot Alice owns A", own.isOwnedBy(entityA, ownerAlice));
        TEST("Reboot — pre-reboot Bob owns B", own.isOwnedBy(entityB, ownerBob));

        own.reset();

        TEST("Reboot — post-reset A not owned", !own.isOwned(entityA));

        own.recoverOwnership(entityA);
        own.recoverOwnership(entityB);

        TEST("Reboot — post-recovery Alice owns A", own.isOwnedBy(entityA, ownerAlice));
        TEST("Reboot — post-recovery Bob owns B", own.isOwnedBy(entityB, ownerBob));
        TEST("Reboot — post-recovery isOwnedBy correct", !own.isOwnedBy(entityA, ownerBob));
    }

    std::cout << "\n=== Ownership: Delegate ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();

        std::string fromCapture, toCapture;
        own.onOwnershipTransfer([&](const FOwnershipRecord& rec, const std::string& from, const std::string& to) {
            fromCapture = from;
            toCapture = to;
        });

        own.claimOwnership(entityA, ownerAlice);
        own.transferOwnership(entityA, ownerAlice, ownerBob);

        TEST("Delegate — transfer delegate fires", fromCapture == ownerAlice);
        TEST("Delegate — transfer delegate captures toOwner", toCapture == ownerBob);
    }

    std::cout << "\n=== Ownership Stats ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        own.claimOwnership(entityA, ownerAlice);
        own.claimOwnership(entityB, ownerBob);
        own.transferOwnership(entityA, ownerAlice, ownerBob);

        auto stats = own.stats();
        TEST("Stats — totalEntitiesOwned is 2", stats.totalEntitiesOwned == 2);
        TEST("Stats — totalTransfers is 1", stats.totalTransfers == 1);
    }

    std::cout << "\n=== CommitSell / CommitBuy Signatures ===" << std::endl;
    {
        resetAll();

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 100;
        sell.timestamp = 1000000;
        sell.sign();

        TEST("CommitSell — hash non-empty after sign", !sell.commitHash.empty());
        TEST("CommitSell — verifySignature passes", sell.verifySignature());

        sell.priceCredits = 200;
        TEST("CommitSell — tampered data fails verify", !sell.verifySignature());
        sell.priceCredits = 100;
        TEST("CommitSell — restored data passes verify", sell.verifySignature());

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 100;
        buy.timestamp = 1000001;
        buy.sign();

        TEST("CommitBuy — hash non-empty after sign", !buy.commitHash.empty());
        TEST("CommitBuy — verifySignature passes", buy.verifySignature());

        buy.creditsOffered = 50;
        TEST("CommitBuy — tampered credits fails verify", !buy.verifySignature());
    }

    std::cout << "\n=== Atomic Swap: Full Execution ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 1000;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 1000;
        buy.timestamp = 1000001;
        buy.sign();

        bool sellOk = swap.commitSell(sell);
        TEST("Swap — commitSell accepted", sellOk);
        TEST("Swap — hasPendingSell", swap.hasPendingSell(entityA));

        bool buyOk = swap.commitBuy(buy);
        TEST("Swap — commitBuy accepted", buyOk);
        TEST("Swap — hasPendingBuy", swap.hasPendingBuy(entityA));

        auto result = swap.executeSwap(entityA);
        TEST("Swap — execution succeeds", result.success);
        TEST("Swap — buyer now owns entity", own.isOwnedBy(entityA, ownerBob));
        TEST("Swap — seller no longer owns", !own.isOwnedBy(entityA, ownerAlice));
        TEST("Swap — buyerCost matches price", result.buyerCost == 1000);
        TEST("Swap — royalty > 0", result.royaltyPaid > 0);
        TEST("Swap — sellerProceeds = price - royalty", result.sellerProceeds == 1000 - result.royaltyPaid);
        TEST("Swap — transaction sealed", result.transaction.verifyIntegrity());
        TEST("Swap — transaction status EXECUTED", result.transaction.status == TradeStatus::EXECUTED);
    }

    std::cout << "\n=== Atomic Swap: Failure Modes ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        auto r1 = swap.executeSwap(entityA);
        TEST("SwapFail — no sell commit", r1.error == "NO_SELL_COMMIT");

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 500;
        sell.timestamp = 1000000;
        sell.sign();
        swap.commitSell(sell);

        auto r2 = swap.executeSwap(entityA);
        TEST("SwapFail — no buy commit", r2.error == "NO_BUY_COMMIT");

        FTradeCommitBuy lowBuy;
        lowBuy.buyerIdentity = ownerBob;
        lowBuy.entityHash = entityA;
        lowBuy.creditsOffered = 100;
        lowBuy.timestamp = 1000001;
        lowBuy.sign();
        swap.commitBuy(lowBuy);

        auto r3 = swap.executeSwap(entityA);
        TEST("SwapFail — insufficient credits", r3.error == "INSUFFICIENT_CREDITS");
    }

    std::cout << "\n=== Atomic Swap: Self-Trade Blocked ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 100;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerAlice;
        buy.entityHash = entityA;
        buy.creditsOffered = 100;
        buy.timestamp = 1000001;
        buy.sign();

        swap.commitSell(sell);
        swap.commitBuy(buy);
        auto r = swap.executeSwap(entityA);
        TEST("SelfTrade — blocked", r.error == "SELF_TRADE_PROHIBITED");
    }

    std::cout << "\n=== Atomic Swap: Cancel Sell ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 100;
        sell.timestamp = 1000000;
        sell.sign();
        swap.commitSell(sell);

        bool cancelWrong = swap.cancelSell(entityA, ownerBob);
        TEST("CancelSell — wrong identity rejected", !cancelWrong);

        bool cancelOk = swap.cancelSell(entityA, ownerAlice);
        TEST("CancelSell — correct identity succeeds", cancelOk);
        TEST("CancelSell — no longer pending", !swap.hasPendingSell(entityA));
    }

    std::cout << "\n=== Genetic Tax (Royalties) ===" << std::endl;
    {
        resetAll();
        auto& swap = AtomicSwapEngine::Get();

        GeneticTaxConfig cfg;
        cfg.royaltyBps = 300;
        cfg.genesisArchitectId = genesisId;
        swap.configureGenesisTax(cfg);

        int64_t royalty300 = cfg.computeRoyalty(10000);
        TEST("Tax — 300bps on 10000 = 300", royalty300 == 300);

        int64_t royalty100 = cfg.computeRoyalty(100);
        TEST("Tax — 300bps on 100 = 3", royalty100 == 3);

        int64_t royaltyMin = cfg.computeRoyalty(1);
        TEST("Tax — minimum royalty is 1", royaltyMin == 1);

        GeneticTaxConfig cfgLow;
        cfgLow.royaltyBps = 100;
        cfgLow.minRoyaltyBps = 200;
        TEST("Tax — clamped to minRoyaltyBps", cfgLow.effectiveBps() == 200);

        GeneticTaxConfig cfgHigh;
        cfgHigh.royaltyBps = 1000;
        cfgHigh.maxRoyaltyBps = 500;
        TEST("Tax — clamped to maxRoyaltyBps", cfgHigh.effectiveBps() == 500);
    }

    std::cout << "\n=== Genetic Tax: Collected on Swap ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        GeneticTaxConfig cfg;
        cfg.royaltyBps = 500;
        cfg.genesisArchitectId = genesisId;
        swap.configureGenesisTax(cfg);

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 2000;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 2000;
        buy.timestamp = 1000001;
        buy.sign();

        swap.commitSell(sell);
        swap.commitBuy(buy);
        auto result = swap.executeSwap(entityA);

        TEST("TaxSwap — success", result.success);
        TEST("TaxSwap — royalty = 100 (500bps on 2000)", result.royaltyPaid == 100);
        TEST("TaxSwap — seller proceeds = 1900", result.sellerProceeds == 1900);
        TEST("TaxSwap — genesis architect recorded", result.transaction.genesisArchitect == genesisId);
        TEST("TaxSwap — royaltyBps recorded", result.transaction.royaltyBps == 500);
    }

    std::cout << "\n=== Genetic Tax: Royalty Delegate ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        std::string capturedArchitect;
        int64_t capturedAmount = 0;
        swap.onRoyaltyCollected([&](const std::string& architect, int64_t amount, const std::string&) {
            capturedArchitect = architect;
            capturedAmount = amount;
        });

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 1000;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 1000;
        buy.timestamp = 1000001;
        buy.sign();

        swap.commitSell(sell);
        swap.commitBuy(buy);
        swap.executeSwap(entityA);

        TEST("RoyaltyDelegate — architect captured", capturedArchitect == genesisId);
        TEST("RoyaltyDelegate — amount > 0", capturedAmount > 0);
    }

    std::cout << "\n=== Transaction History ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 500;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 500;
        buy.timestamp = 1000001;
        buy.sign();

        swap.commitSell(sell);
        swap.commitBuy(buy);
        swap.executeSwap(entityA);

        auto history = swap.getTransactionHistory();
        TEST("TxHistory — 1 transaction", history.size() == 1);
        TEST("TxHistory — entity matches", history[0].entityHash == entityA);
        TEST("TxHistory — seller matches", history[0].sellerIdentity == ownerAlice);
        TEST("TxHistory — buyer matches", history[0].buyerIdentity == ownerBob);

        auto entityTx = swap.getEntityTransactions(entityA);
        TEST("TxHistory — entity filter works", entityTx.size() == 1);

        auto userTx = swap.getUserTransactions(ownerAlice);
        TEST("TxHistory — user filter works", userTx.size() == 1);
    }

    std::cout << "\n=== Marketplace: List ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& mkt = SovereignMarketplace::Get();

        own.claimOwnership(entityA, ownerAlice);

        auto notOwner = mkt.listEntity(entityA, ownerBob, 500);
        TEST("MktList — non-owner rejected", !notOwner.success);
        TEST("MktList — error NOT_OWNER", notOwner.error == "NOT_OWNER");

        auto listed = mkt.listEntity(entityA, ownerAlice, 500);
        TEST("MktList — listing succeeds", listed.success);
        TEST("MktList — listing askPrice", listed.listing.askPrice == 500);
        TEST("MktList — listing sealed", listed.listing.verifyIntegrity());

        auto duplicate = mkt.listEntity(entityA, ownerAlice, 600);
        TEST("MktList — duplicate listing rejected", !duplicate.success);

        auto active = mkt.getActiveListings();
        TEST("MktList — 1 active listing", active.size() == 1);
    }

    std::cout << "\n=== Marketplace: Buy ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& mkt = SovereignMarketplace::Get();

        own.claimOwnership(entityA, ownerAlice);
        mkt.listEntity(entityA, ownerAlice, 1000);

        auto selfBuy = mkt.buyEntity(entityA, ownerAlice, 1000);
        TEST("MktBuy — self-purchase blocked", !selfBuy.success);

        auto lowBuy = mkt.buyEntity(entityA, ownerBob, 500);
        TEST("MktBuy — insufficient credits", !lowBuy.success);

        auto buyOk = mkt.buyEntity(entityA, ownerBob, 1000);
        TEST("MktBuy — purchase succeeds", buyOk.success);
        TEST("MktBuy — Bob now owns entity", own.isOwnedBy(entityA, ownerBob));
        TEST("MktBuy — listing deactivated", !mkt.getListing(entityA).active);
        TEST("MktBuy — royalty collected", buyOk.swapResult.royaltyPaid > 0);
    }

    std::cout << "\n=== Marketplace: Audit ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& mkt = SovereignMarketplace::Get();

        std::string parentA = hashOf("parent-volcanic");
        std::string parentB = hashOf("parent-crystalline");
        auto spawnResult = SovereignSpawner::Get().spawn(parentA, parentB, "audit-seed");
        std::string childHash = spawnResult.lineage.childHash;

        own.claimOwnership(childHash, ownerAlice);

        auto audit = mkt.auditEntity(childHash);
        TEST("Audit — success", audit.success);
        TEST("Audit — has lineage", audit.hasLineage);
        TEST("Audit — generation > 0 or == 1", audit.generation == 1);
        TEST("Audit — lineageHash non-empty", !audit.lineageHash.empty());
        TEST("Audit — phenotypeClassName non-empty", !audit.phenotypeClassName.empty());
        TEST("Audit — meshFamilyName non-empty", !audit.meshFamilyName.empty());
        TEST("Audit — genesisArchitect set", !audit.genesisArchitect.empty());
        TEST("Audit — royaltyBps in range", audit.royaltyBps >= 200 && audit.royaltyBps <= 500);
    }

    std::cout << "\n=== Marketplace: Remove Listing ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& mkt = SovereignMarketplace::Get();

        own.claimOwnership(entityA, ownerAlice);
        mkt.listEntity(entityA, ownerAlice, 500);

        bool wrongRemove = mkt.removeListing(entityA, ownerBob);
        TEST("Remove — non-owner rejected", !wrongRemove);

        bool removed = mkt.removeListing(entityA, ownerAlice);
        TEST("Remove — owner succeeds", removed);
        TEST("Remove — listing inactive", !mkt.getListing(entityA).active);
        TEST("Remove — 0 active listings", mkt.getActiveListings().size() == 0);
    }

    std::cout << "\n=== Marketplace: Not Listed Entity ===" << std::endl;
    {
        resetAll();
        auto& mkt = SovereignMarketplace::Get();

        auto buyResult = mkt.buyEntity(entityA, ownerBob, 1000);
        TEST("NotListed — buy rejected", !buyResult.success);
        TEST("NotListed — error is NOT_LISTED", buyResult.error == "NOT_LISTED");
    }

    std::cout << "\n=== Swap Determinism ===" << std::endl;
    {
        resetAll();
        auto& swap = AtomicSwapEngine::Get();

        bool det = swap.verifyDeterminism(entityA, ownerAlice, ownerBob, 1000, "det-seed");
        TEST("Determinism — same inputs produce same tx hash", det);
    }

    std::cout << "\n=== Swap: Chronos Flush ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 750;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 750;
        buy.timestamp = 1000001;
        buy.sign();

        swap.commitSell(sell);
        swap.commitBuy(buy);
        swap.executeSwap(entityA);

        auto chronosEntries = ChronosEngine::Get().getEntries();
        bool foundTrade = false;
        for (const auto& e : chronosEntries) {
            if (e.entityKey.substr(0, 6) == "trade:") {
                foundTrade = true;
            }
        }
        TEST("ChronosFlush — trade entry found", foundTrade);
    }

    std::cout << "\n=== Swap Stats ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 500;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 500;
        buy.timestamp = 1000001;
        buy.sign();

        swap.commitSell(sell);
        swap.commitBuy(buy);
        swap.executeSwap(entityA);

        auto stats = swap.stats();
        TEST("SwapStats — totalTradesExecuted = 1", stats.totalTradesExecuted == 1);
        TEST("SwapStats — totalVolumeTraded = 500", stats.totalVolumeTraded == 500);
        TEST("SwapStats — totalRoyaltiesCollected > 0", stats.totalRoyaltiesCollected > 0);
    }

    std::cout << "\n=== Trade Delegate ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        std::string capturedTxId;
        swap.onTradeExecuted([&](const FTransactionRecord& tx) {
            capturedTxId = tx.transactionId;
        });

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 200;
        sell.timestamp = 1000000;
        sell.sign();

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 200;
        buy.timestamp = 1000001;
        buy.sign();

        swap.commitSell(sell);
        swap.commitBuy(buy);
        swap.executeSwap(entityA);

        TEST("TradeDelegate — transaction ID captured", !capturedTxId.empty());
    }

    std::cout << "\n=== Multi-Trade Chain ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        {
            FTradeCommitSell sell;
            sell.sellerIdentity = ownerAlice;
            sell.entityHash = entityA;
            sell.priceCredits = 500;
            sell.timestamp = 1000000;
            sell.sign();
            FTradeCommitBuy buy;
            buy.buyerIdentity = ownerBob;
            buy.entityHash = entityA;
            buy.creditsOffered = 500;
            buy.timestamp = 1000001;
            buy.sign();
            swap.commitSell(sell);
            swap.commitBuy(buy);
            swap.executeSwap(entityA);
        }

        TEST("MultiTrade — Bob owns after trade 1", own.isOwnedBy(entityA, ownerBob));

        {
            FTradeCommitSell sell;
            sell.sellerIdentity = ownerBob;
            sell.entityHash = entityA;
            sell.priceCredits = 800;
            sell.timestamp = 1000002;
            sell.sign();
            FTradeCommitBuy buy;
            buy.buyerIdentity = ownerCharlie;
            buy.entityHash = entityA;
            buy.creditsOffered = 800;
            buy.timestamp = 1000003;
            buy.sign();
            swap.commitSell(sell);
            swap.commitBuy(buy);
            swap.executeSwap(entityA);
        }

        TEST("MultiTrade — Charlie owns after trade 2", own.isOwnedBy(entityA, ownerCharlie));

        auto history = swap.getEntityTransactions(entityA);
        TEST("MultiTrade — 2 transactions in history", history.size() == 2);

        auto record = own.getOwnership(entityA);
        TEST("MultiTrade — transferCount is 2", record.transferCount == 2);
        TEST("MultiTrade — previousOwner is Bob", record.previousOwner == ownerBob);
    }

    std::cout << "\n=== CommitSell: Non-Owner Rejected ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerBob;
        sell.entityHash = entityA;
        sell.priceCredits = 100;
        sell.timestamp = 1000000;
        sell.sign();

        bool accepted = swap.commitSell(sell);
        TEST("NonOwnerSell — commitSell rejected for non-owner", !accepted);
    }

    std::cout << "\n=== Unsigned Commits Rejected ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = 100;
        sell.timestamp = 1000000;

        bool accepted = swap.commitSell(sell);
        TEST("Unsigned — unsigned sell rejected", !accepted);

        FTradeCommitBuy buy;
        buy.buyerIdentity = ownerBob;
        buy.entityHash = entityA;
        buy.creditsOffered = 100;
        buy.timestamp = 1000001;

        bool buyAccepted = swap.commitBuy(buy);
        TEST("Unsigned — unsigned buy rejected", !buyAccepted);
    }

    std::cout << "\n=== Marketplace Stats ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& mkt = SovereignMarketplace::Get();

        own.claimOwnership(entityA, ownerAlice);
        own.claimOwnership(entityB, ownerBob);

        mkt.listEntity(entityA, ownerAlice, 500);
        mkt.listEntity(entityB, ownerBob, 300);

        auto stats = mkt.getStats();
        TEST("MktStats — 2 listings created", stats.totalListingsCreated == 2);
        TEST("MktStats — 2 active", stats.totalListingsActive == 2);

        mkt.buyEntity(entityA, ownerBob, 500);
        auto stats2 = mkt.getStats();
        TEST("MktStats — 1 purchase", stats2.totalPurchases == 1);
        TEST("MktStats — 1 active after buy", stats2.totalListingsActive == 1);
    }

    std::cout << "\n=== Listing Delegate ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& mkt = SovereignMarketplace::Get();

        std::string capturedEntity;
        mkt.onListingCreated([&](const FMarketplaceListing& listing) {
            capturedEntity = listing.entityHash;
        });

        own.claimOwnership(entityA, ownerAlice);
        mkt.listEntity(entityA, ownerAlice, 500);

        TEST("ListDelegate — entity captured", capturedEntity == entityA);
    }

    std::cout << "\n=== Empty Params Rejected ===" << std::endl;
    {
        resetAll();
        auto& swap = AtomicSwapEngine::Get();

        FTradeCommitSell emptySell;
        emptySell.sign();
        bool accepted = swap.commitSell(emptySell);
        TEST("EmptyParams — empty sell rejected", !accepted);

        FTradeCommitBuy emptyBuy;
        emptyBuy.sign();
        bool buyAccepted = swap.commitBuy(emptyBuy);
        TEST("EmptyParams — empty buy rejected", !buyAccepted);
    }

    std::cout << "\n=== Negative Price Rejected ===" << std::endl;
    {
        resetAll();
        auto& own = USovereignOwnershipComponent::Get();
        auto& swap = AtomicSwapEngine::Get();

        own.claimOwnership(entityA, ownerAlice);

        FTradeCommitSell sell;
        sell.sellerIdentity = ownerAlice;
        sell.entityHash = entityA;
        sell.priceCredits = -50;
        sell.timestamp = 1000000;
        sell.sign();

        bool accepted = swap.commitSell(sell);
        TEST("NegPrice — negative price sell rejected", !accepted);
    }

    std::cout << "\n==================================================" << std::endl;
    std::cout << "OWNERSHIP RESULTS: " << passed << " passed, " << failed << " failed" << std::endl;

    return failed > 0 ? 1 : 0;
}
