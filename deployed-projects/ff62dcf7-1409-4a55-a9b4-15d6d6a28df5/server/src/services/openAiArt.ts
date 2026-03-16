import OpenAI from 'openai';
import type { ArtRequest } from '@app/types';

const styleHint = (style: ArtRequest['style']): string => {
  switch (style) {
    case 'pixel':
      return 'pixel art, crisp edges, limited palette, game sprite style';
    case 'vector':
      return 'clean vector illustration, flat colors, sharp shapes';
    case 'isometric':
      return 'isometric game asset render, 3/4 view, consistent lighting';
    case 'handpainted':
      return 'hand-painted game art, painterly brushwork, vibrant lighting';
    case 'lowpoly':
      return 'low-poly 3D game asset, simple geometry, soft shading';
    case 'concept':
      return 'concept art for a game, cinematic lighting, detailed design';
  }
};

const assetHint = (assetType: ArtRequest['assetType']): string => {
  switch (assetType) {
    case 'character':
      return 'full-body character design, neutral background';
    case 'environment':
      return 'environment scene key art, readable silhouettes';
    case 'icon':
      return 'small readable icon, centered composition, transparent or plain background';
    case 'item':
      return 'single item/prop, centered, product shot lighting';
    case 'ui':
      return 'game UI panel element, clean readability, high contrast';
    case 'texture':
      return 'seamless tileable texture, consistent pattern';
  }
};

export const generateOpenAiArt = async (input: {
  apiKey: string;
  model: string;
  request: ArtRequest & { seed: number };
}): Promise<string> => {
  const client = new OpenAI({ apiKey: input.apiKey });

  const prompt = [
    'Create game-ready art.',
    styleHint(input.request.style),
    assetHint(input.request.assetType),
    `Prompt: ${input.request.prompt}`,
    `Output size: ${input.request.width}x${input.request.height}.`
  ].join('\n');

  // Use the Images API. If the API/model changes, keep server-side only.
  const result = await client.images.generate({
    model: input.model,
    prompt,
    size: `${input.request.width}x${input.request.height}`
  });

  const first = result.data[0];
  if (!first) {
    const e = new Error('Image generation returned no data') as Error & { status?: number; code?: string };
    e.status = 502;
    e.code = 'IMAGE_PROVIDER_EMPTY';
    throw e;
  }

  if (typeof first.b64_json === 'string' && first.b64_json.length > 0) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  // Some configurations may return a URL; fetch would be required.
  // To keep dependencies minimal and deterministic, we fail with a clear error.
  const e = new Error('Provider did not return base64 image data') as Error & { status?: number; code?: string };
  e.status = 502;
  e.code = 'IMAGE_PROVIDER_UNSUPPORTED_RESPONSE';
  throw e;
};
