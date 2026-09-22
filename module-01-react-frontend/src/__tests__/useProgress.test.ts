// Feature: module-01-react-frontend, Property 14: progress state round-trips through localStorage
// Feature: module-01-react-frontend, Property 15: progress bar fill equals completed fraction
// Feature: module-01-react-frontend, Property 19: ConceptCheck completed state persists on revisit

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import fc from 'fast-check'
import { useProgress } from '../hooks/useProgress'

const STORAGE_KEY = 'module-01-progress'

function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

beforeEach(clearStorage)
afterEach(clearStorage)

// ── Property 14: progress state round-trips through localStorage ──────────────

describe('Property 14: progress state round-trips through localStorage', () => {
  it('markComplete writes correct boolean to localStorage and re-mount restores state', () => {
    fc.assert(
      fc.property(
        // min 1 so we always have at least one step to complete and write to storage
        fc.subarray([1, 2, 3, 4, 5, 6], { minLength: 1, maxLength: 6 }),
        (stepsToComplete) => {
          clearStorage()

          const { result, unmount } = renderHook(() => useProgress())

          // Mark each step complete
          for (const step of stepsToComplete) {
            act(() => result.current.markComplete(step))
          }

          // Verify localStorage was written
          const raw = localStorage.getItem(STORAGE_KEY)
          expect(raw).not.toBeNull()
          const stored = JSON.parse(raw!)
          for (const step of stepsToComplete) {
            expect(stored[String(step)]).toBe(true)
          }

          unmount()

          // Re-mount and verify state is restored
          const { result: result2, unmount: unmount2 } = renderHook(() => useProgress())
          for (const step of stepsToComplete) {
            expect(result2.current.completed[step]).toBe(true)
          }
          unmount2()
          clearStorage()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('empty stepsToComplete leaves localStorage null (nothing written)', () => {
    clearStorage()
    const { result, unmount } = renderHook(() => useProgress())
    // No markComplete calls
    expect(result.current.completedCount).toBe(0)
    unmount()
    // localStorage should still be null since nothing was written
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

// ── Property 15: progress bar fill equals completed fraction ──────────────────

describe('Property 15: progress bar fill equals completed fraction', () => {
  it('completedCount / 6 * 100 equals expected percentage within ±1%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        (n) => {
          clearStorage()

          // Pre-populate localStorage with n completed steps
          const state: Record<string, boolean> = {}
          for (let i = 1; i <= 6; i++) {
            state[String(i)] = i <= n
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

          const { result, unmount } = renderHook(() => useProgress())
          const expectedPct = (n / 6) * 100
          const actualPct = (result.current.completedCount / 6) * 100

          expect(Math.abs(actualPct - expectedPct)).toBeLessThanOrEqual(1)
          unmount()
          clearStorage()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('completedCount is 0 when no steps completed', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.completedCount).toBe(0)
  })

  it('completedCount is 6 when all steps completed', () => {
    const state: Record<string, boolean> = {}
    for (let i = 1; i <= 6; i++) state[String(i)] = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    const { result } = renderHook(() => useProgress())
    expect(result.current.completedCount).toBe(6)
  })
})

// ── Property 18: step nav locked beyond highest_completed + 1 ────────────────

describe('Property 18: step navigation locked beyond highest_completed + 1', () => {
  it('isLocked returns true for steps beyond highestCompleted + 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        (highestCompleted) => {
          clearStorage()

          const state: Record<string, boolean> = {}
          for (let i = 1; i <= 6; i++) {
            state[String(i)] = i <= highestCompleted
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

          const { result, unmount } = renderHook(() => useProgress())

          // Steps beyond highestCompleted + 1 should be locked
          for (let step = highestCompleted + 2; step <= 6; step++) {
            expect(result.current.isLocked(step)).toBe(true)
          }

          // Steps at or below highestCompleted + 1 should NOT be locked
          for (let step = 1; step <= Math.min(highestCompleted + 1, 6); step++) {
            expect(result.current.isLocked(step)).toBe(false)
          }

          unmount()
          clearStorage()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Property 19: ConceptCheck completed state persists on revisit ─────────────

describe('Property 19: ConceptCheck completed state persists on revisit', () => {
  it('step marked complete in progress state shows completed[step] === true on re-mount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        (stepIndex) => {
          clearStorage()

          const { result, unmount } = renderHook(() => useProgress())
          act(() => result.current.markComplete(stepIndex))
          expect(result.current.completed[stepIndex]).toBe(true)
          unmount()

          // Re-mount — completed state should be restored
          const { result: result2, unmount: unmount2 } = renderHook(() => useProgress())
          expect(result2.current.completed[stepIndex]).toBe(true)
          unmount2()
          clearStorage()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── localStorage degradation ──────────────────────────────────────────────────

describe('localStorage degradation', () => {
  it('does not throw when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage unavailable')
    })

    expect(() => {
      const { result, unmount } = renderHook(() => useProgress())
      act(() => result.current.markComplete(1))
      unmount()
    }).not.toThrow()

    vi.restoreAllMocks()
  })
})
