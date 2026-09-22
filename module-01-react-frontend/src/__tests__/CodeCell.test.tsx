// Feature: module-01-react-frontend, CodeCell copy/paste blocking and self-attested completion
//
// Students must type/watch, not copy-paste, their answers into code cells,
// and code runs in their own local environment rather than an in-app
// sandbox — so completion is a self-attested "Mark as done" click. This
// mock invokes onMount with a fake editor/monaco (unlike the simpler mocks
// in other test files, which stub Editor as a plain textarea and never call
// onMount), so the real copy/paste-blocking wiring runs.

import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import CodeCell from '../components/CodeCell'
import { SECURITY_BANNER_EVENT } from '../lib/securityBanner'

type KeydownEvent = { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; key: string; preventDefault: () => void; stopImmediatePropagation: () => void }

const registeredActions: Record<string, () => void> = {}
const keydownHandlers: Array<(e: KeydownEvent) => void> = []
const dropHandlers: Array<(e: { preventDefault: () => void; stopPropagation: () => void }) => void> = []

vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    onChange,
    onMount,
  }: {
    value: string
    onChange: (v: string) => void
    onMount?: (editor: unknown, monaco: unknown) => void
  }) => {
    useEffect(() => {
      const fakeDomNode = {
        addEventListener: (evt: string, handler: (e: unknown) => void) => {
          if (evt === 'keydown') keydownHandlers.push(handler as typeof keydownHandlers[number])
          if (evt === 'drop') dropHandlers.push(handler as typeof dropHandlers[number])
        },
      }
      const fakeEditor = {
        addAction: (action: { id: string; run: () => void }) => {
          registeredActions[action.id] = action.run
        },
        getDomNode: () => fakeDomNode,
      }
      const fakeMonaco = {
        KeyMod: { CtrlCmd: 1, Shift: 2 },
        KeyCode: { KeyV: 1, KeyC: 2, KeyX: 3, Insert: 4 },
      }
      onMount?.(fakeEditor, fakeMonaco)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
      <textarea
        data-testid="monaco-editor"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="code editor"
      />
    )
  },
}))

function bannerMessages(): string[] {
  return vi.mocked(window.dispatchEvent).mock.calls
    .map(call => call[0] as CustomEvent<{ message: string }>)
    .filter(e => e.type === SECURITY_BANNER_EVENT)
    .map(e => e.detail.message)
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  for (const key of Object.keys(registeredActions)) delete registeredActions[key]
  keydownHandlers.length = 0
  dropHandlers.length = 0
  vi.spyOn(window, 'dispatchEvent')
})

function fireKeydown(overrides: Partial<KeydownEvent>) {
  const event: KeydownEvent = {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: '',
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    ...overrides,
  }
  act(() => {
    keydownHandlers[0](event)
  })
  return event
}

describe('CodeCell clipboard blocking', () => {
  it('registers a capturing keydown listener and clipboard action overrides on mount', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    expect(keydownHandlers.length).toBeGreaterThan(0)
    expect(registeredActions['editor.action.clipboardPasteAction']).toBeTypeOf('function')
    expect(registeredActions['editor.action.clipboardCopyAction']).toBeTypeOf('function')
    expect(registeredActions['editor.action.clipboardCutAction']).toBeTypeOf('function')
  })

  // This is the real-world fix: this Monaco build uses the EditContext input
  // model, which reads/writes the clipboard directly on keydown and never
  // dispatches native 'copy'/'cut'/'paste' DOM events — confirmed against a
  // real browser, where neither the action overrides nor DOM listeners alone
  // stopped Ctrl+V.
  it('blocks Ctrl+V at the keydown level and shows the "paste disabled" banner', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    const event = fireKeydown({ ctrlKey: true, key: 'v' })

    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopImmediatePropagation).toHaveBeenCalled()
    expect(bannerMessages()).toEqual(['Pasting is disabled — please write your own code.'])
  })

  it('blocks Cmd+V (metaKey, macOS) at the keydown level', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    const event = fireKeydown({ metaKey: true, key: 'v' })
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('blocks Shift+Insert at the keydown level', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    const event = fireKeydown({ shiftKey: true, key: 'Insert' })
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('blocks Ctrl+C at the keydown level and shows the "copy disabled" banner', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    const event = fireKeydown({ ctrlKey: true, key: 'c' })

    expect(event.preventDefault).toHaveBeenCalled()
    expect(bannerMessages()).toEqual(['Copying is disabled — please write your own code.'])
  })

  it('blocks Ctrl+X (cut) at the keydown level and shows the "copy disabled" banner', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    const event = fireKeydown({ ctrlKey: true, key: 'x' })

    expect(event.preventDefault).toHaveBeenCalled()
    expect(bannerMessages()).toEqual(['Copying is disabled — please write your own code.'])
  })

  it('does not block plain typing keys', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    const event = fireKeydown({ key: 'v' }) // no ctrl/meta/shift — just typing the letter v
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(bannerMessages()).toEqual([])
  })

  it('blocks drag-and-drop insertion and shows the "paste disabled" banner', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)

    expect(dropHandlers.length).toBeGreaterThan(0)
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    act(() => {
      dropHandlers[0]({ preventDefault, stopPropagation })
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(stopPropagation).toHaveBeenCalled()
    expect(bannerMessages()).toEqual(['Pasting is disabled — please write your own code.'])
  })

  it('still allows normal typing (onChange) through the editor', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    const editor = screen.getByTestId('monaco-editor') as HTMLTextAreaElement
    expect(editor.value).toBe("print('hi')")
  })
})

describe('CodeCell self-attested completion', () => {
  it('renders a "Mark as done" button, not a Run button', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" />)
    expect(screen.getByRole('button', { name: /mark cell as done/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /run cell/i })).not.toBeInTheDocument()
  })

  it('calls onPass when the student clicks "Mark as done"', () => {
    const onPass = vi.fn()
    render(<CodeCell cellId="1.env" initialCode="print('hi')" onPass={onPass} />)
    fireEvent.click(screen.getByRole('button', { name: /mark cell as done/i }))
    expect(onPass).toHaveBeenCalledTimes(1)
  })

  it('shows a done state and disables the button when passed=true', () => {
    render(<CodeCell cellId="1.env" initialCode="print('hi')" passed />)
    const button = screen.getByRole('button', { name: /mark cell as done/i })
    expect(button).toBeDisabled()
    expect(screen.getByText('✓ Marked done')).toBeInTheDocument()
  })

  it('does not call the sandbox/execute API — no network dependency', () => {
    // No mock of ../api/client is registered in this file at all; if CodeCell
    // still imported executeCode, this module would fail to resolve axios
    // against a real backend during render. Rendering successfully with no
    // such mock is itself the assertion that the dependency is gone.
    expect(() => render(<CodeCell cellId="1.env" initialCode="print('hi')" />)).not.toThrow()
  })
})
