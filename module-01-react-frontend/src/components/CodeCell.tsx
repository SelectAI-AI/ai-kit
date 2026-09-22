import { useState, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { showSecurityBanner } from '../lib/securityBanner'

const LINE_HEIGHT = 20   // px per line at fontSize 14
const PADDING     = 24   // top + bottom padding
const MIN_HEIGHT  = 320  // minimum editor height in px
const MAX_HEIGHT  = 700  // maximum editor height in px

const PASTE_MESSAGE = 'Pasting is disabled — please write your own code.'
const COPY_MESSAGE = 'Copying is disabled — please write your own code.'

function calcHeight(code: string): number {
  const lines = code.split('\n').length
  const raw = lines * LINE_HEIGHT + PADDING
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, raw))
}

interface CodeCellProps {
  cellId: string
  initialCode: string
  onPass?: () => void
  passed?: boolean
}

export default function CodeCell({ cellId, initialCode, onPass, passed = false }: CodeCellProps) {
  const [code, setCode] = useState(initialCode)
  const [editorHeight, setEditorHeight] = useState(() => calcHeight(initialCode))
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  // Recalculate height whenever code changes
  useEffect(() => {
    setEditorHeight(calcHeight(code))
  }, [code])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // Override the built-in clipboard actions — catches command-palette and
    // right-click-menu triggered copy/cut/paste.
    editor.addAction({
      id: 'editor.action.clipboardPasteAction',
      label: 'Paste',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, monaco.KeyMod.Shift | monaco.KeyCode.Insert],
      run: () => showSecurityBanner(PASTE_MESSAGE),
    })
    editor.addAction({
      id: 'editor.action.clipboardCopyAction',
      label: 'Copy',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC],
      run: () => showSecurityBanner(COPY_MESSAGE),
    })
    editor.addAction({
      id: 'editor.action.clipboardCutAction',
      label: 'Cut',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX],
      run: () => showSecurityBanner(COPY_MESSAGE),
    })

    const domNode = editor.getDomNode()

    // The action overrides above do NOT catch real Ctrl/Cmd+V/C/X keypresses:
    // this editor build uses Monaco's EditContext-based input model, which
    // reads/writes the clipboard directly on keydown rather than dispatching
    // native 'copy'/'cut'/'paste' DOM events. So the actual fix is to
    // intercept those chords at the keydown level, in the capture phase,
    // before Monaco's own handler runs.
    domNode?.addEventListener(
      'keydown',
      e => {
        const mod = e.ctrlKey || e.metaKey
        const key = e.key.toLowerCase()
        const isPaste = (mod && key === 'v') || (e.shiftKey && e.key === 'Insert')
        const isCopyOrCut = mod && (key === 'c' || key === 'x')
        if (isPaste || isCopyOrCut) {
          e.preventDefault()
          e.stopImmediatePropagation()
          showSecurityBanner(isPaste ? PASTE_MESSAGE : COPY_MESSAGE)
        }
      },
      true,
    )

    // Defense in depth, in case a build/browser does dispatch native
    // clipboard DOM events (e.g. a plain hidden-textarea input model).
    for (const evt of ['paste', 'copy', 'cut'] as const) {
      domNode?.addEventListener(
        evt,
        e => {
          e.preventDefault()
          e.stopImmediatePropagation()
          showSecurityBanner(evt === 'paste' ? PASTE_MESSAGE : COPY_MESSAGE)
        },
        true,
      )
    }

    // Also block native drag-and-drop text insertion.
    domNode?.addEventListener('drop', e => {
      e.preventDefault()
      e.stopPropagation()
      showSecurityBanner(PASTE_MESSAGE)
    })
  }

  return (
    <div className={`rounded-lg border overflow-hidden ${passed ? 'border-green-400' : 'border-border'}`}>

      {/* ── Cell header ── */}
      <div className="flex items-center justify-between bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono select-none">{cellId}</span>
          {passed && (
            <span className="text-xs text-green-400 font-semibold">✓ Marked done</span>
          )}
        </div>
        <button
          onClick={() => onPass?.()}
          disabled={passed}
          className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            passed
              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
              : 'bg-gradient-primary text-white hover:opacity-90'
          }`}
          aria-label="Mark cell as done"
        >
          {passed ? '✓ Done' : 'Mark as done'}
        </button>
      </div>

      {/* ── Monaco editor ── */}
      <div className="bg-background" style={{ height: editorHeight }}>
        <Editor
          height={editorHeight}
          defaultLanguage="python"
          value={code}
          onChange={v => setCode(v ?? '')}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: LINE_HEIGHT,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            padding: { top: 12, bottom: 12 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { vertical: 'auto', horizontal: 'hidden', verticalScrollbarSize: 6 },
            renderLineHighlight: 'line',
            contextmenu: true,
            folding: true,
            glyphMargin: false,
            lineDecorationsWidth: 4,
          }}
        />
      </div>

      {/* ── Local-run instructions ── */}
      <div className="border-t border-border bg-secondary/40 px-4 py-2.5 text-xs text-muted-foreground">
        Run this code yourself in your local Python environment (see the{' '}
        <code className="font-mono text-accent">module-01-foundations</code> setup), then click
        "Mark as done" once your output matches what's expected.
      </div>
    </div>
  )
}
