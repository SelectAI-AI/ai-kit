# Implementation Plan: Notebook Content Protection

## Overview

This plan ports the display-only content-protection layer into the plain-JSX `course-ai-platform` frontend and removes the two content-exfiltration paths on the frontend and FastAPI backend. Work proceeds bottom-up: first the standalone banner channel, then the banner component, then the screen-capture guard hook, then wiring into `App.jsx`, then the preview-pane protection and control removal in `ModuleDetail.jsx`, and finally the backend route removal. Each step ends with the code integrated into an already-wired path so nothing is left orphaned.

Implementation language: **plain JSX / JavaScript** (React 19 + Vite) for the frontend, **Python** (FastAPI) for the backend, as specified in the design.

## Tasks

- [x] 1. Add fast-check dev dependency and confirm test tooling
  - Add `fast-check` to `frontend/package.json` devDependencies (it is not currently present) so the Property 1 round-trip test can run under Vitest
  - Verify Vitest + `@testing-library/react` + jsdom config is available for the new test files
  - _Requirements: 11.5_

- [x] 2. Implement the banner event channel
  - [x] 2.1 Create `src/lib/securityBanner.js` (Banner_Channel)
    - Export the module-level constant `SECURITY_BANNER_EVENT = "app:security-banner"` (non-empty string, stable across imports)
    - Implement `showSecurityBanner(message)`: validate `typeof message === "string"` and return `false` (dispatch nothing) when not a string; resolve the global target defensively (`window`/`globalThis`) and return `false` without throwing when no `dispatchEvent`-capable target exists; otherwise dispatch exactly one `CustomEvent(SECURITY_BANNER_EVENT, { detail: { message } })` with the message placed verbatim (no trim/encode/truncate) and return `true`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 2.2 Write property test for the banner channel round-trip
    - **Property 1: Banner-channel message round-trip is byte-for-byte identical**
    - **Validates: Requirements 5.3, 11.5**
    - File: `frontend/src/lib/securityBanner.property.test.js`; use `fc.string({ maxLength: 10000 })` (including empty string), register a `SECURITY_BANNER_EVENT` listener, call `showSecurityBanner(s)`, assert received `detail.message === s`; config `{ numRuns: 100 }`
    - Include tag comment: `// Feature: notebook-content-protection, Property 1: For any string s (len 0..10000), showSecurityBanner round-trips s byte-for-byte to the listener`

  - [x] 2.3 Write example/edge-case unit tests for the banner channel
    - `SECURITY_BANNER_EVENT` is a non-empty string and identical across imports (5.1); valid string dispatches exactly one event (5.2); non-string inputs (null, undefined, number, object, array, boolean) rejected with no dispatch and `false` return (5.4); no global target → no throw, returns `false` (5.5)
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 3. Implement the security banner component
  - [x] 3.1 Create `src/components/SecurityBanner.jsx` (Security_Banner)
    - No props; internal `message` state (string | null) and a `timeoutRef`
    - On mount register one `SECURITY_BANNER_EVENT` listener; on unmount remove it and clear the pending timer
    - On event read `e.detail?.message`: if missing/empty → ignore, keep current message, do not restart timer; if length > 200 → display `message.slice(0, 200)`; otherwise display as-is
    - On any accepted message set `message`, clear existing timer, start fresh `setTimeout(2800ms)` that resets `message` to `null`; a newer message replaces text and restarts the timer from zero
    - Render visible when `message` is non-null (`data-testid="security-banner"`, `role="alert"`, on-screen) and hidden when null; style with platform CSS-variable tokens (ink/paper/brass), not source-module tokens
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 3.2 Write unit tests for the security banner (fake timers)
    - Displays received message and is visible while shown (6.1, 6.4); empty/missing message ignored with current message + timer retained (6.2, 7.5); message > 200 chars truncated to first 200, test 250-char, 10000-char, and a unicode boundary (6.3); hides after 2800 ms with no newer message (6.5); newer message replaces text and restarts the 2800 ms timer (6.6); unmount removes listener and cancels timer (6.7)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.5_

- [x] 4. Implement the screen capture guard hook
  - [x] 4.1 Create `src/hooks/useScreenCaptureGuard.js` (Screen_Capture_Guard)
    - Return `blurred` (boolean, initial `false`); use a ref to track whether the PrintScreen notice is currently active for de-duplication
    - On mount wire (and on unmount remove): `window` `blur` → set `blurred` true and, only on a false→true transition, dispatch exactly one blur banner; `window` `focus` → set `blurred` false; `document` `visibilitychange` → hidden behaves like blur, visible behaves like focus; `window` `keyup` → if `e.key == null` do nothing, if `e.key === "PrintScreen"` dispatch the PrintScreen banner unless the notice is already active, any other key dispatches nothing
    - Track the PrintScreen "notice active" ref set on dispatch and cleared after 2800 ms so repeated PrintScreen keyups within that window do not re-dispatch
    - Use the standard message constants for blur (window inactive) and PrintScreen (screenshots unsupported)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.2 Write unit tests for the screen capture guard (renderHook)
    - `blur` → blurred true, `focus` → blurred false (3.1, 3.3); `visibilitychange` hidden → true, visible → false (3.2, 3.4); false→true transition dispatches exactly one blur banner, repeated blur while blurred stays true with no extra banner (3.6, 3.8); keyup PrintScreen → exactly one banner, other keys → zero (4.1, 4.2); repeated PrintScreen within dismiss window → no additional banner (4.3); PrintScreen banner persists for the dismiss interval (4.4); keyup with absent key data → no banner, no throw (4.5)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Wire the banner and guard into the application root
  - [x] 5.1 Update `src/App.jsx` (App_Root)
    - Import and render `<SecurityBanner />` exactly once, above the routed content and outside `<Routes>`, so exactly one instance/listener exists and it persists across route transitions
    - Call `useScreenCaptureGuard()` and wrap the protected content region in a div whose class includes `blur-xl` (≥ 8px) when `blurred` is true, transitions the filter, and removes it when unblurred; keep the banner outside the blurred region so the notice stays legible
    - _Requirements: 3.5, 3.7, 7.1, 7.2, 7.3, 7.4_

  - [x] 5.2 Write unit tests for App root integration
    - Exactly one `SecurityBanner` in the tree (7.1); it persists across route transitions (7.2); an event dispatched from any component shows within 500 ms (7.3); blur wrapper gets the `blur-xl` (≥ 8px) class when blurred and removes it when unblurred (3.5, 3.7)
    - _Requirements: 3.5, 3.7, 7.1, 7.2, 7.3_

- [x] 6. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add preview-pane protection and remove download controls in ModuleDetail
  - [x] 7.1 Add copy/cut/paste and keyboard blocking to the Notebook_Preview_Pane
    - On the `dangerouslySetInnerHTML` container add `onCopy`/`onCut`/`onPaste` handlers that `e.preventDefault()` and dispatch one banner (5.x messages via `showSecurityBanner`)
    - Add an `onKeyDown` handler that detects Ctrl/Meta+C/X/V (case-insensitive) and Shift+Insert and calls `preventDefault()` + one banner; also handle Select-All (Ctrl/Meta+A) so no content is selected
    - Implement a shared `blockAndNotify(e, message)` helper that calls `e.preventDefault()` first, then dispatches the banner inside a `try/catch` so a dispatch failure never un-blocks the action
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 7.2 Add selection and context-menu blocking to the Notebook_Preview_Pane
    - Apply `user-select: none` plus vendor prefixes (`-webkit-`, `-moz-`, `-ms-`) to 100% of the container's rendered content, including dynamically inserted content, so selection gestures yield zero selected characters
    - Add an `onContextMenu` handler that calls `preventDefault()` and dispatches exactly one banner per event
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 7.3 Remove the per-notebook and package download controls and helper import
    - Delete the "download unlocked package" button in the header and the "download .ipynb" button in `NotebookRow`
    - Remove `import { downloadFile } from "../download"` and all references to it, and remove now-unused `lucide-react` icons (`Download`, `Package`) from the import so no unused import remains and the build stays clean
    - Preserve the `preview` load via the view endpoint, its error handling, and the self-attestation completion `submit` flow unchanged
    - _Requirements: 8.1, 9.1, 9.4, 9.5, 10.1, 10.2, 10.3_

  - [x] 7.4 Write unit tests for ModuleDetail preview protection and control removal
    - Ctrl/Meta+C/X/V (case-insensitive) and Shift+Insert keydown → preventDefault + one banner (1.1–1.4, 1.6); native copy/cut/paste events → preventDefault (1.5); banner dispatch throwing still prevents default (1.7); container has `user-select: none` + vendor prefixes (2.1); Select-All prevented / zero selection (2.2); contextmenu → preventDefault + exactly one banner per event (2.3, 2.4); no `.ipynb` download control and no package-download control rendered (8.1, 9.1); preview renders returned HTML (10.1); view error shows error indication with no partial render (10.2); self-attestation completion still records completion (10.3)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 8.1, 9.1, 10.1, 10.2, 10.3_

- [x] 8. Checkpoint - Ensure frontend builds and lints cleanly
  - Ensure the frontend builds and lints with the `download` helper import removed and no unused-import remaining; ensure all tests pass, ask the user if questions arise. (9.4, 9.5, 10.4)

- [x] 9. Remove backend download endpoints
  - [x] 9.1 Remove the download route handlers in `backend/app/routers/modules.py` (Modules_Router)
    - Delete `download_notebook` (the `GET /{slug}/notebook/{filename}/download` handler) so the path returns 404 for any slug/filename and no `.ipynb` body, and no other method returns content
    - Delete `download_module_package` (the `GET /{slug}/download-package` handler) so the path returns 404 for any method
    - Remove now-unused imports (`io`, `zipfile`, `Path`, `FileResponse`, `StreamingResponse`) if not used elsewhere; keep `view_notebook` unchanged so an unlocked notebook returns 200 + HTML
    - _Requirements: 8.2, 8.3, 8.4, 9.2, 9.3_

  - [x] 9.2 Write backend integration tests for route removal and retention
    - `GET /api/modules/{slug}/notebook/{filename}/download` → 404 with no `.ipynb` body for a couple of slug/filename values (8.2); non-GET methods on the download path → no `.ipynb` content (8.3); `GET /api/modules/{slug}/download-package` → 404 (9.2); non-GET on the package path → 404 (9.3); `GET .../view` for an unlocked notebook → 200 + HTML (8.4)
    - _Requirements: 8.2, 8.3, 8.4, 9.2, 9.3_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure the full frontend suite (Vitest) and backend suite (pytest) pass and that a failing test reports a non-zero exit status naming the failing test; ask the user if questions arise. (10.4, 11.6)

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific granular requirement clauses for traceability.
- Property 1 (banner-channel round-trip) is the single universal property in this feature; all other criteria are covered by example, edge-case, and integration tests.
- Checkpoints ensure incremental validation between the standalone modules, the wired-in app, and the backend changes.
- Implementation language is plain JSX/JavaScript (frontend) and Python/FastAPI (backend), per the design.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "9.1"] },
    { "id": 1, "tasks": ["2.1", "9.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "7.1"] },
    { "id": 5, "tasks": ["7.2"] },
    { "id": 6, "tasks": ["7.3"] },
    { "id": 7, "tasks": ["7.4"] }
  ]
}
```
