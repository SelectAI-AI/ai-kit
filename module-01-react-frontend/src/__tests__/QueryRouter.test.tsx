// Feature: module-01-react-frontend, Property 18: Query Router category badge colour matches category
// Feature: module-01-react-frontend, Property 10: Empty or whitespace input is rejected without sending a request

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as fc from 'fast-check'
import QueryRouter from '../pages/QueryRouter'
import * as clientModule from '../api/client'

function renderQueryRouter() {
  cleanup()
  return render(
    <MemoryRouter>
      <QueryRouter />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Property 18: Query Router category badge colour matches category
// ---------------------------------------------------------------------------
describe('Property 18: Query Router category badge colour matches category', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('badge has correct colour class for each category value', async () => {
    const categoryArb = fc.oneof(
      fc.constantFrom('technical', 'creative', 'general'),
      fc.string({ minLength: 1, maxLength: 20 }).filter(
        s => !['technical', 'creative', 'general'].includes(s),
      ),
    )

    await fc.assert(
      fc.asyncProperty(
        categoryArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (category, responseText) => {
          cleanup()
          vi.spyOn(clientModule, 'classifyQuery').mockResolvedValue({
            category,
            response: responseText,
          })

          const { unmount } = renderQueryRouter()
          const textarea = screen.getByRole('textbox')
          // Use fireEvent.change for speed (avoids slow userEvent.type)
          fireEvent.change(textarea, { target: { value: 'test query' } })
          fireEvent.click(screen.getByRole('button', { name: /classify/i }))

          await waitFor(() =>
            expect(screen.getByTestId('category-badge')).toBeInTheDocument(),
          )

          const badge = screen.getByTestId('category-badge')
          const classes = badge.className

          if (category === 'technical') {
            expect(classes).toContain('bg-blue')
          } else if (category === 'creative') {
            expect(classes).toContain('bg-green')
          } else if (category === 'general') {
            expect(classes).toContain('bg-gray')
          } else {
            expect(classes).toContain('bg-yellow')
            expect(badge.textContent).toBe('unknown')
          }

          unmount()
          vi.restoreAllMocks()
        },
      ),
      { numRuns: 20 },
    )
  }, 30000)
})

// ---------------------------------------------------------------------------
// Property 10 (QueryRouter): Empty or whitespace input is rejected
// ---------------------------------------------------------------------------
describe('Property 10 (QueryRouter): Empty or whitespace input is rejected', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('does not call classifyQuery for empty or whitespace-only input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^\s*$/),
        async (whitespaceInput) => {
          cleanup()
          const spy = vi.spyOn(clientModule, 'classifyQuery').mockResolvedValue({
            category: 'technical',
            response: 'response',
          })

          const { unmount } = renderQueryRouter()
          const textarea = screen.getByRole('textbox')
          // Use fireEvent.change to set value directly (avoids userEvent appending to stale state)
          fireEvent.change(textarea, { target: { value: whitespaceInput } })
          fireEvent.click(screen.getByRole('button', { name: /classify/i }))

          // Alert appears synchronously — no need for waitFor
          expect(screen.getByRole('alert')).toBeInTheDocument()
          expect(spy).not.toHaveBeenCalled()

          unmount()
          vi.restoreAllMocks()
        },
      ),
      { numRuns: 20 },
    )
  })
})

// ---------------------------------------------------------------------------
// Unit tests: chip pre-fill, loading state, error panel preservation
// ---------------------------------------------------------------------------
describe('QueryRouter unit tests', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('clicking a chip pre-fills the textarea', async () => {
    renderQueryRouter()
    const chip = screen.getByTestId('chip-technical')
    fireEvent.click(chip)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('How does LCEL work?')
  })

  it('loading state disables the classify button', async () => {
    vi.spyOn(clientModule, 'classifyQuery').mockImplementation(
      () => new Promise(() => {}),
    )
    renderQueryRouter()
    await userEvent.type(screen.getByRole('textbox'), 'test')
    fireEvent.click(screen.getByRole('button', { name: /classify/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /classifying/i })).toBeDisabled(),
    )
  })

  it('error panel does not clear previous response', async () => {
    vi.spyOn(clientModule, 'classifyQuery')
      .mockResolvedValueOnce({ category: 'technical', response: 'First response' })
      .mockRejectedValueOnce(
        Object.assign(new Error('fail'), {
          isAxiosError: true,
          code: undefined,
          response: { status: 500, data: { detail: 'fail' } },
        }),
      )

    renderQueryRouter()
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test query' } })
    fireEvent.click(screen.getByRole('button', { name: /classify/i }))
    await waitFor(() => expect(screen.getByTestId('response-panel')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /classify/i }))
    await waitFor(() => expect(screen.getByTestId('error-panel')).toBeInTheDocument())

    expect(screen.getByTestId('response-panel')).toBeInTheDocument()
    expect(screen.getByText('First response')).toBeInTheDocument()
  }, 10000)
})
