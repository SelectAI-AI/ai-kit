// Feature: module-01-react-frontend, Property 9: Error responses preserve previously displayed output
// Feature: module-01-react-frontend, Property 10: Empty or whitespace input is rejected without sending a request

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as fc from 'fast-check'
import Playground from '../pages/Playground'
import * as clientModule from '../api/client'

function renderPlayground() {
  return render(
    <MemoryRouter>
      <Playground />
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Property 9: Error responses preserve previously displayed output (Playground)
// Validates: Requirements 5.8
// ---------------------------------------------------------------------------
describe('Property 9: Error responses preserve previously displayed output', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('previous output remains visible when a subsequent request errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        async (previousOutput) => {
          cleanup()
          vi.spyOn(clientModule, 'invokeChain')
            .mockResolvedValueOnce({ output: previousOutput, chain_type: 'basic' })
            .mockRejectedValueOnce(
              Object.assign(new Error('fail'), {
                isAxiosError: true,
                code: undefined,
                response: { status: 500, data: { detail: 'server error' } },
              }),
            )

          const { unmount, container } = renderPlayground()
          const view = within(container)
          const textarea = view.getByTestId('query-input')
          // Use fireEvent.change for speed
          fireEvent.change(textarea, { target: { value: 'test query' } })
          fireEvent.click(view.getByTestId('submit-btn'))

          // Wait for first successful response
          await waitFor(() =>
            expect(view.getByTestId('output-panel')).toBeInTheDocument(),
          )

          // Submit again to trigger error
          fireEvent.click(view.getByTestId('submit-btn'))
          await waitFor(() =>
            expect(view.getByTestId('error-panel')).toBeInTheDocument(),
          )

          // Previous output must still be visible
          expect(view.getByTestId('output-panel')).toBeInTheDocument()
          expect(view.getByTestId('basic-output').textContent).toBe(previousOutput)

          unmount()
          vi.restoreAllMocks()
        },
      ),
      { numRuns: 20 },
    )
  }, 30000)
})

// ---------------------------------------------------------------------------
// Property 10 (Playground): Empty or whitespace input is rejected
// Validates: Requirements 5.11
// ---------------------------------------------------------------------------
describe('Property 10 (Playground): Empty or whitespace input is rejected', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('does not call invokeChain for empty or whitespace-only input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^\s*$/),
        async (whitespaceInput) => {
          cleanup()
          const spy = vi.spyOn(clientModule, 'invokeChain').mockResolvedValue({
            output: 'mocked',
            chain_type: 'basic',
          })

          const { unmount, container } = renderPlayground()
          const view = within(container)
          const textarea = view.getByTestId('query-input')
          // Use fireEvent.change to set value directly
          fireEvent.change(textarea, { target: { value: whitespaceInput } })
          fireEvent.click(view.getByTestId('submit-btn'))

          // Alert appears synchronously
          expect(view.getByRole('alert')).toBeInTheDocument()
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
// Unit tests: chain selector default, loading state, output panel per chain type, latency
// ---------------------------------------------------------------------------
describe('Playground unit tests', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('defaults to Basic (StrOutputParser) chain', () => {
    renderPlayground()
    const basicRadio = screen.getByTestId('chain-option-basic') as HTMLInputElement
    expect(basicRadio.checked).toBe(true)
  })

  it('loading state disables the submit button', async () => {
    vi.spyOn(clientModule, 'invokeChain').mockImplementation(() => new Promise(() => {}))
    renderPlayground()
    await userEvent.type(screen.getByTestId('query-input'), 'test')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('submit-btn')).toBeDisabled(),
    )
  })

  it('renders basic output as plain text', async () => {
    vi.spyOn(clientModule, 'invokeChain').mockResolvedValue({
      output: 'Hello world',
      chain_type: 'basic',
    })
    renderPlayground()
    await userEvent.type(screen.getByTestId('query-input'), 'test')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() => expect(screen.getByTestId('basic-output')).toBeInTheDocument())
    expect(screen.getByTestId('basic-output').textContent).toBe('Hello world')
  })

  it('renders json output as syntax-highlighted JSON block', async () => {
    vi.spyOn(clientModule, 'invokeChain').mockResolvedValue({
      output: { answer: 'yes' },
      chain_type: 'json',
    })
    renderPlayground()
    fireEvent.click(screen.getByTestId('chain-option-json'))
    await userEvent.type(screen.getByTestId('query-input'), 'test')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() => expect(screen.getByTestId('json-output')).toBeInTheDocument())
    expect(screen.getByTestId('json-output').textContent).toContain('"answer"')
  })

  it('renders pydantic output as structured card', async () => {
    vi.spyOn(clientModule, 'invokeChain').mockResolvedValue({
      output: { category: 'technical', confidence: 0.9, reasoning: 'test reason' },
      chain_type: 'pydantic',
    })
    renderPlayground()
    fireEvent.click(screen.getByTestId('chain-option-pydantic'))
    await userEvent.type(screen.getByTestId('query-input'), 'test')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() => expect(screen.getByTestId('pydantic-output')).toBeInTheDocument())
    expect(screen.getByTestId('pydantic-output').textContent).toContain('technical')
    expect(screen.getByTestId('pydantic-output').textContent).toContain('0.9')
    expect(screen.getByTestId('pydantic-output').textContent).toContain('test reason')
  })

  it('displays latency after successful response', async () => {
    vi.spyOn(clientModule, 'invokeChain').mockResolvedValue({
      output: 'response',
      chain_type: 'basic',
    })
    renderPlayground()
    await userEvent.type(screen.getByTestId('query-input'), 'test')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() => expect(screen.getByTestId('latency')).toBeInTheDocument())
    expect(screen.getByTestId('latency').textContent).toMatch(/Latency: \d+ ms/)
  })
})
