import type { ArtRequest } from '@app/types';

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

// Deterministic pseudo-random generator (LCG) for repeatable results by seed.
const lcg = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

const hashToHue = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
};

export const generatePlaceholderArt = async (req: ArtRequest & { seed: number }): Promise<string> => {
  const width = clamp(req.width, 128, 1024);
  const height = clamp(req.height, 128, 1024);

  const rand = lcg(req.seed);
  const baseHue = hashToHue(`${req.prompt}|${req.style}|${req.assetType}`);
  const hue2 = (baseHue + 45 + Math.floor(rand() * 90)) % 360;

  const title = `${req.assetType.toUpperCase()} • ${req.style}`;
  const prompt = req.prompt.length > 60 ? `${req.prompt.slice(0, 57)}...` : req.prompt;

  // Inline SVG that looks like a "generated" card; returned as a data URL.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${baseHue} 75% 55%)"/>
      <stop offset="1" stop-color="hsl(${hue2} 75% 50%)"/>
    </linearGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.12 0"/>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" filter="url(#noise)"/>

  <!-- Decorative grid -->
  <g opacity="0.18" stroke="white" stroke-width="1">
    ${Array.from({ length: 9 }).map((_, i) => {
      const x = Math.floor((width / 10) * (i + 1));
      return `<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`;
    }).join('')}
    ${Array.from({ length: 5 }).map((_, i) => {
      const y = Math.floor((height / 6) * (i + 1));
      return `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
    }).join('')}
  </g>

  <!-- "Subject" silhouette -->
  <g opacity="0.9" fill="rgba(0,0,0,0.25)">
    <path d="M ${Math.floor(width*0.18)} ${Math.floor(height*0.78)}
             C ${Math.floor(width*0.28)} ${Math.floor(height*0.55)}, ${Math.floor(width*0.35)} ${Math.floor(height*0.42)}, ${Math.floor(width*0.5)} ${Math.floor(height*0.44)}
             C ${Math.floor(width*0.62)} ${Math.floor(height*0.46)}, ${Math.floor(width*0.7)} ${Math.floor(height*0.58)}, ${Math.floor(width*0.82)} ${Math.floor(height*0.78)}
             L ${Math.floor(width*0.82)} ${Math.floor(height*0.9)}
             L ${Math.floor(width*0.18)} ${Math.floor(height*0.9)} Z"/>
    <circle cx="${Math.floor(width*0.52)}" cy="${Math.floor(height*0.32)}" r="${Math.floor(Math.min(width,height)*0.12)}"/>
  </g>

  <!-- Labels -->
  <g font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" fill="rgba(255,255,255,0.92)">
    <text x="${Math.floor(width*0.06)}" y="${Math.floor(height*0.12)}" font-size="${Math.max(14, Math.floor(width*0.045))}" font-weight="700">${escapeXml(title)}</text>
    <text x="${Math.floor(width*0.06)}" y="${Math.floor(height*0.2)}" font-size="${Math.max(12, Math.floor(width*0.035))}" opacity="0.9">Seed: ${req.seed}</text>
    <text x="${Math.floor(width*0.06)}" y="${Math.floor(height*0.88)}" font-size="${Math.max(12, Math.floor(width*0.03))}" opacity="0.95">${escapeXml(prompt)}</text>
  </g>
</svg>`;

  const encoded = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
};

const escapeXml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
