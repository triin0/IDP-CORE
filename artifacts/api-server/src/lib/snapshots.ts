import { createHash } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { db, projectsTable, fileBlobsTable, snapshotsTable } from "@workspace/db";

type SnapshotTrigger = "pre_generate" | "pre_refine" | "pre_wipe" | "pre_inject" | "pre_restore" | "manual";

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function createSnapshot(
  projectId: string,
  files: Array<{ path: string; content: string }>,
  trigger: SnapshotTrigger,
  label: string,
): Promise<string> {
  if (files.length === 0) {
    throw new Error("Cannot create snapshot of empty file set");
  }

  const manifest: Array<{ path: string; blobHash: string }> = [];
  const uniqueBlobs = new Map<string, { content: string; byteSize: number }>();

  for (const file of files) {
    const hash = hashContent(file.content);
    manifest.push({ path: file.path, blobHash: hash });
    if (!uniqueBlobs.has(hash)) {
      uniqueBlobs.set(hash, {
        content: file.content,
        byteSize: Buffer.byteLength(file.content, "utf8"),
      });
    }
  }

  const blobValues = Array.from(uniqueBlobs.entries()).map(([hash, blob]) => ({
    projectId,
    hash,
    content: blob.content,
    byteSize: blob.byteSize,
  }));

  if (blobValues.length > 0) {
    await db
      .insert(fileBlobsTable)
      .values(blobValues)
      .onConflictDoNothing({ target: [fileBlobsTable.projectId, fileBlobsTable.hash] });
  }

  const totalBytes = manifest.reduce((sum, m) => {
    const blob = uniqueBlobs.get(m.blobHash);
    return sum + (blob?.byteSize ?? 0);
  }, 0);

  const [snapshot] = await db
    .insert(snapshotsTable)
    .values({
      projectId,
      trigger,
      label,
      manifest,
      fileCount: files.length,
      totalBytes,
    })
    .returning({ id: snapshotsTable.id });

  return snapshot.id;
}

export async function restoreSnapshot(
  projectId: string,
  snapshotId: string,
): Promise<Array<{ path: string; content: string }>> {
  const [snapshot] = await db
    .select()
    .from(snapshotsTable)
    .where(
      and(
        eq(snapshotsTable.id, snapshotId),
        eq(snapshotsTable.projectId, projectId),
      ),
    );

  if (!snapshot) {
    throw new Error("Snapshot not found");
  }

  const manifest = snapshot.manifest as Array<{ path: string; blobHash: string }>;
  const hashes = [...new Set(manifest.map((m) => m.blobHash))];

  const blobs = await db
    .select({ hash: fileBlobsTable.hash, content: fileBlobsTable.content })
    .from(fileBlobsTable)
    .where(eq(fileBlobsTable.projectId, projectId));

  const blobMap = new Map(blobs.map((b) => [b.hash, b.content]));

  const missingHashes = hashes.filter((h) => !blobMap.has(h));
  if (missingHashes.length > 0) {
    throw new Error(
      `Snapshot corrupted: ${missingHashes.length} file blob(s) missing from storage`,
    );
  }

  const files = manifest.map((m) => ({
    path: m.path,
    content: blobMap.get(m.blobHash)!,
  }));

  return files;
}

export async function listSnapshots(projectId: string) {
  return db
    .select({
      id: snapshotsTable.id,
      trigger: snapshotsTable.trigger,
      label: snapshotsTable.label,
      fileCount: snapshotsTable.fileCount,
      totalBytes: snapshotsTable.totalBytes,
      createdAt: snapshotsTable.createdAt,
    })
    .from(snapshotsTable)
    .where(eq(snapshotsTable.projectId, projectId))
    .orderBy(desc(snapshotsTable.createdAt));
}

export async function deleteSnapshot(projectId: string, snapshotId: string): Promise<boolean> {
  const result = await db
    .delete(snapshotsTable)
    .where(
      and(
        eq(snapshotsTable.id, snapshotId),
        eq(snapshotsTable.projectId, projectId),
      ),
    )
    .returning({ id: snapshotsTable.id });

  return result.length > 0;
}
