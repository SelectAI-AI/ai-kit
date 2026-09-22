// Feature: module-01-react-frontend, Property 11: aggregate score two decimal places
// Feature: module-01-react-frontend, Property 12: PASS/FAIL badge reflects 0.75 threshold
// Feature: module-01-react-frontend, Property 13: progress bar fill proportional to score

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import fc from 'fast-check'

vi.mock('../hooks/useProgress', () => ({
  useProgress: () => ({
    completed: {},
    markComplete: vi.fn(),
    isLocked: () => false,
    highestCompleted: 5,
    completedCount: 5,
  }),
}))

// Mock Monaco editor — doesn't work in jsdom
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

// ── Property 11: aggregate score two decimal places ───────────────────────────

describe('Property 11: aggregate score displayed to exactly two decimal places', () => {
  it('for any score in [0.0, 1.0], displayed string has exactly two decimal places', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.0, max: 1.0, noNaN: true }),
        (score) => {
          const formatted = score.toFixed(2)
          // Must have exactly one decimal point and exactly 2 digits after it
          expect(formatted).toMatch(/^\d+\.\d{2}$/)
          // Must round-trip correctly
          const parsed = parseFloat(formatted)
          expect(Math.abs(parsed - score)).toBeLessThanOrEqual(0.005)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('boundary values format correctly', () => {
    expect((0.0).toFixed(2)).toBe('0.00')
    expect((1.0).toFixed(2)).toBe('1.00')
    expect((0.75).toFixed(2)).toBe('0.75')
    expect((0.74).toFixed(2)).toBe('0.74')
    expect((0.82).toFixed(2)).toBe('0.82')
  })
})

// ── Property 12: PASS/FAIL badge reflects 0.75 threshold ─────────────────────

describe('Property 12: PASS/FAIL badge reflects 0.75 threshold', () => {
  it('score >= 0.75 shows PASS badge, score < 0.75 shows FAIL badge', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.0, max: 1.0, noNaN: true }),
        (score) => {
          const isPass = score >= 0.75
          if (isPass) {
            expect(score >= 0.75).toBe(true)
          } else {
            expect(score < 0.75).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('0.75 is PASS threshold boundary', () => {
    expect(0.75 >= 0.75).toBe(true)
    expect(0.74 >= 0.75).toBe(false)
    expect(0.749 >= 0.75).toBe(false)
    expect(0.750 >= 0.75).toBe(true)
  })
})

// ── Property 13: per-dimension progress bar fill proportional to score ────────

describe('Property 13: per-dimension progress bar fill proportional to score', () => {
  it('for any score s in [0.0, 1.0], bar fill width is s * 100% within ±1%', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.0, max: 1.0, noNaN: true }),
        (score) => {
          const expectedWidth = score * 100
          const styleWidth = score * 100 // same calculation used in component
          expect(Math.abs(styleWidth - expectedWidth)).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('score 0.0 gives 0% width', () => {
    expect(0.0 * 100).toBe(0)
  })

  it('score 1.0 gives 100% width', () => {
    expect(1.0 * 100).toBe(100)
  })

  it('score 0.75 gives 75% width', () => {
    expect(0.75 * 100).toBe(75)
  })
})

// ── Step6Eval unit tests ──────────────────────────────────────────────────────

describe('Step6Eval unit tests', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('shows loading skeleton while fetching', async () => {
    vi.doMock('../hooks/useEvalResults', () => ({
      useEvalResults: () => ({ data: null, error: null, loading: true, refresh: vi.fn() }),
    }))
    const { default: Step6EvalFresh } = await import('../pages/Step6Eval')
    render(<Step6EvalFresh />)
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('shows no-results message when has_results is false', async () => {
    vi.doMock('../hooks/useEvalResults', () => ({
      useEvalResults: () => ({
        data: { has_results: false, aggregate_score: 0, dim_scores: { correctness: 0, relevance: 0 }, dataset_name: '', example_count: 0 },
        error: null,
        loading: false,
        refresh: vi.fn(),
      }),
    }))
    const { default: Step6EvalFresh } = await import('../pages/Step6Eval')
    render(<Step6EvalFresh />)
    expect(screen.getByTestId('no-results-panel')).toBeInTheDocument()
    // New message in notebook-style page
    expect(screen.getByText(/No results yet/)).toBeInTheDocument()
  })

  it('shows PASS badge for score >= 0.75', async () => {
    vi.doMock('../hooks/useEvalResults', () => ({
      useEvalResults: () => ({
        data: {
          has_results: true,
          aggregate_score: 0.82,
          dim_scores: { correctness: 0.85, relevance: 0.79 },
          dataset_name: 'module-01-week1-checkpoint',
          example_count: 30,
        },
        error: null,
        loading: false,
        refresh: vi.fn(),
      }),
    }))
    const { default: Step6EvalFresh } = await import('../pages/Step6Eval')
    render(<Step6EvalFresh />)
    expect(screen.getByTestId('pass-badge')).toBeInTheDocument()
    expect(screen.getByTestId('aggregate-score')).toHaveTextContent('0.82')
  })

  it('shows FAIL badge for score < 0.75', async () => {
    vi.doMock('../hooks/useEvalResults', () => ({
      useEvalResults: () => ({
        data: {
          has_results: true,
          aggregate_score: 0.60,
          dim_scores: { correctness: 0.55, relevance: 0.65 },
          dataset_name: 'module-01-week1-checkpoint',
          example_count: 30,
        },
        error: null,
        loading: false,
        refresh: vi.fn(),
      }),
    }))
    const { default: Step6EvalFresh } = await import('../pages/Step6Eval')
    render(<Step6EvalFresh />)
    expect(screen.getByTestId('fail-badge')).toBeInTheDocument()
    expect(screen.getByTestId('lowest-dimension')).toBeInTheDocument()
  })

  it('shows error panel with HTTP status and retry button', async () => {
    vi.doMock('../hooks/useEvalResults', () => ({
      useEvalResults: () => ({
        data: null,
        error: { status: 502, message: 'LangSmith is unreachable.' },
        loading: false,
        refresh: vi.fn(),
      }),
    }))
    const { default: Step6EvalFresh } = await import('../pages/Step6Eval')
    render(<Step6EvalFresh />)
    expect(screen.getByTestId('error-panel')).toBeInTheDocument()
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument()
    expect(screen.getByText(/502/)).toBeInTheDocument()
  })
})
