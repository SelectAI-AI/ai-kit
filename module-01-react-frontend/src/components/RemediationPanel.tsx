import { Button } from './ui/button'

interface RemediationPanelProps {
  text: string
  onTryAgain: () => void
}

export default function RemediationPanel({ text, onTryAgain }: RemediationPanelProps) {
  return (
    <div
      data-testid="remediation-panel"
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3"
    >
      <p className="text-sm font-semibold text-amber-300">Explanation</p>
      <p className="text-sm text-amber-200 whitespace-pre-wrap">{text}</p>
      <Button variant="outline" onClick={onTryAgain}>
        Try Again
      </Button>
    </div>
  )
}
