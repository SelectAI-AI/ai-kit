// Unit tests for the Security_Banner component (src/components/SecurityBanner.jsx).
// Framework: Vitest (globals) + @testing-library/react + jsdom, with fake timers.
// Covers Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.5.

import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import SecurityBanner from "./SecurityBanner.jsx";
import { SECURITY_BANNER_EVENT } from "../lib/securityBanner.js";

const DISMISS_MS = 2800;

// Dispatch a banner event on the global window target inside act() so the
// component's state update and any timer scheduling are flushed synchronously.
function dispatchBanner(message) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(SECURITY_BANNER_EVENT, { detail: { message } })
    );
  });
}

function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("SecurityBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("displaying a received message (Req 6.1, 6.4)", () => {
    it("displays the received message text and is visible while shown", () => {
      render(<SecurityBanner />);

      // Hidden before any event.
      expect(screen.queryByTestId("security-banner")).toBeNull();

      dispatchBanner("Copying is disabled");

      const banner = screen.getByTestId("security-banner");
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute("role", "alert");
      expect(banner).toHaveTextContent("Copying is disabled");
    });
  });

  describe("empty / missing messages ignored (Req 6.2, 7.5)", () => {
    it("ignores an empty-string message while nothing is shown", () => {
      render(<SecurityBanner />);

      dispatchBanner("");

      expect(screen.queryByTestId("security-banner")).toBeNull();
    });

    it("ignores a missing message (no detail.message) while nothing is shown", () => {
      render(<SecurityBanner />);

      act(() => {
        window.dispatchEvent(
          new CustomEvent(SECURITY_BANNER_EVENT, { detail: {} })
        );
      });

      expect(screen.queryByTestId("security-banner")).toBeNull();
    });

    it("retains the current message and does not restart the timer on an empty message", () => {
      render(<SecurityBanner />);

      dispatchBanner("First message");
      expect(screen.getByTestId("security-banner")).toHaveTextContent(
        "First message"
      );

      // Advance partway, then send an empty message: it must be ignored and the
      // original timer must NOT restart.
      advance(2000);
      dispatchBanner("");

      // Still showing the original message.
      expect(screen.getByTestId("security-banner")).toHaveTextContent(
        "First message"
      );

      // The original 2800 ms deadline still holds: 800 ms more dismisses it.
      advance(800);
      expect(screen.queryByTestId("security-banner")).toBeNull();
    });
  });

  describe("truncation to first 200 chars (Req 6.3)", () => {
    it("truncates a 250-character message to the first 200 characters", () => {
      render(<SecurityBanner />);

      const msg = "a".repeat(250);
      dispatchBanner(msg);

      const banner = screen.getByTestId("security-banner");
      expect(banner).toHaveTextContent("a".repeat(200));
      expect(banner.textContent).toHaveLength(200);
    });

    it("truncates a 10000-character message to the first 200 characters", () => {
      render(<SecurityBanner />);

      const msg = "b".repeat(10000);
      dispatchBanner(msg);

      const banner = screen.getByTestId("security-banner");
      expect(banner.textContent).toHaveLength(200);
      expect(banner.textContent).toBe("b".repeat(200));
    });

    it("truncates by UTF-16 code units at the 200-char boundary (unicode case)", () => {
      render(<SecurityBanner />);

      // 199 astral emoji (each 2 UTF-16 code units) = 398 code units, then a
      // marker char at index 398. slice(0, 200) cuts through the 101st emoji,
      // keeping 100 full emoji (200 code units) and dropping the marker.
      const emoji = "😀"; // U+1F600, length 2 in UTF-16
      const msg = emoji.repeat(199) + "X";
      dispatchBanner(msg);

      const banner = screen.getByTestId("security-banner");
      // Display is exactly the first 200 UTF-16 code units of the raw string.
      expect(banner.textContent).toBe(msg.slice(0, 200));
      expect(banner.textContent).toHaveLength(200);
      // The trailing marker must not appear.
      expect(banner.textContent).not.toContain("X");
    });
  });

  describe("auto-dismiss after 2800 ms (Req 6.5)", () => {
    it("hides the banner after 2800 ms with no newer message", () => {
      render(<SecurityBanner />);

      dispatchBanner("Blocked");
      expect(screen.getByTestId("security-banner")).toBeInTheDocument();

      // Just before the deadline it is still visible.
      advance(DISMISS_MS - 1);
      expect(screen.getByTestId("security-banner")).toBeInTheDocument();

      // At the deadline it hides.
      advance(1);
      expect(screen.queryByTestId("security-banner")).toBeNull();
    });
  });

  describe("newer message replaces text and restarts the timer (Req 6.6)", () => {
    it("replaces the text, drops the old message, and survives past the original deadline", () => {
      render(<SecurityBanner />);

      dispatchBanner("Old message");
      expect(screen.getByTestId("security-banner")).toHaveTextContent(
        "Old message"
      );

      // Advance partway (2000 ms), then send a newer message.
      advance(2000);
      dispatchBanner("New message");

      // Old text gone, new text shown.
      const banner = screen.getByTestId("security-banner");
      expect(banner).toHaveTextContent("New message");
      expect(banner).not.toHaveTextContent("Old message");

      // The original deadline would have been at 2800 ms (800 ms from now).
      // Because the timer restarted, the banner must survive past it.
      advance(800);
      expect(screen.getByTestId("security-banner")).toHaveTextContent(
        "New message"
      );

      // It dismisses 2800 ms after the newer message (2000 ms more from here,
      // total 2800 ms since "New message").
      advance(DISMISS_MS - 800 - 1);
      expect(screen.getByTestId("security-banner")).toBeInTheDocument();
      advance(1);
      expect(screen.queryByTestId("security-banner")).toBeNull();
    });
  });

  describe("unmount cleanup (Req 6.7)", () => {
    it("removes its listener and cancels the pending timer on unmount", () => {
      const { unmount } = render(<SecurityBanner />);

      dispatchBanner("Will unmount");
      expect(screen.getByTestId("security-banner")).toBeInTheDocument();

      unmount();

      // After unmount, dispatching an event and advancing timers must not throw
      // and must not produce any lingering render.
      expect(() => {
        act(() => {
          window.dispatchEvent(
            new CustomEvent(SECURITY_BANNER_EVENT, {
              detail: { message: "after unmount" },
            })
          );
          vi.advanceTimersByTime(DISMISS_MS * 2);
        });
      }).not.toThrow();

      expect(screen.queryByTestId("security-banner")).toBeNull();
    });
  });
});
