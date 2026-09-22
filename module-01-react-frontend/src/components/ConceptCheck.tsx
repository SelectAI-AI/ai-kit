import { useState } from 'react'
import { Button } from './ui/button'
import RemediationPanel from './RemediationPanel'

interface Option {
  label: string
  value: string
}

interface ConceptCheckProps {
  question: string
  options: Option[]
  correctValue: string
  remediationText: string
  stepIndex: number
  isCompleted: boolean
  onComplete: () => void
}

export default function ConceptCheck({
  question,
  options,
  correctValue,
  remediationText,
  isCompleted,
  onComplete,
}: ConceptCheckProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [showRemediation, setShowRemediation] = useState(false)

  // On revisit of completed step — render in completed state immediately
  if (isCompleted && !submitted) {
    return (
      <div
        data-testid="concept-check-completed"
        className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 space-y-3"
      >
        <p className="font-medium text-foreground/90">{question}</p>
        <p className="text-green-400 font-semibold">✓ Completed</p>
        <Button variant="outline" onClick={onComplete}>
          Continue →
        </Button>
      </div>
    )
  }

  if (submitted && isCorrect) {
    return (
      <div
        data-testid="concept-check-correct"
        className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 space-y-3"
      >
        <p className="font-medium text-foreground/90">{question}</p>
        <p className="text-green-400 font-semibold">✓ Correct!</p>
        <Button variant="outline" onClick={onComplete}>
          Continue →
        </Button>
      </div>
    )
  }

  function handleSubmit() {
    if (!selected) return
    const correct = selected === correctValue
    setIsCorrect(correct)
    setSubmitted(true)
    if (correct) {
      onComplete()
    } else {
      setShowRemediation(true)
    }
  }

  function handleTryAgain() {
    setSelected(null)
    setSubmitted(false)
    setIsCorrect(false)
    setShowRemediation(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <p className="font-medium text-foreground/90">{question}</p>

      <div className="space-y-2" role="radiogroup" aria-label={question}>
        {options.map(opt => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
              selected === opt.value
                ? 'border-accent bg-secondary'
                : 'border-border hover:bg-secondary/60'
            } ${submitted && !isCorrect ? 'border-red-400/60' : ''}`}
          >
            <input
              type="radio"
              name="concept-check"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              className="accent-accent"
            />
            <span className="text-sm text-foreground/80">{opt.label}</span>
          </label>
        ))}
      </div>

      {submitted && !isCorrect && (
        <p className="text-red-400 text-sm font-medium">✗ Incorrect — see explanation below.</p>
      )}

      {!submitted && (
        <Button onClick={handleSubmit} disabled={!selected}>
          Submit
        </Button>
      )}

      {showRemediation && (
        <RemediationPanel text={remediationText} onTryAgain={handleTryAgain} />
      )}
    </div>
  )
}
