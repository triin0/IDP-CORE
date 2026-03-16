import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import type { ArtRequest } from '@app/types';

const styleValues = ['pixel', 'vector', 'isometric', 'handpainted', 'lowpoly', 'concept'] as const;
const assetTypeValues = ['character', 'environment', 'icon', 'item', 'ui', 'texture'] as const;

const formSchema = z.object({
  prompt: z.string().min(3).max(300),
  style: z.enum(styleValues),
  assetType: z.enum(assetTypeValues),
  width: z.number().int().min(128).max(1024),
  height: z.number().int().min(128).max(1024),
  seed: z.union([z.number().int().min(0).max(2_147_483_647), z.nan()]).optional()
});

export const ArtForm = (props: {
  busy: boolean;
  onGenerate: (req: ArtRequest) => Promise<void>;
}): React.ReactElement => {
  const [prompt, setPrompt] = useState<string>('A friendly slime knight with a tiny shield');
  const [style, setStyle] = useState<ArtRequest['style']>('pixel');
  const [assetType, setAssetType] = useState<ArtRequest['assetType']>('character');
  const [width, setWidth] = useState<number>(512);
  const [height, setHeight] = useState<number>(512);
  const [seed, setSeed] = useState<string>('');

  const validationError = useMemo(() => {
    const parsedSeed = seed.trim().length === 0 ? Number.NaN : Number(seed);
    const res = formSchema.safeParse({
      prompt,
      style,
      assetType,
      width,
      height,
      seed: parsedSeed
    });
    return res.success ? null : res.error.issues[0]?.message ?? 'Invalid input';
  }, [prompt, style, assetType, width, height, seed]);

  const submit = async (): Promise<void> => {
    const parsedSeed = seed.trim().length === 0 ? undefined : Number(seed);

    const parsed = z
      .object({
        prompt: z.string().min(3).max(300),
        style: z.enum(styleValues),
        assetType: z.enum(assetTypeValues),
        width: z.number().int().min(128).max(1024),
        height: z.number().int().min(128).max(1024),
        seed: z.number().int().min(0).max(2_147_483_647).optional()
      })
      .parse({ prompt, style, assetType, width, height, seed: parsedSeed });

    await props.onGenerate(parsed);
  };

  return (
    <div>
      <div className="row">
        <label>Prompt</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your game asset..." />
      </div>

      <div className="row" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="row" style={{ marginBottom: 0 }}>
          <label>Style</label>
          <select value={style} onChange={(e) => setStyle(e.target.value as ArtRequest['style'])}>
            {styleValues.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginBottom: 0 }}>
          <label>Asset type</label>
          <select value={assetType} onChange={(e) => setAssetType(e.target.value as ArtRequest['assetType'])}>
            {assetTypeValues.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="row" style={{ marginBottom: 0 }}>
          <label>Width</label>
          <input type="number" value={width} min={128} max={1024} step={64} onChange={(e) => setWidth(Number(e.target.value))} />
        </div>
        <div className="row" style={{ marginBottom: 0 }}>
          <label>Height</label>
          <input type="number" value={height} min={128} max={1024} step={64} onChange={(e) => setHeight(Number(e.target.value))} />
        </div>
      </div>

      <div className="row">
        <label>Seed (optional)</label>
        <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Leave blank for random" inputMode="numeric" />
      </div>

      {validationError ? <div className="err" style={{ marginBottom: 12 }}>{validationError}</div> : null}

      <button className="btn" onClick={() => void submit()} disabled={props.busy || Boolean(validationError)}>
        {props.busy ? 'Generating...' : 'Generate'}
      </button>
    </div>
  );
};
