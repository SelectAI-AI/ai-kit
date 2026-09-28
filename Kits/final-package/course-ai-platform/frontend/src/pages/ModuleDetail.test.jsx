// Unit tests for ModuleDetail preview protection and control removal.
// Framework: Vitest (globals) + @testing-library/react + jsdom.
// Covers Requirements 1.1-1.7, 2.1-2.4, 8.1, 9.1, 10.1, 10.2, 10.3.
//
// The `../api` module and `../lib/securityBanner` module are mocked so we can
// drive the module manifest / view HTML / completion responses and count banner
// dispatches deterministically. ModuleDetail is rendered inside a MemoryRouter
// with a :slug route so useParams() resolves.

import React from "react"; // eslint-disable-line no-unused-vars
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ---- Mock the API client -------------------------------------------------
// api.get is routed by URL: the module manifest for the module URL, the HTML
// string for the view URL. api.post resolves for the completion endpoint.
const MODULE_HTML = "<h1>Notebook Content</h1><p>secret protected text</p>";

const { mockApi, showSecurityBanner } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn() },
  showSecurityBanner: vi.fn(),
}));
vi.mock("../api", () => ({ default: mockApi }));

// ---- Mock the banner channel so we can count/inspect dispatches ----------
vi.mock("../lib/securityBanner", () => ({
  showSecurityBanner: (...args) => showSecurityBanner(...args),
  SECURITY_BANNER_EVENT: "app:security-banner",
}));

// Child rendering dependencies of ModuleDetail are stubbed so the test focuses
// on the preview-protection / control-removal behavior of ModuleDetail itself.
vi.mock("../components/ProgressBar", () => ({
  default: ({ percent }) => <div data-testid="progress" data-percent={percent} />,
}));
vi.mock("react-markdown", () => ({
  default: ({ children }) => <div data-testid="markdown">{children}</div>,
}));

import ModuleDetail from "./ModuleDetail.jsx";

const SLUG = "guardrails";

function makeModule(overrides = {}) {
  return {
    title: "AI Guardrails",
    percent_complete: 0,
    intro_markdown: "# Intro\nWelcome.",
    notebooks: [
      {
        filename: "01_intro.ipynb",
        title: "Intro Notebook",
        completed: false,
        unlocked: true,
        status: "not_started",
        prompt: "Complete the notebook.",
        question_type: "self_attest",
        review_note: null,
      },
    ],
    ...overrides,
  };
}

// Default api.get router: manifest for module URL, HTML for view URL.
function wireApi(module = makeModule(), { viewRejects = false } = {}) {
  mockApi.get.mockImplementation((url) => {
    if (url === `/api/modules/${SLUG}`) {
      return Promise.resolve({ data: module });
    }
    if (url.endsWith("/view")) {
      if (viewRejects) return Promise.reject(new Error("boom"));
      return Promise.resolve({ data: MODULE_HTML });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  mockApi.post.mockResolvedValue({ data: { success: true, message: "Recorded." } });
}

function renderModule() {
  return render(
    <MemoryRouter initialEntries={[`/module/${SLUG}`]}>
      <Routes>
        <Route path="/module/:slug" element={<ModuleDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

// Expand the first notebook row (toggle open) then open its preview.
async function openPreview() {
  // The module title confirms the manifest loaded.
  await screen.findByText("AI Guardrails");
  // Toggle the row open (the row button carries the notebook title).
  fireEvent.click(screen.getByText("Intro Notebook"));
  // Click the preview button and wait for the async view load to settle so any
  // resulting state update is flushed (avoids act() warnings).
  fireEvent.click(await screen.findByText(/preview/i));
  await waitFor(() => {
    expect(document.querySelector(".select-none")).not.toBeNull();
  });
}

// Locate the dangerouslySetInnerHTML preview container (the element carrying
// the select-none class and the user-select style).
function getPreviewContainer(container) {
  return container.querySelector(".select-none");
}

describe("ModuleDetail preview protection", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    showSecurityBanner.mockReset();
    showSecurityBanner.mockImplementation(() => true);
  });

  // ---- Req 10.1: preview renders returned HTML --------------------------
  it("renders the returned notebook HTML in the preview container (10.1)", async () => {
    wireApi();
    const { container } = renderModule();
    await openPreview();

    await waitFor(() => {
      expect(getPreviewContainer(container)).not.toBeNull();
    });
    const pane = getPreviewContainer(container);
    expect(pane.innerHTML).toContain("Notebook Content");
    expect(pane.textContent).toContain("secret protected text");
  });

  // ---- Req 2.1: user-select none + vendor prefixes ----------------------
  it("applies user-select: none plus vendor prefixes to the preview container (2.1)", async () => {
    wireApi();
    const { container } = renderModule();
    await openPreview();
    await waitFor(() => expect(getPreviewContainer(container)).not.toBeNull());

    const pane = getPreviewContainer(container);
    // Standard property is applied (jsdom serializes this one).
    expect(pane.style.userSelect).toBe("none");
    // The non-selectable class is present as the cascading fallback.
    expect(pane.classList.contains("select-none")).toBe(true);
    // Vendor-prefixed equivalents are applied to the element's inline style by
    // the component (React sets the camelCase keys) so -webkit-/-moz-/-ms-
    // engines are covered (Requirement 2.1). jsdom retains these camelCase
    // properties on the CSSStyleDeclaration even though it omits them from the
    // serialized style attribute string.
    expect(pane.style.WebkitUserSelect).toBe("none");
    expect(pane.style.MozUserSelect).toBe("none");
    expect(pane.style.msUserSelect).toBe("none");
  });

  // ---- Req 1.1-1.4, 1.6: keyboard shortcuts blocked + one banner ---------
  describe("keyboard shortcuts blocked with exactly one banner (1.1-1.4, 1.6)", () => {
    const cases = [
      { name: "Ctrl+C (lower)", init: { key: "c", ctrlKey: true } },
      { name: "Ctrl+C (upper)", init: { key: "C", ctrlKey: true } },
      { name: "Meta+C", init: { key: "c", metaKey: true } },
      { name: "Ctrl+X (lower)", init: { key: "x", ctrlKey: true } },
      { name: "Meta+X (upper)", init: { key: "X", metaKey: true } },
      { name: "Ctrl+V (lower)", init: { key: "v", ctrlKey: true } },
      { name: "Meta+V (upper)", init: { key: "V", metaKey: true } },
      { name: "Shift+Insert", init: { key: "Insert", shiftKey: true } },
    ];

    cases.forEach(({ name, init }) => {
      it(`prevents default and dispatches exactly one banner for ${name}`, async () => {
        wireApi();
        const { container } = renderModule();
        await openPreview();
        await waitFor(() => expect(getPreviewContainer(container)).not.toBeNull());
        const pane = getPreviewContainer(container);

        showSecurityBanner.mockClear();
        const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
        const prevented = !pane.dispatchEvent(event);

        expect(prevented).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(showSecurityBanner).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ---- Req 1.5: native copy/cut/paste events prevented -------------------
  describe("native clipboard DOM events prevented (1.5)", () => {
    ["copy", "cut", "paste"].forEach((type) => {
      it(`prevents default on a native ${type} event`, async () => {
        wireApi();
        const { container } = renderModule();
        await openPreview();
        await waitFor(() => expect(getPreviewContainer(container)).not.toBeNull());
        const pane = getPreviewContainer(container);

        showSecurityBanner.mockClear();
        const event = new Event(type, { bubbles: true, cancelable: true });
        pane.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(showSecurityBanner).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ---- Req 1.7: banner dispatch throwing still prevents default ----------
  it("still prevents default when the banner dispatch throws (1.7)", async () => {
    wireApi();
    const { container } = renderModule();
    await openPreview();
    await waitFor(() => expect(getPreviewContainer(container)).not.toBeNull());
    const pane = getPreviewContainer(container);

    // Make the banner throw for this interaction.
    showSecurityBanner.mockImplementation(() => {
      throw new Error("banner failed");
    });

    // Native copy event.
    const copyEvent = new Event("copy", { bubbles: true, cancelable: true });
    expect(() => pane.dispatchEvent(copyEvent)).not.toThrow();
    expect(copyEvent.defaultPrevented).toBe(true);

    // Keydown Ctrl+C.
    const keyEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "c",
      ctrlKey: true,
    });
    expect(() => pane.dispatchEvent(keyEvent)).not.toThrow();
    expect(keyEvent.defaultPrevented).toBe(true);
  });

  // ---- Req 2.2: Select-All prevented, no banner (no clipboard intent) ----
  it("prevents Select-All (Ctrl/Meta+A) with zero banner dispatches (2.2)", async () => {
    wireApi();
    const { container } = renderModule();
    await openPreview();
    await waitFor(() => expect(getPreviewContainer(container)).not.toBeNull());
    const pane = getPreviewContainer(container);

    showSecurityBanner.mockClear();
    const ctrlA = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "a",
      ctrlKey: true,
    });
    pane.dispatchEvent(ctrlA);
    expect(ctrlA.defaultPrevented).toBe(true);

    const metaA = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "A",
      metaKey: true,
    });
    pane.dispatchEvent(metaA);
    expect(metaA.defaultPrevented).toBe(true);

    // Select-All is not a clipboard action: no banner should fire.
    expect(showSecurityBanner).not.toHaveBeenCalled();
  });

  // ---- Req 2.3, 2.4: contextmenu prevented + one banner per event --------
  it("prevents the context menu and dispatches exactly one banner per event (2.3, 2.4)", async () => {
    wireApi();
    const { container } = renderModule();
    await openPreview();
    await waitFor(() => expect(getPreviewContainer(container)).not.toBeNull());
    const pane = getPreviewContainer(container);

    showSecurityBanner.mockClear();
    const first = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    pane.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    expect(showSecurityBanner).toHaveBeenCalledTimes(1);

    const second = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    pane.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(true);
    // Exactly one banner PER event -> two total.
    expect(showSecurityBanner).toHaveBeenCalledTimes(2);
  });
});

describe("ModuleDetail control removal (8.1, 9.1)", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    showSecurityBanner.mockReset();
    showSecurityBanner.mockImplementation(() => true);
  });

  it("renders no .ipynb download control and no package-download control", async () => {
    wireApi();
    renderModule();
    await openPreview();

    // No element whose text mentions "download" (ipynb or package).
    expect(screen.queryByText(/download/i)).toBeNull();
    // And no button/link matching download by accessible name.
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /download/i })).toBeNull();
  });
});

describe("ModuleDetail view error handling (10.2)", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    showSecurityBanner.mockReset();
    showSecurityBanner.mockImplementation(() => true);
  });

  it("shows an error indication and renders no partial notebook HTML when the view endpoint rejects", async () => {
    wireApi(makeModule(), { viewRejects: true });
    const { container } = renderModule();

    await screen.findByText("AI Guardrails");
    fireEvent.click(screen.getByText("Intro Notebook"));
    fireEvent.click(await screen.findByText(/preview/i));

    // An error indication appears.
    await screen.findByText(/could not load this notebook preview/i);

    // No preview container / no notebook HTML rendered.
    expect(getPreviewContainer(container)).toBeNull();
    expect(container.innerHTML).not.toContain("Notebook Content");
    expect(container.innerHTML).not.toContain("secret protected text");
  });
});

describe("ModuleDetail self-attestation completion (10.3)", () => {
  beforeEach(() => {
    mockApi.get.mockReset();
    mockApi.post.mockReset();
    showSecurityBanner.mockReset();
    showSecurityBanner.mockImplementation(() => true);
  });

  it("records completion via the self-attest flow and reloads the module", async () => {
    wireApi();
    renderModule();

    await screen.findByText("AI Guardrails");
    fireEvent.click(screen.getByText("Intro Notebook"));

    // The self_attest checkbox is rendered.
    const checkbox = await screen.findByRole("checkbox");
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const getCallsBefore = mockApi.get.mock.calls.length;

    // Submit for review.
    fireEvent.click(screen.getByText(/submit for review/i));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledTimes(1);
    });

    // api.post called with the completion URL and self_attest true.
    const [postUrl, postBody] = mockApi.post.mock.calls[0];
    expect(postUrl).toBe(`/api/modules/${SLUG}/notebook/01_intro.ipynb/complete`);
    expect(postBody).toEqual({ response: "", self_attest: true });

    // On success the module reloads (api.get called again for the manifest).
    await waitFor(() => {
      expect(mockApi.get.mock.calls.length).toBeGreaterThan(getCallsBefore);
    });
    expect(
      mockApi.get.mock.calls.some((c) => c[0] === `/api/modules/${SLUG}`)
    ).toBe(true);
  });
});
