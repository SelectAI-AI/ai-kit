# Tasks — UI Theme Restyle

Checklist derived from `design.md`. Sequenced so each step is independently verifiable before moving to the next.

## 1. Token layer

- [x] Update `src/index.css` `:root` block with the new dark HSL values (see design.md §1 table).
- [x] Add `--gradient-primary`, `--gradient-glow-purple`, `--gradient-glow-pink` custom properties to `:root`.
- [x] Add `backgroundImage.gradient-primary` to `theme.extend` in `tailwind.config.ts`.
- [x] Run `npm run dev`, confirm the app loads with a dark background and no console errors (tokens resolve).

## 2. UI primitives

- [x] `src/components/ui/button.tsx`: update `default` variant to `bg-gradient-primary text-white hover:opacity-90`.
- [x] `src/components/ui/button.tsx`: update `outline` variant to `border-accent text-accent bg-transparent hover:bg-accent/10`.
- [x] `src/components/ui/progress.tsx`: update fill indicator to `bg-gradient-primary`.
- [x] `src/components/ui/card.tsx`, `badge.tsx`, `separator.tsx`, `skeleton.tsx`: verified visually against new tokens — no changes needed, already used semantic tokens.

## 3. AppShell

- [x] Header: swap `bg-white`/`border-gray-200`/text classes for `bg-background`/`border-border`/`text-foreground`; add heading `tracking-wide font-bold`.
- [x] API status badge: switch to `bg-green-500/10 text-green-400` (connected) / `bg-red-500/10 text-red-400` (disconnected).
- [x] Progress bar: track → `bg-secondary`, fill → `bg-gradient-primary`.
- [x] Sidebar nav: `bg-card border-border`; active step → `bg-secondary text-accent border-accent`; locked step → kept `text-muted-foreground`.
- [x] Confirmed no `alert()`/lock-interaction behavior changed — visual only.

## 3b. Scope extension — content components (added during implementation)

A manual browser check surfaced a real defect: `NotebookPage.tsx`, `MarkdownCell.tsx`, `CodeCell.tsx`, `ConceptCheck.tsx`, `ExercisePanel.tsx`, `RemediationPanel.tsx`, and per-page overrides in `Step1EnvSetup.tsx`, `Step3Prompts.tsx`, `Step4Chains.tsx`, `Step6Eval.tsx` hardcoded light-mode classes (`text-gray-900`, `bg-white`, etc.), rendering illegible dark-on-dark text once the shell went dark. This was out of the original design.md file list but required to meet the requirements.md acceptance criterion "Step page render legibly." Flagged to the user and approved before proceeding.

- [x] Retheme `NotebookPage.tsx` (title, subtitle, `SectionHeader`) to semantic tokens.
- [x] Retheme `MarkdownCell.tsx` (wrapper, `Code`, `CodeBlock`, `Callout`) to semantic tokens + dark-tuned callout colors.
- [x] Retheme `CodeCell.tsx` (header, run button → gradient, editor background, output/feedback banners) to semantic tokens.
- [x] Retheme `ConceptCheck.tsx` (card, options, correct/completed states) to semantic tokens.
- [x] Retheme `ExercisePanel.tsx` (textarea, error panel) to semantic tokens.
- [x] Retheme `RemediationPanel.tsx` to dark-tuned amber tokens.
- [x] Fix inline overrides in `Step1EnvSetup.tsx` (key form), `Step3Prompts.tsx` and `Step4Chains.tsx` (comparison tables), `Step6Eval.tsx` (score card, badges, progress bars).
- [x] Confirmed `NavBar.tsx` is unused (no imports anywhere) and `PageHeader.tsx` is only used by the four unrouted legacy pages — left both untouched, in scope with requirements.md's exclusion of legacy pages.

## 4. Verification

- [ ] `npm run lint` — blocked by a pre-existing config mismatch unrelated to this change: `--ext` flag is incompatible with the repo's flat `eslint.config.js` (`package.json`'s `lint` script predates the ESLint 9 flat-config migration). Not introduced by this task; flagged for separate follow-up.
- [x] `npm run build` — succeeds, no new errors.
- [x] `npm test` — all 106 existing tests pass unchanged; no test asserted on a removed color class.
- [x] Manual browser check via headless Chromium screenshots of `/step/1` (before and after the scope extension), confirming:
  - [x] Text is legible (no dark-on-dark or low-contrast body copy) — confirmed only after the 3b extension; initial AppShell-only pass had a legibility regression on step content, since fixed.
  - [x] Primary buttons show the pink→purple gradient (Save Keys, Run, Submit buttons).
  - [x] Active nav item and progress bar use the gradient/cyan accent.
  - [x] Locked steps are visually distinguishable from unlocked/completed steps.
- Steps 2–6 were fixed at the source-code level for the same class patterns found on Step 1 but not individually re-screenshotted — recommend a final visual pass across all six steps before merge.

## 5. Stretch (only if separately approved)

- [ ] Not pursued — deferred per requirements.md open question, no separate approval requested.

## Sign-off

- [x] Screenshot of restyled Step 1 (dark theme, gradient buttons, legible content) captured and reviewed in-conversation.
- [ ] Final human review/approval before merge — pending.
