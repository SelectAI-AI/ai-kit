// Feature: module-01-react-frontend, Step2Groq notebook page with self-attested code cells
//
// NOTE: Step2Groq is a notebook-style page with CodeCell components. Code
// cells run in the student's own local environment (no in-app sandbox), so
// completion is self-attested via "Mark as done" rather than a Run+validate
// round trip against a backend.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Step2Groq from '../pages/Step2Groq'

vi.mock('../hooks/useProgress', () => ({
  useProgress: () => ({
    completed: {},
    markComplete: vi.fn(),
    isLocked: () => false,
    highestCompleted: 1,
    completedCount: 1,
  }),
}))

// Mock Monaco editor — it doesn't work in jsdom
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

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Step2Groq unit tests', () => {
  it('renders the page title', () => {
    render(<Step2Groq />)
    expect(screen.getByText('Groq & ChatGroq')).toBeInTheDocument()
  })

  it('renders a "Mark as done" button for each code cell', () => {
    render(<Step2Groq />)
    const markDoneBtns = screen.getAllByRole('button', { name: /mark cell as done/i })
    expect(markDoneBtns.length).toBeGreaterThanOrEqual(4) // 4 exercises
  })

  it('renders concept check question', () => {
    render(<Step2Groq />)
    expect(
      screen.getByText('Which temperature setting produces more deterministic (consistent) output?'),
    ).toBeInTheDocument()
  })

  it('marks a cell done and shows the done state when clicked', () => {
    render(<Step2Groq />)
    const markDoneBtns = screen.getAllByRole('button', { name: /mark cell as done/i })
    fireEvent.click(markDoneBtns[0])

    expect(screen.getAllByText('✓ Marked done').length).toBeGreaterThan(0)
  })
})
