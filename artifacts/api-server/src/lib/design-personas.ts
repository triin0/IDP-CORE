export type DesignPersonaId = "cupertino" | "terminal" | "startup" | "editorial" | "brutalist";

export interface DesignPersona {
  id: DesignPersonaId;
  name: string;
  tagline: string;
  emoji: string;
  styleTokens: string;
}

export const DESIGN_PERSONAS: Record<DesignPersonaId, DesignPersona> = {
  cupertino: {
    id: "cupertino",
    name: "The Cupertino",
    tagline: "Clean, elegant, Apple-inspired",
    emoji: "🍎",
    styleTokens: `DESIGN DIRECTIVE — "The Cupertino" Style
- Color palette: Pure white (#FFFFFF) backgrounds, soft grays (#F5F5F7, #E8E8ED), near-black text (#1D1D1F), blue accents (#0071E3)
- Typography: System font stack (-apple-system, SF Pro), generous letter-spacing, light/regular weights for body, semibold for headings
- Layout: Generous white space (40-80px section padding), max-width 1200px centered content, 8px grid system
- Components: Large rounded corners (12-16px), subtle box shadows (0 2px 12px rgba(0,0,0,0.08)), no hard borders
- Buttons: Pill-shaped (border-radius: 999px), filled primary with hover opacity, ghost secondary
- Cards: White background, 1px border rgba(0,0,0,0.04), subtle shadow on hover
- Animations: Smooth 300ms ease-out transitions, no bouncing or spring effects
- Forms: Minimal borders, bottom-border-only inputs, focus ring in blue
- Navigation: Clean top nav with logo left, links center, CTA right — sticky with blur backdrop`,
  },
  terminal: {
    id: "terminal",
    name: "The Terminal",
    tagline: "Hacker-grade, dark mode, monospace",
    emoji: "💻",
    styleTokens: `DESIGN DIRECTIVE — "The Terminal" Style
- Color palette: Deep black (#0A0A0F) background, dark panels (#111118), bright green (#00FF41) or cyan (#00D4FF) accents, muted gray (#666) secondary text
- Typography: Monospace font stack (JetBrains Mono, Fira Code, Consolas), 13-14px base size, uppercase labels with letter-spacing: 0.1em
- Layout: Dense information layout, minimal padding (16-24px), full-width panels, no rounded corners on outer containers
- Components: Hard borders (1px solid rgba(255,255,255,0.1)), no box shadows, subtle glow effects (box-shadow: 0 0 10px accent-color with 20% opacity)
- Buttons: Square or slightly rounded (4px), bordered with accent color, uppercase text, hover glow
- Cards: Dark background with 1px border, slight transparency, monospace labels
- Animations: Instant transitions (100ms), cursor-blink effect for status indicators, no smooth scrolling
- Forms: Dark inputs with accent-colored borders on focus, monospace placeholder text
- Navigation: Horizontal bar with breadcrumb-style paths, status badges, blinking indicators
- Special: Use ">" or "$" prefixes for labels, timestamps in HH:MM:SS format, status codes as badges`,
  },
  startup: {
    id: "startup",
    name: "The Startup",
    tagline: "Bold gradients, playful, energetic",
    emoji: "🚀",
    styleTokens: `DESIGN DIRECTIVE — "The Startup" Style
- Color palette: Vibrant gradients (purple-to-pink #7C3AED→#EC4899, blue-to-cyan #3B82F6→#06B6D4), dark (#0F172A) or white backgrounds, high contrast
- Typography: Modern sans-serif (Inter, Plus Jakarta Sans), extra-bold headings (800 weight), large hero text (48-72px), playful but readable
- Layout: Full-bleed hero sections, asymmetric grids, generous vertical spacing (80-120px between sections)
- Components: Medium rounded corners (12px), gradient borders, frosted glass effects (backdrop-filter: blur(20px)), colorful shadows (box-shadow with brand color at 25% opacity)
- Buttons: Gradient fills, large padding (16px 32px), bold text, hover scale(1.02) with enhanced shadow, emoji in CTAs encouraged
- Cards: White or dark with gradient accent stripe on top/left, hover lift effect (translateY(-4px))
- Animations: Spring-based (ease: cubic-bezier(0.34, 1.56, 0.64, 1)), bouncy hover effects, staggered entrance animations, floating elements
- Forms: Rounded inputs with thick focus rings in gradient colors, inline validation with icons
- Navigation: Transparent header that solidifies on scroll, gradient CTA button, mobile hamburger with full-screen overlay
- Special: Social proof sections, metric counters with animated numbers, testimonial carousels, "trusted by" logo bars`,
  },
  editorial: {
    id: "editorial",
    name: "The Editorial",
    tagline: "Sophisticated, content-first, magazine-quality",
    emoji: "📰",
    styleTokens: `DESIGN DIRECTIVE — "The Editorial" Style
- Color palette: Warm neutrals (cream #FAF8F5, warm gray #3D3D3D), black text, muted accent (terracotta #C45D3E or sage #6B7B5E), minimal color usage
- Typography: Serif headings (Playfair Display, Georgia, Times New Roman), sans-serif body (Inter, system-ui), dramatic size contrast (heading 3-5x body), generous line-height (1.7-1.8 for body)
- Layout: Single-column for reading (max-width 680px), multi-column grids for listings, generous margins, asymmetric layouts
- Components: Minimal decoration, thin borders (1px solid #E5E2DB), no rounded corners (or very subtle 2-4px), no box shadows
- Buttons: Text-styled links with underline, minimal filled buttons, small uppercase with wide letter-spacing
- Cards: Borderless with clear typographic hierarchy, image-heavy with overlay text, pull-quotes in large italic serif
- Animations: Subtle fade-ins only (opacity 0→1 over 600ms), no movement animations, smooth scroll
- Forms: Understated inputs with bottom-border only, elegant labels in small caps
- Navigation: Centered logo, minimal links, large footer with columnar layout, breadcrumbs in small serif
- Special: Drop caps on article openings, horizontal rules between sections, category tags in small caps`,
  },
  brutalist: {
    id: "brutalist",
    name: "The Brutalist",
    tagline: "Raw, bold, unapologetically loud",
    emoji: "🏗️",
    styleTokens: `DESIGN DIRECTIVE — "The Brutalist" Style
- Color palette: High contrast combos (black/white, black/yellow #FFE500, red #FF0000/white), flat colors only — no gradients
- Typography: Heavy-weight sans-serif (Arial Black, Impact, Bebas Neue), UPPERCASE headings, extremely large sizes (72-120px for heroes), tight line-height (0.9-1.0)
- Layout: Edge-to-edge blocks, intentionally asymmetric, overlapping elements, no padding consistency — some areas dense, some sparse
- Components: Hard 2-4px black borders, no rounded corners (0px), no shadows, visible grid lines encouraged
- Buttons: Thick black borders, uppercase text, hover inverts colors (black→white, white→black), oversized click targets
- Cards: Stark borders, no subtle effects, content blocks as raw rectangles, alternating black/white sections
- Animations: None or extremely abrupt (0ms transitions), content shifts on hover, no easing curves
- Forms: Thick-bordered inputs, monospace or heavy sans-serif, high contrast focus states
- Navigation: Large text links stacked vertically or in a grid, no hover underlines — use color inversion instead
- Special: Exposed structure (visible borders everywhere), raw/unpolished aesthetic, counter-rotate text, mix serif and sans-serif boldly`,
  },
};

export function getPersonaStyleTokens(personaId: string | null | undefined): string {
  if (!personaId) return "";
  const persona = DESIGN_PERSONAS[personaId as DesignPersonaId];
  if (!persona) return "";
  return persona.styleTokens;
}
