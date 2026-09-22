import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useClassify } from '../hooks/useClassify'

const EXAMPLE_CHIPS = [
  { label: 'How does LCEL work?', category: 'technical' },
  { label: 'Write a haiku about neural networks', category: 'creative' },
  { label: 'What is LangChain?', category: 'general' },
]

const BADGE_CLASSES: Record<string, string> = Object.assign(Object.create(null), {
  technical: 'bg-blue-100 text-blue-800',
  creative: 'bg-green-100 text-green-800',
  general: 'bg-gray-100 text-gray-800',
})

function getCategoryBadgeClass(category: string): string {
  return Object.prototype.hasOwnProperty.call(BADGE_CLASSES, category)
    ? BADGE_CLASSES[category]
    : 'bg-yellow-100 text-yellow-800'
}

function getCategoryLabel(category: string): string {
  return ['technical', 'creative', 'general'].includes(category) ? category : 'unknown'
}

export default function QueryRouter() {
  const [query, setQuery] = useState('')
  const [validationMsg, setValidationMsg] = useState('')
  const { data, error, loading, classify } = useClassify()

  const handleClassify = async () => {
    if (!query.trim()) {
      setValidationMsg('Please enter a query before classifying.')
      return
    }
    setValidationMsg('')
    await classify({ query })
  }

  return (
    <div>
      <PageHeader sectionName="Query Router" />
      <main className="p-6 max-w-3xl space-y-4">
        {/* Example chips */}
        <div className="flex gap-2 flex-wrap">
          {EXAMPLE_CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => setQuery(chip.label)}
              data-testid={`chip-${chip.category}`}
              className="px-3 py-1 text-sm border rounded-full bg-gray-50 hover:bg-gray-100"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Enter your query…"
          className="w-full border rounded p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {validationMsg && (
          <p role="alert" className="text-red-600 text-sm">{validationMsg}</p>
        )}

        <button
          onClick={handleClassify}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Classifying…' : 'Classify & Route'}
        </button>

        {/* Result */}
        {data && (
          <div className="space-y-3">
            <span
              data-testid="category-badge"
              data-category={data.category}
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getCategoryBadgeClass(data.category)}`}
            >
              {getCategoryLabel(data.category)}
            </span>
            <div
              data-testid="response-panel"
              className="border rounded p-4 bg-white text-sm whitespace-pre-wrap"
            >
              {data.response}
            </div>
          </div>
        )}

        {/* Error */}
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
