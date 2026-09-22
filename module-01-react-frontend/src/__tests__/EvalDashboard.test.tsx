// Feature: module-01-react-frontend, Property 11: Aggregate score is displayed to exactly two decimal places
// Feature: module-01-react-frontend, Property 12: PASS/FAIL badge reflects the 0.75 threshold
// Feature: module-01-react-frontend, Property 13: Per-dimension progress bar fill is proportional to score

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as fc from 'fast-check'
import EvalDashboard from '../pages/EvalDashboard'
import * as clientModule from '../api/client'

import type { EvalResultsResponse } from '../types/api'

function makeEvalResponse(overrides: Partial<EvalResultsResponse> = {}): EvalResultsResponse {
  return {
    dataset_name: 'module-01-week1-checkpoint',
    example_count: 30,
    aggregate_score: 0.82,
    dim_scores: { correctness: 0.85, relevance: 0.79 },
    has_results: true,
    ...overrides,
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <EvalDashboard />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Property 11: Aggregate score is displayed to exactly two decimal places
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------
describe('Property 11: Aggregate score displayed to exactly two decimal places', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('formats any score in [0,1] to exactly two decimal places', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (score) => {
          vi.spyOn(clientModule, 'getEvalResults').mockResolvedValue(
            makeEvalResponse({ aggregate_score: score }),
          )

          const { unmount } = renderDashboard()
          await waitFor(() =>
            expect(screen.getByTestId('aggregate-score')).toBeInTheDocument(),
          )

          const displayed = screen.getByTestId('aggregate-score').textContent ?? ''
          // Must match exactly X.XX format
          expect(displayed).toMatch(/^\d+\.\d{2}$/)

          unmount()
          vi.restoreAllMocks()
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 12: PASS/FAIL badge reflects the 0.75 threshold
// Validates: Requirements 7.4, 7.5
// ---------------------------------------------------------------------------
describe('Property 12: PASS/FAIL badge reflects the 0.75 threshold', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('shows PASS badge (green) for score >= 0.75', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0.75, max: 1, noNaN: true }),
        async (score) => {
          vi.spyOn(clientModule, 'getEvalResults').mockResolvedValue(
            makeEvalResponse({ aggregate_score: score }),
          )

          const { unmount } = renderDashboard()
          await waitFor(() =>
            expect(screen.getByTestId('pass-badge')).toBeInTheDocument(),
          )
          expect(screen.getByTestId('pass-badge').textContent).toBe('PASS')
          expect(screen.getByTestId('pass-badge').className).toContain('green')
          expect(screen.queryByTestId('fail-badge')).toBeNull()

          unmount()
          vi.restoreAllMocks()
        },
      ),
      { numRuns: 50 },
    )
  })

  it('shows FAIL badge (red) for score < 0.75 and names lowest dimension', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: Math.fround(0.7499), noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (score, correctness, relevance) => {
          vi.spyOn(clientModule, 'getEvalResults').mockResolvedValue(
            makeEvalResponse({
              aggregate_score: score,
              dim_scores: { correctness, relevance },
            }),
          )

          const { unmount } = renderDashboard()
          await waitFor(() =>
            expect(screen.getByTestId('fail-badge')).toBeInTheDocument(),
          )
          expect(screen.getByTestId('fail-badge').textContent).toBe('FAIL')
          expect(screen.getByTestId('fail-badge').className).toContain('red')
          expect(screen.queryByTestId('pass-badge')).toBeNull()

          // Lowest dimension: alphabetically first on ties
          const lowestDim = correctness <= relevance ? 'correctness' : 'relevance'
          expect(screen.getByTestId('lowest-dimension').textContent).toContain(lowestDim)

          unmount()
          vi.restoreAllMocks()
        },
      ),
      { numRuns: 50 },
    )
  })
})

// ---------------------------------------------------------------------------
// Property 13: Per-dimension progress bar fill is proportional to score
// Validates: Requirements 7.6
// ---------------------------------------------------------------------------
describe('Property 13: Per-dimension progress bar fill proportional to score', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('progress bar width equals score * 100% (±1% tolerance)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (correctness, relevance) => {
          vi.spyOn(clientModule, 'getEvalResults').mockResolvedValue(
            makeEvalResponse({
              aggregate_score: 0.8,
              dim_scores: { correctness, relevance },
            }),
          )

          const { unmount } = renderDashboard()
          await waitFor(() =>
            expect(screen.getByTestId('progress-correctness')).toBeInTheDocument(),
          )

          const correctnessBar = screen.getByTestId('progress-correctness')
          const relevanceBar = screen.getByTestId('progress-relevance')

          const expectedCorrectness = `${correctness * 100}%`
          const expectedRelevance = `${relevance * 100}%`

          expect(correctnessBar.style.width).toBe(expectedCorrectness)
          expect(relevanceBar.style.width).toBe(expectedRelevance)

          unmount()
          vi.restoreAllMocks()
        },
      ),
      { numRuns: 50 },
    )
  })
})

// ---------------------------------------------------------------------------
// Unit tests: loading skeleton, no-results message, retry button, error with status code
// Validates: Requirements 7.2, 7.9, 7.10
// ---------------------------------------------------------------------------
describe('EvalDashboard unit tests', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('shows loading skeleton while fetching', async () => {
    vi.spyOn(clientModule, 'getEvalResults').mockImplementation(
      () => new Promise(() => {}),
    )
    renderDashboard()
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('shows no-results message containing 03_challenge.ipynb', async () => {
    vi.spyOn(clientModule, 'getEvalResults').mockResolvedValue({
      dataset_name: 'module-01-week1-checkpoint',
      example_count: 0,
      aggregate_score: 0,
      dim_scores: { correctness: 0, relevance: 0 },
      has_results: false,
    })
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByTestId('no-results-panel')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('no-results-panel').textContent).toContain(
      '03_challenge.ipynb',
    )
    expect(screen.queryByTestId('aggregate-score')).toBeNull()
  })

  it('shows error panel with HTTP status code and Retry button', async () => {
    vi.spyOn(clientModule, 'getEvalResults').mockRejectedValue(
      Object.assign(new Error('fail'), {
        isAxiosError: true,
        code: undefined,
        response: { status: 502, data: {} },
      }),
    )
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByTestId('error-panel')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('error-panel').textContent).toContain('502')
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument()
  })

  it('retry button re-fetches results', async () => {
    const spy = vi.spyOn(clientModule, 'getEvalResults').mockRejectedValue(
      Object.assign(new Error('fail'), {
        isAxiosError: true,
        code: undefined,
        response: { status: 502, data: {} },
      }),
    )
    renderDashboard()
    await waitFor(() => expect(screen.getByTestId('retry-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('retry-btn'))
    // spy called at least twice (initial + retry)
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
  })
})
