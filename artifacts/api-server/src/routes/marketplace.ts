import { Router, type IRouter, type Request, type Response } from "express";
import { getBalance, reserveCredits, settleCredits, refundCredits, grantCredits } from "../lib/credits";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: Function): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

const GENESIS_ARCHITECT_ID = process.env.GENESIS_ARCHITECT_ID || "50529956";
const ROYALTY_BPS = Math.min(500, Math.max(200, parseInt(process.env.ROYALTY_BPS || "300", 10)));

interface MarketplaceListing {
  entityHash: string;
  sellerIdentity: string;
  askPrice: number;
  listedTimestamp: number;
  active: boolean;
  listingHash: string;
  phenotypeClassName: string;
  meshFamilyName: string;
  generation: number;
  totalMutations: number;
  royaltyBps: number;
}

interface TransactionRecord {
  transactionId: string;
  entityHash: string;
  sellerIdentity: string;
  buyerIdentity: string;
  priceCredits: number;
  royaltyCredits: number;
  genesisArchitect: string;
  royaltyBps: number;
  timestamp: number;
  sellCommitHash: string;
  buyCommitHash: string;
  transactionHash: string;
}

const listings = new Map<string, MarketplaceListing>();
const transactionHistory: TransactionRecord[] = [];
const ownershipRegistry = new Map<string, { ownerIdentity: string; locked: boolean }>();
const purchaseInFlight = new Set<string>();

function computeRoyalty(price: number): number {
  const royalty = Math.ceil((price * ROYALTY_BPS) / 10000);
  return Math.max(1, royalty);
}

function sha256Hex(input: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(input).digest("hex");
}

router.post("/marketplace/list", requireAuth, async (req: Request, res: Response) => {
  try {
    const { entityHash, askPrice } = req.body;
    const sellerIdentity = String(req.user!.id);

    if (!entityHash || typeof entityHash !== "string") {
      res.status(400).json({ error: "entityHash required" });
      return;
    }

    if (!askPrice || typeof askPrice !== "number" || askPrice <= 0) {
      res.status(400).json({ error: "askPrice must be a positive number" });
      return;
    }

    const ownership = ownershipRegistry.get(entityHash);
    if (!ownership) {
      res.status(404).json({ error: "ENTITY_NOT_REGISTERED", message: "Entity must be claimed before listing" });
      return;
    }
    if (ownership.ownerIdentity !== sellerIdentity) {
      res.status(403).json({ error: "NOT_OWNER" });
      return;
    }

    const existing = listings.get(entityHash);
    if (existing && existing.active) {
      res.status(409).json({ error: "ALREADY_LISTED" });
      return;
    }

    const listing: MarketplaceListing = {
      entityHash,
      sellerIdentity,
      askPrice,
      listedTimestamp: Date.now(),
      active: true,
      listingHash: sha256Hex(JSON.stringify({ entityHash, sellerIdentity, askPrice, ts: Date.now() })),
      phenotypeClassName: req.body.phenotypeClassName || "UNKNOWN",
      meshFamilyName: req.body.meshFamilyName || "Unknown",
      generation: req.body.generation || 0,
      totalMutations: req.body.totalMutations || 0,
      royaltyBps: ROYALTY_BPS,
    };

    listings.set(entityHash, listing);
    ownershipRegistry.set(entityHash, { ownerIdentity: sellerIdentity, locked: true });

    res.status(201).json({
      success: true,
      listing,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list entity";
    console.error("Marketplace list error:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/marketplace/claim", requireAuth, async (req: Request, res: Response) => {
  try {
    const { entityHash } = req.body;
    const claimantId = String(req.user!.id);

    if (!entityHash || typeof entityHash !== "string") {
      res.status(400).json({ error: "entityHash required" });
      return;
    }

    const existing = ownershipRegistry.get(entityHash);
    if (existing) {
      res.status(409).json({ error: "ALREADY_CLAIMED", currentOwner: existing.ownerIdentity === claimantId ? "you" : "another_user" });
      return;
    }

    ownershipRegistry.set(entityHash, { ownerIdentity: claimantId, locked: false });
    res.status(201).json({ success: true, entityHash, ownerIdentity: claimantId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to claim entity";
    console.error("Marketplace claim error:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/marketplace/buy", requireAuth, async (req: Request, res: Response) => {
  try {
    const { entityHash } = req.body;
    const buyerIdentity = String(req.user!.id);

    if (!entityHash || typeof entityHash !== "string") {
      res.status(400).json({ error: "entityHash required" });
      return;
    }

    if (purchaseInFlight.has(entityHash)) {
      res.status(409).json({ error: "PURCHASE_IN_PROGRESS" });
      return;
    }

    const listing = listings.get(entityHash);
    if (!listing || !listing.active) {
      res.status(404).json({ error: "NOT_LISTED" });
      return;
    }

    if (listing.sellerIdentity === buyerIdentity) {
      res.status(400).json({ error: "SELF_PURCHASE_PROHIBITED" });
      return;
    }

    purchaseInFlight.add(entityHash);

    try {
      const buyerBalance = await getBalance(buyerIdentity);
      if (buyerBalance.balance < listing.askPrice) {
        res.status(402).json({ error: "INSUFFICIENT_CREDITS", required: listing.askPrice, available: buyerBalance.balance });
        return;
      }

      const reservation = await reserveCredits(buyerIdentity, listing.askPrice, "marketplace_purchase", entityHash);

      try {
        const royalty = computeRoyalty(listing.askPrice);
        const sellerProceeds = listing.askPrice - royalty;

        const sellCanonical = JSON.stringify({
          entityHash: listing.entityHash,
          priceCredits: listing.askPrice,
          sellerIdentity: listing.sellerIdentity,
        });
        const sellCommitHash = sha256Hex(sellCanonical);

        const buyCanonical = JSON.stringify({
          buyerIdentity,
          creditsOffered: listing.askPrice,
          entityHash: listing.entityHash,
        });
        const buyCommitHash = sha256Hex(buyCanonical);

        const transactionId = sha256Hex(sellCommitHash + ":" + buyCommitHash).substring(0, 32);

        const txRecord: TransactionRecord = {
          transactionId,
          entityHash,
          sellerIdentity: listing.sellerIdentity,
          buyerIdentity,
          priceCredits: listing.askPrice,
          royaltyCredits: royalty,
          genesisArchitect: GENESIS_ARCHITECT_ID,
          royaltyBps: ROYALTY_BPS,
          timestamp: Date.now(),
          sellCommitHash,
          buyCommitHash,
          transactionHash: sha256Hex(JSON.stringify({
            transactionId,
            entityHash,
            sellerIdentity: listing.sellerIdentity,
            buyerIdentity,
            priceCredits: listing.askPrice,
            royaltyCredits: royalty,
          })),
        };

        await settleCredits(reservation);

        await grantCredits(listing.sellerIdentity, sellerProceeds, "marketplace_sale", `Sold ${entityHash.substring(0, 16)}`);

        if (royalty > 0 && GENESIS_ARCHITECT_ID !== listing.sellerIdentity) {
          await grantCredits(GENESIS_ARCHITECT_ID, royalty, "royalty_payment", `Royalty on ${entityHash.substring(0, 16)}`);
        }

        ownershipRegistry.set(entityHash, { ownerIdentity: buyerIdentity, locked: false });
        listing.active = false;
        transactionHistory.push(txRecord);

        res.json({
          success: true,
          transaction: txRecord,
          sellerProceeds,
          royaltyPaid: royalty,
          buyerCost: listing.askPrice,
        });
      } catch (swapErr) {
        await refundCredits(reservation, "Swap failed");
        throw swapErr;
      }
    } finally {
      purchaseInFlight.delete(entityHash);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to buy entity";
    console.error("Marketplace buy error:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/marketplace/audit/:entityHash", requireAuth, async (req: Request, res: Response) => {
  try {
    const { entityHash } = req.params;

    const ownership = ownershipRegistry.get(entityHash);
    const listing = listings.get(entityHash);
    const entityTransactions = transactionHistory.filter((tx) => tx.entityHash === entityHash);

    const totalRoyaltiesCollected = entityTransactions.reduce((sum, tx) => sum + tx.royaltyCredits, 0);
    const totalVolume = entityTransactions.reduce((sum, tx) => sum + tx.priceCredits, 0);

    res.json({
      success: true,
      entityHash,
      currentOwner: ownership?.ownerIdentity || null,
      isListed: listing?.active || false,
      askPrice: listing?.active ? listing.askPrice : null,
      phenotypeClassName: listing?.phenotypeClassName || null,
      meshFamilyName: listing?.meshFamilyName || null,
      generation: listing?.generation || 0,
      totalMutations: listing?.totalMutations || 0,
      royaltyBps: ROYALTY_BPS,
      genesisArchitect: GENESIS_ARCHITECT_ID,
      transactionHistory: entityTransactions,
      totalTrades: entityTransactions.length,
      totalRoyaltiesCollected,
      totalVolume,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to audit entity";
    console.error("Marketplace audit error:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/marketplace/listings", async (_req: Request, res: Response) => {
  try {
    const activeListings: MarketplaceListing[] = [];
    for (const listing of listings.values()) {
      if (listing.active) {
        activeListings.push(listing);
      }
    }
    res.json({ success: true, listings: activeListings, total: activeListings.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get listings";
    console.error("Marketplace listings error:", message);
    res.status(500).json({ error: message });
  }
});

router.delete("/marketplace/list/:entityHash", requireAuth, async (req: Request, res: Response) => {
  try {
    const { entityHash } = req.params;
    const userId = String(req.user!.id);

    const listing = listings.get(entityHash);
    if (!listing || !listing.active) {
      res.status(404).json({ error: "NOT_LISTED" });
      return;
    }

    if (listing.sellerIdentity !== userId) {
      res.status(403).json({ error: "NOT_OWNER" });
      return;
    }

    listing.active = false;
    ownershipRegistry.set(entityHash, { ownerIdentity: userId, locked: false });

    res.json({ success: true, message: "Listing removed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove listing";
    console.error("Marketplace remove error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
