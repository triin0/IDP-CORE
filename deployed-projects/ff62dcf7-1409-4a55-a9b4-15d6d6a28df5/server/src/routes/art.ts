import { Router } from 'express';
import { z } from 'zod';
import type { ArtRequest, GeneratedArt } from '@app/types';

import { env } from '../lib/env.js';
import { runMigrations } from '../lib/migrate.js';
import { newId } from '../lib/id.js';
import { query } from '../lib/db.js';
import { generatePlaceholderArt } from '../services/placeholderArt.js';
import { generateOpenAiArt } from '../services/openAiArt.js';

const styleEnum = z.enum(['pixel', 'vector', 'isometric', 'handpainted', 'lowpoly', 'concept']);
const assetTypeEnum = z.enum(['character', 'environment', 'icon', 'item', 'ui', 'texture']);

const createArtBodySchema = z.object({
  prompt: z.string().min(3).max(300),
  style: styleEnum,
  assetType: assetTypeEnum,
  width: z.number().int().min(128).max(1024),
  height: z.number().int().min(128).max(1024),
  seed: z.number().int().min(0).max(2_147_483_647).optional()
});

const idParamSchema = z.object({
  id: z.string().uuid()
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

export const artRouter = Router();

// Ensure tables exist (safe for dev/demo). In enterprise, use real migrations.
let migrationsRan = false;
const ensureMigrations = async (): Promise<void> => {
  if (migrationsRan) return;
  await runMigrations();
  migrationsRan = true;
};

artRouter.post('/', async (req, res, next) => {
  try {
    await ensureMigrations();

    const body = createArtBodySchema.parse(req.body) satisfies ArtRequest;

    const seed = typeof body.seed === 'number' ? body.seed : Math.floor(Math.random() * 2_147_483_647);

    const useOpenAi = typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.length > 0;

    const imageDataUrl = useOpenAi
      ? await generateOpenAiArt({
          apiKey: env.OPENAI_API_KEY!,
          model: env.OPENAI_IMAGE_MODEL,
          request: { ...body, seed }
        })
      : await generatePlaceholderArt({ ...body, seed });

    const id = newId();

    const insertSql =
      'INSERT INTO generated_art (id, prompt, style, asset_type, width, height, seed, image_data_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)';

    await query(insertSql, [
      id,
      body.prompt,
      body.style,
      body.assetType,
      body.width,
      body.height,
      seed,
      imageDataUrl
    ]);

    const result = await query<{
      id: string;
      prompt: string;
      style: string;
      asset_type: string;
      width: number;
      height: number;
      seed: number;
      image_data_url: string;
      created_at: Date;
    }>('SELECT * FROM generated_art WHERE id = $1', [id]);

    const row = result.rows[0];
    if (!row) {
      const e = new Error('Failed to load created record') as Error & { status?: number; code?: string };
      e.status = 500;
      e.code = 'DB_READ_AFTER_WRITE_FAILED';
      throw e;
    }

    const art: GeneratedArt = {
      id: row.id,
      prompt: row.prompt,
      style: row.style as GeneratedArt['style'],
      assetType: row.asset_type as GeneratedArt['assetType'],
      width: row.width,
      height: row.height,
      seed: row.seed,
      imageDataUrl: row.image_data_url,
      createdAt: row.created_at.toISOString()
    };

    res.status(201).json({ data: art });
  } catch (err) {
    next(err);
  }
});

artRouter.get('/', async (req, res, next) => {
  try {
    await ensureMigrations();

    const q = listQuerySchema.parse(req.query);

    const result = await query<{
      id: string;
      prompt: string;
      style: string;
      asset_type: string;
      width: number;
      height: number;
      seed: number;
      image_data_url: string;
      created_at: Date;
    }>('SELECT * FROM generated_art ORDER BY created_at DESC LIMIT $1', [q.limit]);

    const arts: GeneratedArt[] = result.rows.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      style: row.style as GeneratedArt['style'],
      assetType: row.asset_type as GeneratedArt['assetType'],
      width: row.width,
      height: row.height,
      seed: row.seed,
      imageDataUrl: row.image_data_url,
      createdAt: row.created_at.toISOString()
    }));

    res.status(200).json({ data: arts });
  } catch (err) {
    next(err);
  }
});

artRouter.get('/:id', async (req, res, next) => {
  try {
    await ensureMigrations();

    const { id } = idParamSchema.parse(req.params);

    const result = await query<{
      id: string;
      prompt: string;
      style: string;
      asset_type: string;
      width: number;
      height: number;
      seed: number;
      image_data_url: string;
      created_at: Date;
    }>('SELECT * FROM generated_art WHERE id = $1', [id]);

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Art not found',
          requestId: req.requestId
        }
      });
      return;
    }

    const art: GeneratedArt = {
      id: row.id,
      prompt: row.prompt,
      style: row.style as GeneratedArt['style'],
      assetType: row.asset_type as GeneratedArt['assetType'],
      width: row.width,
      height: row.height,
      seed: row.seed,
      imageDataUrl: row.image_data_url,
      createdAt: row.created_at.toISOString()
    };

    res.status(200).json({ data: art });
  } catch (err) {
    next(err);
  }
});
