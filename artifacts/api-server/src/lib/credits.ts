import { eq, desc, sql } from "drizzle-orm";
import { db, userCreditsTable, creditLedgerTable, CREDIT_COSTS } from "@workspace/db";
import type { CreditActionType, CreditLedgerEntry } from "@workspace/db";

export { CREDIT_COSTS };

export interface CreditBalance {
  balance: number;
  lifetimeSpent: number;
  lifetimeGranted: number;
}

export interface CreditReservation {
  ledgerEntryId: string;
  amount: number;
  userId: string;
}

export async function ensureCreditAccount(userId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(userCreditsTable)
    .where(eq(userCreditsTable.userId, userId));

  if (!existing) {
    await db.insert(userCreditsTable).values({
      userId,
      balance: CREDIT_COSTS.starter_grant,
      lifetimeGranted: CREDIT_COSTS.starter_grant,
    }).onConflictDoNothing();

    await db.insert(creditLedgerTable).values({
      userId,
      amount: CREDIT_COSTS.starter_grant,
      actionType: "starter_grant",
      status: "settled",
      metadata: { reason: "New account starter credits" },
    });

    console.log(`[credits] Granted ${CREDIT_COSTS.starter_grant} starter credits to user ${userId}`);
  }
}

export async function getBalance(userId: string): Promise<CreditBalance> {
  await ensureCreditAccount(userId);

  const [record] = await db
    .select()
    .from(userCreditsTable)
    .where(eq(userCreditsTable.userId, userId));

  return {
    balance: record?.balance ?? 0,
    lifetimeSpent: record?.lifetimeSpent ?? 0,
    lifetimeGranted: record?.lifetimeGranted ?? 0,
  };
}

export async function reserveCredits(
  userId: string,
  amount: number,
  actionType: CreditActionType,
  projectId?: string,
): Promise<CreditReservation> {
  await ensureCreditAccount(userId);

  const deducted = await db
    .update(userCreditsTable)
    .set({
      balance: sql`${userCreditsTable.balance} - ${amount}`,
    })
    .where(
      sql`${userCreditsTable.userId} = ${userId} AND ${userCreditsTable.balance} >= ${amount}`,
    )
    .returning();

  if (deducted.length === 0) {
    const [account] = await db
      .select({ balance: userCreditsTable.balance })
      .from(userCreditsTable)
      .where(eq(userCreditsTable.userId, userId));
    throw new CreditError(
      `Insufficient credits: need ${amount}, have ${account?.balance ?? 0}`,
      account?.balance ?? 0,
      amount,
    );
  }

  const [entry] = await db.insert(creditLedgerTable).values({
    userId,
    amount: -amount,
    actionType,
    status: "pending",
    projectId: projectId ?? null,
    metadata: { reservedAt: new Date().toISOString() },
  }).returning();

  console.log(`[credits] Reserved ${amount} credits for user ${userId} (${actionType}), entry ${entry.id}`);

  return {
    ledgerEntryId: entry.id,
    amount,
    userId,
  };
}

export async function settleCredits(reservation: CreditReservation): Promise<void> {
  const updated = await db
    .update(creditLedgerTable)
    .set({
      status: "settled",
      metadata: sql`jsonb_set(COALESCE(${creditLedgerTable.metadata}, '{}'::jsonb), '{settledAt}', to_jsonb(now()::text))`,
    })
    .where(
      sql`${creditLedgerTable.id} = ${reservation.ledgerEntryId} AND ${creditLedgerTable.status} = 'pending'`,
    )
    .returning({ id: creditLedgerTable.id });

  if (updated.length === 0) {
    console.warn(`[credits] Settle skipped for entry ${reservation.ledgerEntryId} — not in pending state (idempotent)`);
    return;
  }

  await db
    .update(userCreditsTable)
    .set({
      lifetimeSpent: sql`${userCreditsTable.lifetimeSpent} + ${reservation.amount}`,
    })
    .where(eq(userCreditsTable.userId, reservation.userId));

  console.log(`[credits] Settled ${reservation.amount} credits for user ${reservation.userId}`);
}

export async function refundCredits(reservation: CreditReservation, reason?: string): Promise<void> {
  const updated = await db
    .update(creditLedgerTable)
    .set({
      status: "refunded",
      metadata: sql`jsonb_set(COALESCE(${creditLedgerTable.metadata}, '{}'::jsonb), '{refundReason}', ${JSON.stringify(reason ?? "pipeline_failure")}::jsonb)`,
    })
    .where(
      sql`${creditLedgerTable.id} = ${reservation.ledgerEntryId} AND ${creditLedgerTable.status} = 'pending'`,
    )
    .returning({ id: creditLedgerTable.id });

  if (updated.length === 0) {
    console.warn(`[credits] Refund skipped for entry ${reservation.ledgerEntryId} — not in pending state (idempotent)`);
    return;
  }

  await db
    .update(userCreditsTable)
    .set({
      balance: sql`${userCreditsTable.balance} + ${reservation.amount}`,
    })
    .where(eq(userCreditsTable.userId, reservation.userId));

  console.log(`[credits] Refunded ${reservation.amount} credits to user ${reservation.userId}: ${reason ?? "pipeline_failure"}`);
}

export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
): Promise<void> {
  await ensureCreditAccount(userId);

  await db.insert(creditLedgerTable).values({
    userId,
    amount,
    actionType: "top_up",
    status: "settled",
    metadata: { reason },
  });

  await db
    .update(userCreditsTable)
    .set({
      balance: sql`${userCreditsTable.balance} + ${amount}`,
      lifetimeGranted: sql`${userCreditsTable.lifetimeGranted} + ${amount}`,
    })
    .where(eq(userCreditsTable.userId, userId));

  console.log(`[credits] Granted ${amount} credits to user ${userId}: ${reason}`);
}

export async function getCreditHistory(
  userId: string,
  limit: number = 50,
): Promise<CreditLedgerEntry[]> {
  return db
    .select()
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.userId, userId))
    .orderBy(desc(creditLedgerTable.createdAt))
    .limit(limit);
}

export class CreditError extends Error {
  public readonly currentBalance: number;
  public readonly requiredAmount: number;

  constructor(message: string, currentBalance: number, requiredAmount: number) {
    super(message);
    this.name = "CreditError";
    this.currentBalance = currentBalance;
    this.requiredAmount = requiredAmount;
  }
}
