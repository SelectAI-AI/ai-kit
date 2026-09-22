import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useChainInvoke } from '../hooks/useChainInvoke'
import type { ChainType, QueryAnalysisOutput } from '../types/api'

const CHAIN_OPTIONS: { value: ChainType; label: string }[] = [
  { value: 'basic', label: 'Basic (StrOutputParser)' },
  { value: 'json', label: 'JSON (JsonOutputParser)' },
  { value: 'pydantic', label: 'Pydantic (PydanticOutputParser)' },
]

function isQueryAnalysisOutput(val: unknown): val is QueryAnalysisOutput {
  return (
    typeof val === 'object' &&
    val !== null &&
    'category' in val &&
    'confidence' in val &&
    'reasoning' in val
  )
}

export default function Playground() {
  const [chainType, setChainType] = useState<ChainType>('basic')
  const [query, setQuery] = useState('')
  const [validationMsg, setValidationMsg] = useState('')
  const { data, error, loading, latencyMs, invoke } = useChainInvoke()

  const handleSubmit = async () => {
    if (!query.trim()) {
      setValidationMsg('Please enter a question before submitting.')
      return
    }
    setValidationMsg('')
    await invoke({ chain_type: chainType, query })
  }

  return (
    <div>
      <PageHeader sectionName="Playground" />
      <main className="p-6 max-w-3xl space-y-4">
        {/* Chain selector */}
        <div className="flex gap-3 flex-wrap">
          {CHAIN_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="chain-type"
                value={opt.value}
                checked={chainType === opt.value}
                onChange={() => setChainType(opt.value)}
                data-testid={`chain-option-${opt.value}`}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Query input */}
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Enter your question…"
          data-testid="query-input"
          className="w-full border rounded p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {validationMsg && (
          <p role="alert" data-testid="validation-msg" className="text-red-600 text-sm">
            {validationMsg}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          data-testid="submit-btn"
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Running…' : 'Submit'}
        </button>

        {/* Output panel */}
        {data && (
          <div data-testid="output-panel" className="border rounded p-4 bg-white space-y-2">
            {latencyMs !== null && (
              <p data-testid="latency" className="text-xs text-gray-500">
                Latency: {latencyMs} ms
              </p>
            )}
            {data.chain_type === 'json' ? (
              <pre
                data-testid="json-output"
                className="bg-gray-900 text-green-400 rounded p-3 text-xs overflow-auto"
              >
                {JSON.stringify(data.output, null, 2)}
              </pre>
            ) : data.chain_type === 'pydantic' && isQueryAnalysisOutput(data.output) ? (
              <div data-testid="pydantic-output" className="space-y-1 text-sm">
                <p><strong>Category:</strong> {data.output.category}</p>
                <p><strong>Confidence:</strong> {data.output.confidence}</p>
                <p><strong>Reasoning:</strong> {data.output.reasoning}</p>
              </div>
            ) : (
              <p data-testid="basic-output" className="text-sm whitespace-pre-wrap">
                {String(data.output)}
              </p>
            )}
          </div>
        )}

        {/* Error panel */}
        {error && (
          <div
            role="alert"
            data-testid="error-panel"
            className="border border-red-300 bg-red-50 rounded p-4 text-red-700 text-sm"
          >
            {error.message}
          </div>
        )}
      </main>
    </div>
  )
}
