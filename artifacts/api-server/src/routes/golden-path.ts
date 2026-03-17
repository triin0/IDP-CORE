import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, goldenPathConfigsTable } from "@workspace/db";
import { goldenPathConfigRulesSchema } from "@workspace/db";
import { DEFAULT_GOLDEN_PATH_CONFIG } from "../lib/golden-path-defaults";
import { z } from "zod/v4";

const router: IRouter = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/golden-path-configs", async (_req, res) => {
  try {
    const configs = await db
      .select()
      .from(goldenPathConfigsTable)
      .orderBy(goldenPathConfigsTable.createdAt);

    res.json({
      configs: configs.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        rules: c.rules,
        isActive: c.isActive,
        isDefault: c.isDefault,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      defaultRules: DEFAULT_GOLDEN_PATH_CONFIG,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list configs";
    console.error("Failed to list golden path configs:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/golden-path-configs/active", async (_req, res) => {
  try {
    const [active] = await db
      .select()
      .from(goldenPathConfigsTable)
      .where(eq(goldenPathConfigsTable.isActive, true))
      .limit(1);

    if (!active) {
      res.json({
        id: null,
        name: "Default",
        description: "Built-in Golden Path configuration",
        rules: DEFAULT_GOLDEN_PATH_CONFIG,
        isActive: true,
        isDefault: true,
      });
      return;
    }

    res.json({
      id: active.id,
      name: active.name,
      description: active.description,
      rules: active.rules,
      isActive: active.isActive,
      isDefault: active.isDefault,
      createdAt: active.createdAt.toISOString(),
      updatedAt: active.updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get active config";
    console.error("Failed to get active golden path config:", message);
    res.status(500).json({ error: message });
  }
});

const createConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rules: goldenPathConfigRulesSchema,
  isActive: z.boolean().optional(),
});

router.post("/golden-path-configs", async (req, res) => {
  try {
    const body = createConfigSchema.parse(req.body);

    if (body.isActive) {
      await db
        .update(goldenPathConfigsTable)
        .set({ isActive: false })
        .where(eq(goldenPathConfigsTable.isActive, true));
    }

    const [config] = await db
      .insert(goldenPathConfigsTable)
      .values({
        name: body.name,
        description: body.description ?? null,
        rules: body.rules,
        isActive: body.isActive ?? false,
        isDefault: false,
      })
      .returning();

    res.status(201).json({
      id: config.id,
      name: config.name,
      description: config.description,
      rules: config.rules,
      isActive: config.isActive,
      isDefault: config.isDefault,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to create golden path config:", message);
    res.status(400).json({ error: message });
  }
});

const updateConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  rules: goldenPathConfigRulesSchema.optional(),
  isActive: z.boolean().optional(),
});

router.put("/golden-path-configs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({ error: "Config not found" });
      return;
    }

    const body = updateConfigSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(goldenPathConfigsTable)
      .where(eq(goldenPathConfigsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Config not found" });
      return;
    }

    if (body.isActive) {
      await db
        .update(goldenPathConfigsTable)
        .set({ isActive: false })
        .where(eq(goldenPathConfigsTable.isActive, true));
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates["name"] = body.name;
    if (body.description !== undefined) updates["description"] = body.description;
    if (body.rules !== undefined) updates["rules"] = body.rules;
    if (body.isActive !== undefined) updates["isActive"] = body.isActive;

    const [updated] = await db
      .update(goldenPathConfigsTable)
      .set(updates)
      .where(eq(goldenPathConfigsTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      rules: updated.rules,
      isActive: updated.isActive,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    console.error("Failed to update golden path config:", message);
    res.status(400).json({ error: message });
  }
});

router.delete("/golden-path-configs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({ error: "Config not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(goldenPathConfigsTable)
      .where(eq(goldenPathConfigsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Config not found" });
      return;
    }

    if (existing.isDefault) {
      res.status(400).json({ error: "Cannot delete the default configuration" });
      return;
    }

    await db
      .delete(goldenPathConfigsTable)
      .where(eq(goldenPathConfigsTable.id, id));

    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete config";
    console.error("Failed to delete golden path config:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/golden-path-configs/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({ error: "Config not found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(goldenPathConfigsTable)
      .where(eq(goldenPathConfigsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Config not found" });
      return;
    }

    await db
      .update(goldenPathConfigsTable)
      .set({ isActive: false })
      .where(eq(goldenPathConfigsTable.isActive, true));

    const [updated] = await db
      .update(goldenPathConfigsTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(goldenPathConfigsTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      rules: updated.rules,
      isActive: updated.isActive,
      isDefault: updated.isDefault,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to activate config";
    console.error("Failed to activate golden path config:", message);
    res.status(500).json({ error: message });
  }
});

router.post("/golden-path-configs/reset-to-default", async (_req, res) => {
  try {
    await db
      .update(goldenPathConfigsTable)
      .set({ isActive: false })
      .where(eq(goldenPathConfigsTable.isActive, true));

    res.json({
      id: null,
      name: "Default",
      description: "Built-in Golden Path configuration",
      rules: DEFAULT_GOLDEN_PATH_CONFIG,
      isActive: true,
      isDefault: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset config";
    console.error("Failed to reset golden path config:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
