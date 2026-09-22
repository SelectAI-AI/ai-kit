/**
 * Shared layout for notebook-style step pages.
 * Renders a title, subtitle, and a vertical list of cells.
 */

interface NotebookPageProps {
  stepNumber: number
  title: string
  subtitle: string
  children: React.ReactNode
}

export default function NotebookPage({ stepNumber, title, subtitle, children }: NotebookPageProps) {
  return (
    <div className="max-w-3xl space-y-4 pb-12">
      {/* Page header */}
      <div className="pb-2 border-b border-border">
        <p className="text-xs text-accent font-mono mb-1">Step {stepNumber}</p>
        <h2 className="text-2xl font-bold tracking-wide text-foreground">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
      </div>

      {/* Cells */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

/** Section divider with a label */
export function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
