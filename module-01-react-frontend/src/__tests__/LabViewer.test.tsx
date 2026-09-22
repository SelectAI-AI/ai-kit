// Feature: module-01-react-frontend, Property 14: Checklist state round-trips through localStorage
// Feature: module-01-react-frontend, Property 15: Progress summary count matches checked items

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as fc from 'fast-check'
import LabViewer from '../pages/LabViewer'

const STORAGE_KEY = 'module-01-checklist'

function renderLabViewer() {
  return render(
    <MemoryRouter>
      <LabViewer />
    </MemoryRouter>,
  )
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

// ---------------------------------------------------------------------------
// Property 14: Checklist state round-trips through localStorage
// Validates: Requirements 8.7
// ---------------------------------------------------------------------------
describe('Property 14: Checklist state round-trips through localStorage', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('toggling any item persists correct boolean to localStorage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (index) => {
          clearStorage()
          const { unmount } = renderLabViewer()

          const checkbox = screen.getByTestId(`checklist-item-${index}`)
            .querySelector('input[type="checkbox"]') as HTMLInputElement

          // Initially unchecked
          expect(checkbox.checked).toBe(false)

          // Check it
          fireEvent.click(checkbox)
          expect(checkbox.checked).toBe(true)

          // Verify localStorage
          const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
          expect(stored[String(index)]).toBe(true)

          // Uncheck it
          fireEvent.click(checkbox)
          expect(checkbox.checked).toBe(false)
          const stored2 = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
          expect(stored2[String(index)]).toBe(false)

          unmount()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('re-mounting restores checked state from localStorage', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        (booleans) => {
          clearStorage()

          // Pre-populate localStorage
          const stored: Record<string, boolean> = {}
          booleans.forEach((val, i) => { stored[String(i)] = val })
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

          const { unmount } = renderLabViewer()

          booleans.forEach((val, i) => {
            const checkbox = screen.getByTestId(`checklist-item-${i}`)
              .querySelector('input[type="checkbox"]') as HTMLInputElement
            expect(checkbox.checked).toBe(val)
          })

          unmount()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 15: Progress summary count matches checked items
// Validates: Requirements 8.8
// ---------------------------------------------------------------------------
describe('Property 15: Progress summary count matches checked items', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('progress summary shows correct X / 4 complete for any combination', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        (booleans) => {
          clearStorage()
          const stored: Record<string, boolean> = {}
          booleans.forEach((val, i) => { stored[String(i)] = val })
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

          const { unmount } = renderLabViewer()

          const expectedCount = booleans.filter(Boolean).length
          const summary = screen.getByTestId('progress-summary')
          expect(summary.textContent).toBe(`${expectedCount} / 4 complete`)

          unmount()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('progress summary updates immediately when item is toggled', () => {
    clearStorage()
    renderLabViewer()

    expect(screen.getByTestId('progress-summary').textContent).toBe('0 / 4 complete')

    fireEvent.click(
      screen.getByTestId('checklist-item-0').querySelector('input[type="checkbox"]')!,
    )
    expect(screen.getByTestId('progress-summary').textContent).toBe('1 / 4 complete')

    fireEvent.click(
      screen.getByTestId('checklist-item-2').querySelector('input[type="checkbox"]')!,
    )
    expect(screen.getByTestId('progress-summary').textContent).toBe('2 / 4 complete')
  })
})

// ---------------------------------------------------------------------------
// Unit tests: all 16 checkbox combinations, localStorage key format
// ---------------------------------------------------------------------------
describe('LabViewer unit tests', () => {
  beforeEach(clearStorage)
  afterEach(clearStorage)

  it('renders all 4 checklist items', () => {
    renderLabViewer()
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`checklist-item-${i}`)).toBeInTheDocument()
    }
  })

  it('localStorage key is exactly "module-01-checklist"', () => {
    renderLabViewer()
    fireEvent.click(
      screen.getByTestId('checklist-item-0').querySelector('input[type="checkbox"]')!,
    )
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    // No other checklist key should exist
    const keys = Object.keys(localStorage)
    const checklistKeys = keys.filter(k => k.includes('checklist'))
    expect(checklistKeys).toEqual([STORAGE_KEY])
  })

  it('localStorage value has keys "0" through "3" mapping to booleans', () => {
    renderLabViewer()
    fireEvent.click(
      screen.getByTestId('checklist-item-1').querySelector('input[type="checkbox"]')!,
    )
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(Object.keys(stored).sort()).toEqual(['0', '1', '2', '3'])
    expect(typeof stored['0']).toBe('boolean')
    expect(typeof stored['1']).toBe('boolean')
    expect(stored['1']).toBe(true)
  })

  // All 16 combinations of 4 booleans
  const allCombinations = Array.from({ length: 16 }, (_, n) =>
    [0, 1, 2, 3].map(i => Boolean((n >> i) & 1)),
  )

  allCombinations.forEach((combo, n) => {
    it(`combination ${n}: [${combo.join(', ')}] shows correct count`, () => {
      clearStorage()
      const stored: Record<string, boolean> = {}
      combo.forEach((val, i) => { stored[String(i)] = val })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

      const { unmount } = renderLabViewer()
      const expectedCount = combo.filter(Boolean).length
      expect(screen.getByTestId('progress-summary').textContent).toBe(
        `${expectedCount} / 4 complete`,
      )
      unmount()
    })
  })
})
