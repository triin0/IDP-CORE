export type DesignPersonaId = "sovereign" | "cupertino" | "terminal" | "startup" | "editorial" | "brutalist";

export const DEFAULT_PERSONA: DesignPersonaId = "sovereign";

export interface DesignPersona {
  id: DesignPersonaId;
  name: string;
  tagline: string;
  emoji: string;
  styleTokens: string;
}

export const DESIGN_PERSONAS: Record<DesignPersonaId, DesignPersona> = {
  sovereign: {
    id: "sovereign",
    name: "The Sovereign",
    tagline: "Premium dark glass, commercial-grade SaaS",
    emoji: "👑",
    styleTokens: `DESIGN DIRECTIVE — "The Sovereign" Style (MANDATORY DEFAULT)

COLOR SYSTEM:
- Background: Deep space slate (#0F172A) as body, darker panels (#020617) for sidebar/nav
- Surface: Semi-transparent glass panels — background: rgba(15, 23, 42, 0.8) with backdrop-filter: blur(16px) and border: 1px solid rgba(148, 163, 184, 0.1)
- Cards: background: rgba(30, 41, 59, 0.5), backdrop-filter: blur(12px), border: 1px solid rgba(148, 163, 184, 0.08), border-radius: 12px
- Primary accent: Electric indigo (#6366F1) — buttons, active states, focus rings
- Secondary accent: Cyan (#06B6D4) — links, badges, success states
- Text: Primary #F1F5F9 (slate-100), secondary #94A3B8 (slate-400), muted #64748B (slate-500)
- Danger: #EF4444, Warning: #F59E0B, Success: #10B981
- Subtle neon glow on interactive elements: box-shadow: 0 0 20px rgba(99, 102, 241, 0.15)

TYPOGRAPHY:
- Headings: Inter (weight 600-700), tracking tight (-0.025em), sizes: h1=2.25rem, h2=1.5rem, h3=1.25rem
- Body: Inter (weight 400), 0.875rem (14px), line-height 1.5
- Code/mono: JetBrains Mono, 0.8125rem (13px), used in badges, stats, table cells
- Load fonts via: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
- font-family: 'Inter', system-ui, -apple-system, sans-serif
- font-family for mono: 'JetBrains Mono', 'Fira Code', monospace

LAYOUT SHELL (MANDATORY):
Every app MUST start with a layout shell, never a naked vertical stack:
- Left sidebar: 64px collapsed / 240px expanded, background #020617, border-right: 1px solid rgba(148,163,184,0.1)
  - App icon/logo at top
  - Navigation items as icon+label rows with hover: background rgba(99,102,241,0.1), active: background rgba(99,102,241,0.15) + left border accent
- Top bar: height 56px, background rgba(15,23,42,0.8), backdrop-filter: blur(16px), border-bottom: 1px solid rgba(148,163,184,0.1)
  - Breadcrumb path on left (text-sm text-slate-400)
  - User avatar circle + settings icon on right
- Main content: centered max-width 960px with 32px padding, scrollable

COMPONENTS:
- Buttons (primary): bg-indigo-600 hover:bg-indigo-500, text-white, rounded-lg (8px), px-4 py-2, font-medium text-sm
  - Hover: subtle glow (box-shadow: 0 0 16px rgba(99,102,241,0.3)), transform: translateY(-1px), transition: all 200ms ease
  - Focus: ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900
- Buttons (secondary): bg-transparent border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white
- Buttons (danger): bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600/20
- Input fields: bg-slate-800/50, border border-slate-700, rounded-lg, text-slate-100, placeholder-slate-500
  - Focus: border-indigo-500, ring-1 ring-indigo-500/50, glow
- Cards: Glass panel (as described above), p-6, hover: border-color transitions to rgba(148,163,184,0.2)
- Tables: bg-transparent, th: text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/50
  - td: text-sm text-slate-300, border-b border-slate-800, hover:bg-slate-800/30
- Badges/pills: text-xs font-mono px-2 py-0.5 rounded-full, bg-indigo-500/10 text-indigo-400 border border-indigo-500/20
- Modals: Glass card centered, backdrop: bg-black/60 backdrop-blur-sm
- Toast notifications: Glass card with colored left border (4px), slide in from top-right

MICRO-ANIMATIONS (framer-motion REQUIRED):
- Page transitions: fade + slide up (y: 20 -> 0, opacity: 0 -> 1, duration: 0.3s)
- List items: staggered entrance (staggerChildren: 0.05), each item slides up with fade
- Cards on hover: subtle lift (y: -2px) + border glow transition
- Buttons: whileTap={{ scale: 0.97 }}
- Modals: overlay fade + card scale (0.95 -> 1) + slide up
- Delete animations: item shrinks (height: 0) + fade out before removal
- Add animations: new item expands from 0 height + fades in
- Skeleton loaders: pulse animation on placeholder rectangles while loading
- Use AnimatePresence for enter/exit transitions on conditional renders
- Import: import { motion, AnimatePresence } from "framer-motion"

CSS APPROACH:
- Use Tailwind CSS utility classes for ALL styling
- index.css: @import "tailwindcss"; plus custom CSS variables for the glass theme
- Add to index.css:
  @import "tailwindcss";
  :root { --glass-bg: rgba(15, 23, 42, 0.8); --glass-border: rgba(148, 163, 184, 0.1); --glow-indigo: rgba(99, 102, 241, 0.15); }
  body { background: #0F172A; color: #F1F5F9; font-family: 'Inter', system-ui, sans-serif; }
  * { scrollbar-width: thin; scrollbar-color: #334155 transparent; }

RESPONSIVE BEHAVIOR:
- Sidebar collapses to icon-only (64px) on screens < 1024px
- Top bar remains, content goes full width
- Cards stack vertically on mobile
- Minimum touch targets 44px on mobile`,
  },
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
  const id = personaId || DEFAULT_PERSONA;
  const persona = DESIGN_PERSONAS[id as DesignPersonaId];
  if (!persona) return DESIGN_PERSONAS[DEFAULT_PERSONA].styleTokens;
  return persona.styleTokens;
}
