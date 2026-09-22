/**
 * Read-only explanation cell — renders markdown-like content.
 * We keep it simple (no heavy markdown parser) using structured props.
 */

interface MarkdownCellProps {
  children: React.ReactNode
}

export default function MarkdownCell({ children }: MarkdownCellProps) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-5 py-4 text-sm text-foreground/90 space-y-2 leading-relaxed">
      {children}
    </div>
  )
}

/** Inline code span */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-secondary text-accent font-mono text-xs px-1.5 py-0.5 rounded">
      {children}
    </code>
  )
}

/** A read-only code block showing example/reference code */
export function CodeBlock({ code, language = 'python' }: { code: string; language?: string }) {
  return (
    <div className="rounded-md overflow-hidden border border-border my-2">
      <div className="bg-secondary px-3 py-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
        <span className="text-xs text-muted-foreground/70">read-only reference</span>
      </div>
      <pre className="bg-card text-foreground/90 text-xs font-mono px-4 py-3 overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  )
}

/** Callout box for tips/warnings */
export function Callout({ type = 'info', children }: { type?: 'info' | 'warning' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info:    'bg-cyan-500/10 border-cyan-500/40 text-cyan-300',
    warning: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
    tip:     'bg-green-500/10 border-green-500/40 text-green-300',
  }
  const icons = { info: 'ℹ', warning: '⚠', tip: '💡' }
  return (
    <div className={`rounded-md border px-4 py-3 text-sm flex gap-2 ${styles[type]}`}>
      <span>{icons[type]}</span>
      <div>{children}</div>
    </div>
  )
}
