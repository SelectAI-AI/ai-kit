import { useState } from 'react'
import { Button } from './ui/button'
import type { ApiError } from '../types/api'

interface ExercisePanelProps {
  label: string
  placeholder?: string
  maxLength?: number
  submitLabel?: string
  onSubmit: (value: string) => void
  loading: boolean
  error: ApiError | null
  children?: React.ReactNode
}

export default function ExercisePanel({
  label,
  placeholder = 'Enter your query…',
  maxLength = 500,
  submitLabel = 'Submit',
  onSubmit,
  loading,
  error,
  children,
}: ExercisePanelProps) {
  const [value, setValue] = useState('')
  const [validationMsg, setValidationMsg] = useState<string | null>(null)

  function handleSubmit() {
    if (!value.trim()) {
      setValidationMsg('Please enter a non-empty query.')
      return
    }
    setValidationMsg(null)
    onSubmit(value)
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground/80">{label}</label>
      <textarea
        className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        rows={4}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={e => {
          setValue(e.target.value)
          if (validationMsg) setValidationMsg(null)
        }}
        disabled={loading}
        aria-label={label}
      />
      {validationMsg && (
        <p
          data-testid="validation-message"
          className="text-red-400 text-xs"
          role="alert"
        >
          {validationMsg}
        </p>
      )}
      <Button onClick={handleSubmit} disabled={loading || !value.trim()}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span
              data-testid="loading-spinner"
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
            />
            Loading…
          </span>
        ) : (
          submitLabel
        )}
      </Button>

      {/* Error panel — shown without clearing previous output */}
      {error && (
        <div
          data-testid="error-panel"
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error.message}
          {error.status ? ` (HTTP ${error.status})` : ''}
        </div>
      )}

      {/* Output slot — caller renders formatted output here */}
      {children}
    </div>
  )
}
