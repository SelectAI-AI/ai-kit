import PageHeader from '../components/PageHeader'
import { useEvalResults } from '../hooks/useEvalResults'

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      data-testid="skeleton"
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  )
}

export default function EvalDashboard() {
  const { data, error, loading, refresh } = useEvalResults()

  return (
    <div>
      <PageHeader sectionName="Eval Dashboard" />
      <main className="p-6 max-w-2xl space-y-6">
        {loading && (
          <div data-testid="loading-skeleton" className="space-y-3">
            <SkeletonBlock className="h-8 w-32" />
            <SkeletonBlock className="h-4 w-48" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-full" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            data-testid="error-panel"
            className="border border-red-300 bg-red-50 rounded p-4 text-red-700 text-sm space-y-2"
          >
            <p>
              {error.message}
              {error.status ? ` (HTTP ${error.status})` : ''}
            </p>
            <button
              data-testid="retry-btn"
              onClick={refresh}
              className="px-3 py-1 bg-red-600 text-white rounded text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && data && !data.has_results && (
          <div data-testid="no-results-panel" className="text-gray-600 text-sm">
            <p>
              No evaluation results found. Run the evaluation from{' '}
              <code className="bg-gray-100 px-1 rounded">03_challenge.ipynb</code> to
              see your scores here.
            </p>
          </div>
        )}

        {!loading && data && data.has_results && (
          <div className="space-y-4">
            {/* Aggregate score + badge */}
            <div className="flex items-center gap-4">
              <span
                data-testid="aggregate-score"
                className="text-3xl font-bold text-gray-900"
              >
                {data.aggregate_score.toFixed(2)}
              </span>
              {data.aggregate_score >= 0.75 ? (
                <span
                  data-testid="pass-badge"
                  className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800"
                >
                  PASS
                </span>
              ) : (
                <span
                  data-testid="fail-badge"
                  className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800"
                >
                  FAIL
                </span>
              )}
            </div>

            {/* Lowest dimension on FAIL */}
            {data.aggregate_score < 0.75 && (
              <p data-testid="lowest-dimension" className="text-sm text-gray-600">
                Lowest dimension:{' '}
                <strong>
                  {data.dim_scores.correctness <= data.dim_scores.relevance
                    ? 'correctness'
                    : 'relevance'}
                </strong>
              </p>
            )}

            {/* Per-dimension progress bars */}
            <div className="space-y-3">
              {(['correctness', 'relevance'] as const).map(dim => (
                <div key={dim}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-gray-700">{dim}</span>
                    <span className="text-gray-500">
                      {data.dim_scores[dim].toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      data-testid={`progress-${dim}`}
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${data.dim_scores[dim] * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Dataset info */}
            <p className="text-sm text-gray-500">
              Dataset: <strong>{data.dataset_name}</strong> &mdash;{' '}
              {data.example_count} examples
            </p>

            <button
              data-testid="refresh-btn"
              onClick={refresh}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
            >
              Refresh
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
