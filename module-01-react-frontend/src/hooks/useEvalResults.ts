import { useState, useCallback, useEffect } from 'react'
import { getEvalResults, normaliseError } from '../api/client'
import type { EvalResultsResponse, ApiError } from '../types/api'

interface UseEvalResultsState {
  data: EvalResultsResponse | null
  error: ApiError | null
  loading: boolean
}

export function useEvalResults() {
  const [state, setState] = useState<UseEvalResultsState>({
    data: null,
    error: null,
    loading: false,
  })

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const data = await getEvalResults()
      setState({ data, error: null, loading: false })
    } catch (err) {
      setState(prev => ({ ...prev, error: normaliseError(err), loading: false }))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...state, refresh }
}
