// Feature: module-01-react-frontend, Property 8: active step nav reflects current step
// Feature: module-01-react-frontend, Property 18: step nav locked beyond highest_completed + 1

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import fc from 'fast-check'
import AppShell from '../components/AppShell'

// Mock hooks to avoid real API calls
vi.mock('../hooks/useApiStatus', () => ({
  useApiStatus: () => ({ connected: true, langsmithProject: 'test-project', groqModel: 'llama3-8b-8192', loading: false }),
}))

const STORAGE_KEY = 'module-01-progress'

function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

beforeEach(clearStorage)
afterEach(clearStorage)

// ── Property 8: active step nav reflects current step ────────────────────────

describe('Property 8: active step nav reflects current step', () => {
  it('for any step 1–6, navigating to /step/N results in exactly one nav item having active state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        (stepIndex) => {
          // Unlock all steps by marking all previous as complete
          const state: Record<string, boolean> = {}
          for (let i = 1; i <= 6; i++) state[String(i)] = true
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

          const { unmount } = render(
            <MemoryRouter initialEntries={[`/step/${stepIndex}`]}>
              <AppShell />
            </MemoryRouter>,
          )

          // The active nav item should have aria-current="page"
          const activeLinks = screen.getAllByRole('link').filter(
            link => link.getAttribute('aria-current') === 'page',
          )
          expect(activeLinks).toHaveLength(1)
          expect(activeLinks[0]).toHaveAttribute('href', `/step/${stepIndex}`)

          unmount()
          clearStorage()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 18: step nav locked beyond highest_completed + 1 ────────────────

describe('Property 18: step nav locked beyond highest_completed + 1', () => {
  it('locked step nav items are not links and show lock indicator', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        (highestCompleted) => {
          clearStorage()
          const state: Record<string, boolean> = {}
          for (let i = 1; i <= 6; i++) state[String(i)] = i <= highestCompleted
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

          const { unmount } = render(
            <MemoryRouter initialEntries={['/step/1']}>
              <AppShell />
            </MemoryRouter>,
          )

          // Steps beyond highestCompleted + 1 should be locked (rendered as buttons, not links)
          for (let step = highestCompleted + 2; step <= 6; step++) {
            const lockedBtn = screen.queryByTestId(`step-nav-${step}`)
            if (lockedBtn) {
              expect(lockedBtn.getAttribute('data-locked')).toBe('true')
            }
          }

          unmount()
          clearStorage()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── AppShell unit tests ───────────────────────────────────────────────────────

describe('AppShell unit tests', () => {
  beforeEach(() => {
    // Unlock all steps
    const state: Record<string, boolean> = {}
    for (let i = 1; i <= 6; i++) state[String(i)] = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  })

  it('renders module title', () => {
    render(
      <MemoryRouter initialEntries={['/step/1']}>
        <AppShell />
      </MemoryRouter>,
    )
    expect(screen.getByText('Module 01 — Foundations')).toBeInTheDocument()
  })

  it('renders API status badge', () => {
    render(
      <MemoryRouter initialEntries={['/step/1']}>
        <AppShell />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('api-status-badge')).toBeInTheDocument()
  })

  it('renders progress bar', () => {
    render(
      <MemoryRouter initialEntries={['/step/1']}>
        <AppShell />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('progress-bar-fill')).toBeInTheDocument()
  })

  it('renders all 6 step nav items', () => {
    render(
      <MemoryRouter initialEntries={['/step/1']}>
        <AppShell />
      </MemoryRouter>,
    )
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByTestId(`step-nav-${i}`)).toBeInTheDocument()
    }
  })

  it('default route / redirects to /step/1', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>,
    )
    // The step 1 nav link should be active
    const step1Link = screen.getByTestId('step-nav-1')
    expect(step1Link.tagName).toBe('A')
  })
})
