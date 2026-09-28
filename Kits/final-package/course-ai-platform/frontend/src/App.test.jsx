// Unit tests for App root integration (src/App.jsx).
// Framework: Vitest (globals) + @testing-library/react + jsdom.
// Covers Requirements 7.1, 7.2, 7.3 (single, persistent, responsive SecurityBanner)
// and 3.5, 3.7 (blur wrapper gains/removes the blur-xl class).
//
// App itself does NOT contain a Router — main.jsx wraps <App /> in a
// <BrowserRouter>. Tests therefore render <App /> inside a <MemoryRouter> and
// drive navigation via the router's initialEntries / a rerender.
//
// The auth/demo contexts and route pages are mocked so page content and API
// calls never interfere. Crucially, SecurityBanner and useScreenCaptureGuard
// are NOT mocked here — they are the subject of this integration test.

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';

// Mock heavy dependencies (contexts + pages) as pass-throughs / stubs so the
// test focuses on banner presence/persistence and the blur wrapper.
vi.mock('./context/DemoModeContext', () => ({
  DemoModeProvider: ({ children }) => <>{children}</>,
  useDemoMode: () => ({ demoMode: false }),
}));
vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock('./components/Navbar', () => ({ default: () => <div data-testid="navbar" /> }));
vi.mock('./components/DemoBanner', () => ({ default: () => <div data-testid="demobanner" /> }));
vi.mock('./components/PrivateRoute', () => ({ default: ({ children }) => <>{children}</> }));
vi.mock('./pages/Login', () => ({ default: () => <div>Login</div> }));
vi.mock('./pages/Register', () => ({ default: () => <div>Register</div> }));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('./pages/ModuleDetail', () => ({ default: () => <div>ModuleDetail</div> }));
vi.mock('./pages/Certificates', () => ({ default: () => <div>Certificates</div> }));
vi.mock('./pages/Verify', () => ({ default: () => <div>Verify</div> }));
vi.mock('./pages/Instructor', () => ({ default: () => <div>Instructor</div> }));

import App from './App';
import { SECURITY_BANNER_EVENT } from './lib/securityBanner';

// Dispatch a banner event on the global window target inside act() so the
// SecurityBanner state update flushes synchronously.
function dispatchBanner(message) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(SECURITY_BANNER_EVENT, { detail: { message } })
    );
  });
}

// Dispatch a bare window event (blur/focus) inside act() so the guard hook's
// state update flushes synchronously.
function dispatchWindowEvent(type) {
  act(() => {
    window.dispatchEvent(new Event(type));
  });
}

// The blur wrapper is the single root content div carrying the stable
// "min-h-screen" class.
function getBlurWrapper(container) {
  return container.querySelector('.min-h-screen');
}

// A tiny helper mounted alongside App inside the SAME MemoryRouter. It captures
// the router's navigate function so a test can drive a real route transition
// without remounting the router (which would remount App and its banner).
let navigateRef = null;
function NavProbe() {
  navigateRef = useNavigate();
  return null;
}

describe('App root integration', () => {
  describe('single SecurityBanner instance (Req 7.1)', () => {
    it('renders exactly one SecurityBanner after a banner event is dispatched', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      // Before any event the banner renders null, so there are zero instances.
      expect(container.querySelectorAll('[data-testid="security-banner"]')).toHaveLength(0);

      // After dispatching a message, exactly one banner is present.
      dispatchBanner('Copying is disabled');

      const banners = container.querySelectorAll('[data-testid="security-banner"]');
      expect(banners).toHaveLength(1);
      expect(banners[0]).toHaveTextContent('Copying is disabled');
    });
  });

  describe('banner persists across route transitions (Req 7.2)', () => {
    it('keeps a single working banner listener after navigating between routes', () => {
      // Render App and a navigation probe inside ONE MemoryRouter, then perform
      // a real in-router navigation from /login to /certificates. App (and thus
      // the single SecurityBanner mounted outside <Routes>) must NOT remount,
      // so the one listener still responds.
      navigateRef = null;
      const { container } = render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
          <NavProbe />
        </MemoryRouter>
      );

      expect(screen.getByText('Login')).toBeInTheDocument();

      // The banner wrapper node before navigation, to prove it is not remounted.
      const wrapperBefore = getBlurWrapper(container);

      // Navigate to a different route via the router (no remount of App/router).
      act(() => {
        navigateRef('/certificates');
      });
      expect(screen.getByText('Certificates')).toBeInTheDocument();

      // The root wrapper is the same DOM node — App did not remount.
      expect(getBlurWrapper(container)).toBe(wrapperBefore);

      // After navigation, dispatching an event still shows exactly one banner.
      dispatchBanner('Still listening after navigation');

      const banners = container.querySelectorAll('[data-testid="security-banner"]');
      expect(banners).toHaveLength(1);
      expect(banners[0]).toHaveTextContent('Still listening after navigation');
    });
  });

  describe('event from any component shows the banner (Req 7.3)', () => {
    it('displays the notice carried by a dispatched window CustomEvent', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('security-banner')).toBeNull();

      dispatchBanner('Right-click is disabled');

      const banner = screen.getByTestId('security-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent('Right-click is disabled');
    });
  });

  describe('blur wrapper toggles the blur-xl class (Req 3.5, 3.7)', () => {
    it('adds blur-xl when the window blurs and removes it when the window focuses', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      );

      const wrapper = getBlurWrapper(container);
      expect(wrapper).not.toBeNull();

      // Initially not blurred.
      expect(wrapper.classList.contains('blur-xl')).toBe(false);

      // Window blur -> wrapper gains blur-xl.
      dispatchWindowEvent('blur');
      expect(wrapper.classList.contains('blur-xl')).toBe(true);

      // Window focus -> wrapper loses blur-xl.
      dispatchWindowEvent('focus');
      expect(wrapper.classList.contains('blur-xl')).toBe(false);
    });
  });
});

describe('App layout', () => {
  it('renders DemoBanner above Navbar in the DOM', () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    const banner = container.querySelector('[data-testid="demobanner"]');
    const navbar = container.querySelector('[data-testid="navbar"]');
    expect(banner).not.toBeNull();
    expect(navbar).not.toBeNull();
    // banner should appear before navbar in the DOM
    const position = banner.compareDocumentPosition(navbar);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
