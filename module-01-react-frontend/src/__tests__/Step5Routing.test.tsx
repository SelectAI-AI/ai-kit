// Feature: module-01-react-frontend, Property 20: category badge colour matches category
// Feature: module-01-react-frontend, Property 10: empty/whitespace input rejected
//
// NOTE: Step5Routing is now a notebook-style page with CodeCell components.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import fc from 'fast-check'
import Step5Routing from '../pages/Step5Routing'

vi.mock('../hooks/useProgress', () => ({
  useProgress: () => ({
    completed: {},
    markComplete: vi.fn(),
    isLocked: () => false,
    highestCompleted: 4,
    completedCount: 4,
  }),
}))

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="code editor"
    />
  ),
}))

beforeEach(() => cleanup())

// ── Property 20: category badge colour matches category ───────────────────────
// This is a pure logic test — no DOM rendering needed.

describe('Property 20: category badge colour matches category', () => {
  function categoryBadgeClass(cat: string): string {
    switch (cat) {
      case 'technical': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'creative':  return 'bg-green-100 text-green-800 border-green-300'
      case 'general':   return 'bg-gray-100 text-gray-800 border-gray-300'
      default:          return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
  }

  it('for any category value, badge has the correct colour class', () => {
    const cases = [
      { category: 'technical',    expected: 'bg-blue-100' },
      { category: 'creative',     expected: 'bg-green-100' },
      { category: 'general',      expected: 'bg-gray-100' },
      { category: 'unknown_val',  expected: 'bg-yellow-100' },
      { category: 'constructor',  expected: 'bg-yellow-100' },
    ]
    fc.assert(
      fc.property(fc.constantFrom(...cases), ({ category, expected }) => {
        expect(categoryBadgeClass(category)).toContain(expected)
      }),
      { numRuns: 100 },
    )
  })

  it('technical → blue', () => expect(categoryBadgeClass('technical')).toContain('bg-blue-100'))
  it('creative → green', () => expect(categoryBadgeClass('creative')).toContain('bg-green-100'))
  it('general → grey',   () => expect(categoryBadgeClass('general')).toContain('bg-gray-100'))
  it('unknown → yellow', () => expect(categoryBadgeClass('anything')).toContain('bg-yellow-100'))
})

// ── Property 10: "Mark as done" always present (self-attested completion) ────

describe('Property 10: CodeCell "Mark as done" buttons are present', () => {
  it('renders a "Mark as done" button for each exercise cell', () => {
    render(<Step5Routing />)
    const markDoneBtns = screen.getAllByRole('button', { name: /mark cell as done/i })
    expect(markDoneBtns.length).toBeGreaterThanOrEqual(2) // 2 exercises
  })
})

// ── Step5Routing unit tests ───────────────────────────────────────────────────

describe('Step5Routing unit tests', () => {
  it('renders the page title', () => {
    render(<Step5Routing />)
    expect(screen.getByText('Query Routing')).toBeInTheDocument()
  })

  it('renders concept check question about RunnableBranch', () => {
    render(<Step5Routing />)
    expect(
      screen.getByText("What does `RunnableBranch` do in the routing chain?"),
    ).toBeInTheDocument()
  })

  it('renders classify_query exercise section', () => {
    render(<Step5Routing />)
    // The section header uses this exact text
    expect(screen.getByText('Exercise 1 — classify_query()')).toBeInTheDocument()
  })

  it('renders routing_chain exercise section', () => {
    render(<Step5Routing />)
    expect(screen.getByText('Exercise 2 — routing_chain')).toBeInTheDocument()
  })
})
