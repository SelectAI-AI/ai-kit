# Requirements Document

## Introduction

This feature ports the content-protection layer from the TypeScript `module-01-react-frontend` into the plain-JSX `course-ai-platform` frontend, so that rendered notebook content is viewable as HTML but resistant to casual copying, and so that content cannot leave the application through download paths.

The protection has four parts:

1. **Copy/paste blocking** on the rendered notebook HTML preview pane in `ModuleDetail.jsx`.
2. **Screenshot/recording deterrent** via a reusable `useScreenCaptureGuard` hook that blurs app content while the window is inactive and flags PrintScreen presses.
3. A **global "blocked" banner** (`SecurityBanner` + a `securityBanner` event channel) mounted once in `App.jsx`.
4. **Removal of content-exfiltration paths**: the "download .ipynb" and "download unlocked package" buttons in `ModuleDetail.jsx`, and their backend endpoints (`/notebook/{filename}/download`, `/download-package`) in `modules.py`. The HTML view endpoint is retained.

New tests (Vitest + `@testing-library/react` + jsdom, plus `fast-check` where useful) cover the guard hook and banner behavior.

This is display-only protection. There is no code sandbox or editor in the target platform; the Monaco-based `CodeCell.tsx` from the source module is used only as a reference for clipboard-interception intent, not ported as an editor.

### Known Limitation (recorded per user instruction)

Screenshot and screen-recording blocking is a **deterrent only**. A web application cannot prevent operating-system capture tools (for example Snipping Tool or Win+Shift+S), third-party screen recorders, or a phone camera pointed at the screen. Some OS capture tools do not reliably fire the browser `blur` or `visibilitychange` events, so blurring is best-effort. This limitation is intentional and accepted.

## Glossary

- **Notebook_Preview_Pane**: The DOM region in `ModuleDetail.jsx` that renders notebook HTML returned by the view endpoint via `dangerouslySetInnerHTML`.
- **Screen_Capture_Guard**: The `useScreenCaptureGuard` hook (`src/hooks/useScreenCaptureGuard.js`) that tracks window active/inactive state and PrintScreen presses.
- **Security_Banner**: The `SecurityBanner` component (`src/components/SecurityBanner.jsx`) that displays a transient top-of-screen message.
- **Banner_Channel**: The `securityBanner` module (`src/lib/securityBanner.js`) exposing `SECURITY_BANNER_EVENT` and `showSecurityBanner(message)`, which dispatches a browser `CustomEvent`.
- **View_Endpoint**: The retained backend endpoint `GET /api/modules/{slug}/notebook/{filename}/view` that returns notebook HTML.
- **Notebook_Download_Endpoint**: The backend endpoint `GET /api/modules/{slug}/notebook/{filename}/download` to be removed.
- **Package_Download_Endpoint**: The backend endpoint `GET /api/modules/{slug}/download-package` to be removed.
- **Modules_Router**: The FastAPI router in `backend/app/routers/modules.py`.
- **App_Root**: The root React component in `src/App.jsx`.
- **Blocked_Interaction**: A user action (copy, cut, paste, right-click context menu, text selection) that the system prevents within the Notebook_Preview_Pane.

## Requirements

### Requirement 1: Block copy, cut, and paste keyboard shortcuts in the notebook preview

**User Story:** As a course author, I want copy/cut/paste keyboard shortcuts disabled inside the notebook preview, so that learners cannot lift notebook content through the keyboard.

#### Acceptance Criteria

1. WHILE keyboard focus is within the Notebook_Preview_Pane, WHEN a keydown event with the Ctrl or Meta modifier plus the "c" key (case-insensitive) occurs, THE Notebook_Preview_Pane SHALL prevent the default copy behavior such that no content is written to the clipboard.
2. WHILE keyboard focus is within the Notebook_Preview_Pane, WHEN a keydown event with the Ctrl or Meta modifier plus the "x" key (case-insensitive) occurs, THE Notebook_Preview_Pane SHALL prevent the default cut behavior such that no content is written to the clipboard and no content is removed from the Notebook_Preview_Pane.
3. WHILE keyboard focus is within the Notebook_Preview_Pane, WHEN a keydown event with the Ctrl or Meta modifier plus the "v" key (case-insensitive) occurs, THE Notebook_Preview_Pane SHALL prevent the default paste behavior such that no content is written into the Notebook_Preview_Pane.
4. WHILE keyboard focus is within the Notebook_Preview_Pane, WHEN a keydown event with the Shift modifier plus the Insert key occurs, THE Notebook_Preview_Pane SHALL prevent the default paste behavior such that no content is written into the Notebook_Preview_Pane.
5. WHILE keyboard focus is within the Notebook_Preview_Pane, WHEN a native copy, cut, or paste DOM event fires, THE Notebook_Preview_Pane SHALL prevent the default behavior such that no content is written to the clipboard, no content is written into the Notebook_Preview_Pane, and no content is removed from the Notebook_Preview_Pane.
6. WHEN the default behavior of a copy, cut, or paste attempt is prevented within the Notebook_Preview_Pane, THE Notebook_Preview_Pane SHALL dispatch exactly one Security_Banner message within 500 milliseconds.
7. IF dispatching the Security_Banner message fails, THEN THE Notebook_Preview_Pane SHALL still prevent the default copy, cut, or paste behavior such that no content is written to the clipboard, no content is written into the Notebook_Preview_Pane, and no content is removed from the Notebook_Preview_Pane.

### Requirement 2: Block text selection and the context menu in the notebook preview

**User Story:** As a course author, I want text selection and right-click disabled in the notebook preview, so that learners cannot select-and-copy or use the context menu to extract content.

#### Acceptance Criteria

1. THE Notebook_Preview_Pane SHALL apply a non-selectable text style (`user-select: none`, including the vendor-prefixed equivalents `-webkit-user-select: none`, `-moz-user-select: none`, and `-ms-user-select: none`) to 100% of its rendered content, including dynamically inserted content.
2. WHEN a user attempts a text-selection gesture (pointer drag, double-click, triple-click, or Select-All keyboard shortcut) within the Notebook_Preview_Pane, THE Notebook_Preview_Pane SHALL result in zero characters of its rendered content being selected.
3. WHEN a contextmenu event occurs within the Notebook_Preview_Pane, THE Notebook_Preview_Pane SHALL prevent the default context menu from appearing.
4. WHEN a contextmenu event occurs within the Notebook_Preview_Pane, THE Notebook_Preview_Pane SHALL dispatch exactly one Security_Banner message per contextmenu event within 200 milliseconds of the event.

### Requirement 3: Deter screenshots and screen recording by blurring inactive content

**User Story:** As a course author, I want app content blurred when the window loses focus or the tab is hidden, so that casual screenshots and screen recordings capture obscured content.

#### Acceptance Criteria

1. WHEN the window emits a `blur` event, THE Screen_Capture_Guard SHALL set the blurred state to true within 100 milliseconds of the event being received.
2. WHEN the document emits a `visibilitychange` event AND the document visibility state is hidden, THE Screen_Capture_Guard SHALL set the blurred state to true within 100 milliseconds of the event being received.
3. WHEN the window emits a `focus` event, THE Screen_Capture_Guard SHALL set the blurred state to false within 100 milliseconds of the event being received.
4. WHEN the document emits a `visibilitychange` event AND the document visibility state is not hidden, THE Screen_Capture_Guard SHALL set the blurred state to false within 100 milliseconds of the event being received.
5. WHILE the Screen_Capture_Guard reports a blurred state of true, THE App_Root SHALL apply a visual blur of at least 8 pixels to the entire protected content region such that no text glyph in the region is legible.
6. WHEN the Screen_Capture_Guard transitions from a blurred state of false to a blurred state of true, THE Screen_Capture_Guard SHALL dispatch exactly one Security_Banner message stating that content is hidden while the window is inactive.
7. WHEN the Screen_Capture_Guard transitions from a blurred state of true to a blurred state of false, THE App_Root SHALL remove the visual blur from the protected content region within 100 milliseconds of the transition.
8. IF the blurred state is already true AND a subsequent event that would set the blurred state to true is received, THEN THE Screen_Capture_Guard SHALL retain the blurred state as true and SHALL NOT dispatch an additional Security_Banner message.

### Requirement 4: Flag PrintScreen key presses

**User Story:** As a course author, I want a notice shown when the PrintScreen key is pressed, so that learners are reminded that screenshots are not supported.

#### Acceptance Criteria

1. WHEN a keyup event with the PrintScreen key occurs, THE Screen_Capture_Guard SHALL dispatch a Security_Banner message stating that screenshots are not supported.
2. WHEN a keyup event with a key other than PrintScreen occurs, THE Screen_Capture_Guard SHALL NOT dispatch a Security_Banner message.
3. WHILE a Security_Banner message stating that screenshots are not supported is already displayed, WHEN a subsequent keyup event with the PrintScreen key occurs, THE Screen_Capture_Guard SHALL NOT dispatch an additional Security_Banner message.
4. WHEN a keyup event with the PrintScreen key occurs, THE Screen_Capture_Guard SHALL cause the dispatched Security_Banner message to remain visible for the standard dismiss interval before it is dismissed.
5. IF a keyup event cannot be evaluated for the PrintScreen key because key identification data is absent, THEN THE Screen_Capture_Guard SHALL NOT dispatch a Security_Banner message.

### Requirement 5: Provide a global banner event channel

**User Story:** As a developer, I want a shared banner channel that any component can call without a React context, so that protection code across the app can surface consistent notices.

#### Acceptance Criteria

1. THE Banner_Channel SHALL export a constant `SECURITY_BANNER_EVENT` whose value is a non-empty string naming the custom event, and this value SHALL remain identical across all imports within a single application session.
2. WHEN `showSecurityBanner(message)` is called with a string message of length 1 to 5000 characters, THE Banner_Channel SHALL dispatch exactly one browser CustomEvent named by the value of `SECURITY_BANNER_EVENT` on the global event target within 100 milliseconds of the call.
3. WHEN `showSecurityBanner(message)` dispatches the CustomEvent, THE Banner_Channel SHALL place the supplied message in the event's detail payload such that a listener reading the detail receives a value strictly equal to the message passed to `showSecurityBanner`, with no truncation, trimming, encoding, or other modification.
4. IF `showSecurityBanner` is called with a message that is null, undefined, or not of string type, THEN THE Banner_Channel SHALL NOT dispatch the CustomEvent and SHALL surface an indication to the caller that the input was rejected while leaving any existing listeners unaffected.
5. IF `showSecurityBanner` is called while no global event target is available, THEN THE Banner_Channel SHALL NOT throw an unhandled error to the caller and SHALL return control to the caller without dispatching the event.

### Requirement 6: Display and auto-dismiss the security banner

**User Story:** As a learner, I want a brief on-screen notice when an action is blocked, so that I understand why the interaction did not work.

#### Acceptance Criteria

1. WHEN a `SECURITY_BANNER_EVENT` is received AND the event detail contains a non-empty message of 1 to 200 characters, THE Security_Banner SHALL display the message text carried in the event detail.
2. IF a `SECURITY_BANNER_EVENT` is received AND the event detail contains no message or an empty message, THEN THE Security_Banner SHALL ignore the event, retain any currently displayed message, and not restart the dismiss timer.
3. IF a `SECURITY_BANNER_EVENT` is received AND the event detail message exceeds 200 characters, THEN THE Security_Banner SHALL display only the first 200 characters of the message text.
4. WHILE a message is displayed, THE Security_Banner SHALL render the banner in a visible state.
5. WHEN 2800 milliseconds elapse after a message is displayed AND no newer `SECURITY_BANNER_EVENT` with a non-empty message has been received in that interval, THE Security_Banner SHALL hide the banner such that it is no longer visible.
6. WHEN a `SECURITY_BANNER_EVENT` with a non-empty message is received before a previously scheduled hide occurs, THE Security_Banner SHALL replace the displayed message text with the new message and restart the 2800 millisecond dismiss timer from zero.
7. WHEN the Security_Banner component unmounts, THE Security_Banner SHALL remove its `SECURITY_BANNER_EVENT` listener and cancel any pending dismiss timer.

### Requirement 7: Mount the security banner once at the application root

**User Story:** As a developer, I want the banner mounted once at the app root, so that notices appear consistently regardless of the active route.

#### Acceptance Criteria

1. WHEN the App_Root renders, THE App_Root SHALL render exactly one Security_Banner instance, and no more than one Security_Banner instance SHALL exist in the rendered component tree at any time.
2. WHILE any route is active, THE App_Root SHALL keep the single Security_Banner instance mounted without re-mounting or duplicating it across route transitions.
3. WHEN a `SECURITY_BANNER_EVENT` event is dispatched from any component in the application, THE Security_Banner SHALL display the notice carried by that event within 500 milliseconds of dispatch.
4. WHEN the Security_Banner is unmounted, THE Security_Banner SHALL remove its `SECURITY_BANNER_EVENT` listener so that no more than one listener responds to each dispatched event.
5. IF a `SECURITY_BANNER_EVENT` event is dispatched with a missing or empty notice payload, THEN THE Security_Banner SHALL ignore the event, retain its current displayed state unchanged, and register no new notice.

### Requirement 8: Remove the notebook download control and endpoint

**User Story:** As a course author, I want the per-notebook download removed, so that learners cannot export the raw `.ipynb` file.

#### Acceptance Criteria

1. THE Notebook_Preview_Pane container in `ModuleDetail.jsx` SHALL render no control (button, link, or other clickable element) that invokes a per-notebook `.ipynb` download request.
2. WHEN a client sends a GET request to `/api/modules/{slug}/notebook/{filename}/download` for any `slug` and any `filename` value, THE Modules_Router SHALL respond with an HTTP 404 status and SHALL return no `.ipynb` file content in the response body.
3. IF a client sends a request using any HTTP method other than GET to `/api/modules/{slug}/notebook/{filename}/download`, THEN THE Modules_Router SHALL NOT return `.ipynb` file content.
4. WHEN a client sends a valid request to the View_Endpoint for an unlocked notebook, THE Modules_Router SHALL respond with an HTTP 200 status and the rendered notebook HTML.

### Requirement 9: Remove the package download control and endpoint

**User Story:** As a course author, I want the "download unlocked package" removed, so that learners cannot export a zip of module content.

#### Acceptance Criteria

1. THE `ModuleDetail.jsx` page SHALL NOT render any interactive control (button, link, or menu item) whose activation initiates a module package download.
2. WHEN a client sends a GET request to `/api/modules/{slug}/download-package` for any `slug` value, THE Modules_Router SHALL respond with an HTTP 404 status and SHALL NOT return module package content in the response body.
3. WHEN a client sends a request using any HTTP method other than GET to `/api/modules/{slug}/download-package`, THE Modules_Router SHALL respond with an HTTP 404 status.
4. THE `ModuleDetail.jsx` page SHALL NOT import the download helper module or reference any of its exported symbols.
5. IF the `ModuleDetail.jsx` source retains an unused import of the download helper after control removal, THEN THE build SHALL fail during compilation.

### Requirement 10: Preserve existing notebook viewing and completion behavior

**User Story:** As a learner, I want to keep viewing notebooks and submitting completions, so that content protection does not break the core learning flow.

#### Acceptance Criteria

1. WHEN a learner opens a notebook preview for an unlocked notebook, THE View_Endpoint SHALL return the notebook HTML content with a success indication within 3 seconds, and THE Notebook_Preview_Pane SHALL render the returned HTML.
2. IF the View_Endpoint returns an error or does not respond within 3 seconds when opening an unlocked notebook preview, THEN THE Notebook_Preview_Pane SHALL display an error indication that content could not be loaded and SHALL preserve the previously displayed state without partial rendering.
3. WHEN a learner submits a notebook completion from the `ModuleDetail.jsx` page, THE `ModuleDetail.jsx` page SHALL record the completion using the same self-attestation flow and produce the same observable result (completion marked and progress updated) as before content protection was introduced.
4. WHERE the existing frontend test suite runs, THE frontend test suite SHALL complete with zero failing tests.

### Requirement 11: Provide automated tests for the guard hook and banner

**User Story:** As a developer, I want tests for the new protection behavior, so that regressions are caught automatically.

#### Acceptance Criteria

1. THE frontend test suite SHALL include a test verifying that WHEN a window `blur` event is dispatched, the Screen_Capture_Guard reports blurred as boolean true, and WHEN a window `focus` event is dispatched, the Screen_Capture_Guard reports blurred as boolean false.
2. THE frontend test suite SHALL include a test verifying that WHEN the document visibility state becomes hidden, the Screen_Capture_Guard reports blurred as boolean true, and WHEN the document visibility state becomes visible, the Screen_Capture_Guard reports blurred as boolean false.
3. THE frontend test suite SHALL include a test verifying that WHEN a keyup event with key value equal to "PrintScreen" is dispatched, exactly one Security_Banner message is dispatched, and WHEN a keyup event with any key value other than "PrintScreen" is dispatched, zero Security_Banner messages are dispatched.
4. THE frontend test suite SHALL include a test verifying that WHEN a `SECURITY_BANNER_EVENT` is received, the Security_Banner displays the associated message, and after the dismiss interval of 2800 milliseconds elapses, the Security_Banner is hidden and displays no message.
5. THE frontend test suite SHALL include a property-based test using a minimum of 100 generated cases that, for arbitrary strings of length 0 to 10000 characters passed to `showSecurityBanner`, verifies the message received by a registered listener is byte-for-byte identical to the message dispatched (round-trip equality).
6. IF a test in the frontend test suite fails, THEN THE frontend test suite SHALL report a non-zero exit status and indicate the name of the failing test.
