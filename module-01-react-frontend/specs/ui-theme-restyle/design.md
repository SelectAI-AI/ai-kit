# Design — UI Theme Restyle

## Approach

Retheme via the existing shadcn/ui CSS-variable token system already in place (`src/index.css` + `tailwind.config.ts`) rather than introducing a new styling system. This keeps the change confined to token values + a small number of new gradient utilities, so component code (`ui/*.tsx`, `AppShell.tsx`) needs only class-level edits, not structural rewrites.

## 1. Color tokens (`src/index.css`)

Replace the `:root` block's HSL values with a dark set. All existing token *names* are kept (so nothing consuming `hsl(var(--x))` breaks) — only values change:

| Token | Current (light) | New (dark) | Notes |
|---|---|---|---|
| `--background` | `0 0% 100%` | `240 25% 5%` | near-black navy |
| `--foreground` | `222.2 84% 4.9%` | `210 40% 96%` | near-white |
| `--card` | `0 0% 100%` | `240 20% 8%` | slightly lighter than bg |
| `--card-foreground` | dark | `210 40% 96%` | |
| `--popover` / `--popover-foreground` | light | same as card / foreground | |
| `--primary` | dark navy | `320 85% 55%` | pink anchor of the gradient (used where a flat primary color, not gradient, is needed) |
| `--primary-foreground` | light | `0 0% 100%` | |
| `--secondary` | light gray | `240 15% 14%` | dark surface for secondary buttons/panels |
| `--secondary-foreground` | dark | `190 95% 55%` | cyan text on secondary surfaces |
| `--muted` | light gray | `240 15% 12%` | |
| `--muted-foreground` | gray | `220 15% 65%` | body copy on dark bg, tuned for AA contrast |
| `--accent` | light gray | `190 95% 55%` | cyan |
| `--accent-foreground` | dark | `240 25% 5%` | |
| `--destructive` | red | unchanged (`0 84.2% 60.2%`) | red still reads fine on dark |
| `--border` | light gray | `240 15% 20%` | subtle light-on-dark border |
| `--input` | light gray | `240 15% 20%` | |
| `--ring` | dark | `190 95% 55%` | cyan focus ring |
| `--radius` | `0.5rem` | unchanged | |

New tokens added (not part of shadcn defaults, needed for the gradient language):
```css
--gradient-primary: linear-gradient(135deg, hsl(320 85% 55%), hsl(265 80% 58%));
--gradient-glow-purple: radial-gradient(circle, hsl(270 80% 40% / 0.25), transparent 70%);
--gradient-glow-pink: radial-gradient(circle, hsl(320 85% 50% / 0.2), transparent 70%);
```

## 2. Tailwind config (`tailwind.config.ts`)

No structural changes to the `colors` block (still reads from the same CSS vars). Add:
```ts
backgroundImage: {
  'gradient-primary': 'var(--gradient-primary)',
},
```
under `theme.extend`, so components can use `bg-gradient-primary` as a utility class alongside existing `bg-primary`.

## 3. Component-level changes

### `src/components/ui/button.tsx`
- `default` variant: switch background from `bg-primary` (flat) to `bg-gradient-primary text-white`, keep existing hover/focus/disabled states via opacity transitions (`hover:opacity-90`) rather than color swaps (gradients don't `darken()` the same way flat colors do).
- `outline` variant: border color from `border-input` (gray) to `border-accent` (cyan) with `text-accent`, transparent background — matches the "Explore Services" / "Follow on LinkedIn" buttons in the reference.
- No change to size variants or component structure.

### `src/components/ui/card.tsx`, `badge.tsx`, `progress.tsx`, `separator.tsx`, `skeleton.tsx`
- Value-only changes: these already consume `--card`, `--border`, `--muted`, `--accent` tokens, so most will pick up the new dark palette automatically once `index.css` changes land. `progress.tsx`'s fill should be updated from a flat fill color to `bg-gradient-primary` to match the reference's use of gradient as a "liveliness" indicator.

### `src/components/AppShell.tsx`
Currently hardcodes Tailwind gray/blue utility classes directly (`bg-white`, `border-gray-200`, `bg-blue-50`, `text-blue-700`, etc.) instead of the semantic tokens — this file needs direct class edits, not just token changes:

- Header: `bg-white` → `bg-background`, `border-gray-200` → `border-border`, heading text → `text-foreground` with slightly increased `tracking-wide font-bold` to approximate the reference's display heading style.
- API status badge: keep semantic green/red for connected/disconnected (still meaningful state color, not brand color) but adjust background opacity so it reads correctly on dark (`bg-green-500/10 text-green-400`, `bg-red-500/10 text-red-400`).
- Progress bar track: `bg-gray-200` → `bg-secondary`; fill: `bg-blue-500` → `bg-gradient-primary`.
- Sidebar nav: `bg-gray-50 border-gray-200` → `bg-card border-border`; active step: `bg-blue-50 text-blue-700 border-blue-600` → `bg-secondary text-accent border-accent` (cyan accent border, matching reference's cyan highlight usage for active/selected state); locked step stays `text-muted-foreground` with reduced opacity, unchanged interaction (still `alert()`-blocked — no behavior change).
- Main content area: no structural change; relies on `bg-background`/`text-foreground` inherited from `body`.

## 4. Stretch goal — background texture (optional, pending confirmation)

If pursued: add a `bg-grid` utility (CSS `background-image: linear-gradient` grid lines at low opacity) plus one or two fixed-position radial-gradient glow `div`s behind `AppShell`'s root container, using the `--gradient-glow-*` tokens. Purely decorative, `pointer-events-none`, `aria-hidden`, zero impact on layout or tests. Deferred unless explicitly requested — adds visual complexity without functional value and risks contrast issues if not tuned carefully.

## 5. Testing impact

Reviewed existing tests (`src/__tests__/*`) for hardcoded color-class assertions:
- `App.test.tsx`, `useProgress.test.ts`: assert on route/state behavior, not colors — unaffected.
- No test currently asserts on `bg-blue-500`, `text-gray-700`, etc. by class string (spot-checked via the AppShell test coverage) — confirm during implementation; any found will be updated to assert on `data-testid`/`aria-*` attributes instead of color classes, per the acceptance criteria in requirements.md.

## 6. Rollout

Single PR/commit scope: `src/index.css`, `tailwind.config.ts`, `src/components/ui/*.tsx`, `src/components/AppShell.tsx`. No migration steps, no feature flag — this is a pure visual change with no data/schema implications.
