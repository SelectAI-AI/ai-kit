# Requirements — UI Theme Restyle

## Background

The app currently uses the default shadcn/ui light theme (white background, gray borders, blue accents — see `src/index.css` and `tailwind.config.ts`). We're restyling it to match the dark, gradient-driven visual identity shown in the reference screenshot (SelectAI Innovations landing page): near-black background, subtle grid texture, and pink→purple→cyan gradients as the primary accent language.

## Scope

**In scope:**
- Replace the color token set (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--muted`, `--accent`, etc. in `src/index.css`) with a dark palette matching the reference image.
- Add gradient utility tokens/classes for the pink→purple and cyan accent gradients seen in the image (primary CTA buttons, headline accents, active nav states).
- Restyle existing UI primitives in `src/components/ui/` (`button.tsx`, `card.tsx`, `badge.tsx`, `progress.tsx`, `separator.tsx`, `skeleton.tsx`) to use the new tokens.
- Restyle `AppShell.tsx` (header, API status badge, progress bar, step nav) to the dark theme.
- Preserve all existing functionality: step locking, progress tracking, API status polling — visual only, no behavior changes.

**Out of scope (per decision):**
- No new marketing/landing hero page. This app's routes remain `/step/1`–`/step/6`; we are not building the nav bar / hero / "Book a Demo" layout from the screenshot.
- No changes to the four unrouted legacy pages (`EvalDashboard`, `LabViewer`, `Playground`, `QueryRouter`) unless later requested.
- No changes to backend, API contracts, or content of Step pages — text/copy stays as-is.

## Visual requirements (derived from reference image)

1. **Background**: near-black / very dark navy (`#05060a`–`#0a0a12` range), with a faint grid-line texture and soft radial purple/pink glow in corners — at minimum the base dark background color must be applied; the grid/glow is a stretch goal, not a hard requirement.
2. **Primary gradient**: pink (`#ec1a91`-ish) → purple (`#7b2ff7`-ish) diagonal gradient, used on:
   - Primary CTA buttons (equivalent of "Book a Demo")
   - Active/current step indicator in the nav
3. **Secondary accent**: cyan/teal (`#22d3ee`-ish), used on:
   - Secondary button borders/text (equivalent of "Explore Services", "Follow on LinkedIn" outlined buttons)
   - Links, focus rings, small accent text (e.g. "SELECTAI INNOVATIONS" eyebrow label style)
4. **Typography**: headings use a bold, slightly tracked-out geometric/monospace-adjacent display face in the reference; we will approximate with existing font stack + increased letter-spacing and font-weight on headings — not introducing a new webfont unless explicitly requested.
5. **Borders**: thin, low-opacity light borders on cards/panels (not the loud gray borders currently used) — outlined-button style with 1px cyan or pink border matching the two secondary buttons in the image.
6. **Contrast/accessibility**: body text on dark background must meet WCAG AA contrast (4.5:1 for normal text). Locked-step and disabled states must remain visually distinguishable from active/enabled ones.

## Acceptance criteria

- [ ] All existing CSS variable tokens are redefined for a dark theme; no component references old light-mode-only values.
- [ ] Primary buttons across the app use the pink→purple gradient.
- [ ] At least one accent surface (active nav item or progress bar fill) uses the pink→purple gradient or the cyan accent.
- [ ] Existing Vitest suite (`npm test`) passes unchanged — no test asserts on now-removed color class names in a way that breaks; any such tests are updated to assert on structure/behavior rather than exact color classes.
- [ ] `npm run lint` and `npm run build` pass with no new errors.
- [ ] Manually verified in the browser: AppShell header, sidebar nav (locked/unlocked/active/completed states), and at least one Step page render legibly against the new dark background.
- [ ] Locked step styling and disabled states remain visually distinct after the retheme.

## Open questions for review

- Exact hex values above are estimates read off the screenshot — should be fine-tuned against the actual image during implementation rather than treated as final.
- Should the grid-texture/glow background effect be attempted now, or deferred to a follow-up polish task? (Marked stretch goal above pending your confirmation.)
