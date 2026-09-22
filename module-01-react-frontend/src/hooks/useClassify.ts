import { useState, useCallback } from 'react'
import * as clientModule from '../api/client'
import type { ClassifyRequest, ClassifyResponse, ApiError } from '../types/api'

interface UseClassifyState {
  data: ClassifyResponse | null
  error: ApiError | null
  loading: boolean
}

export function useClassify() {
  const [state, setState] = useState<UseClassifyState>({
    data: null,
    error: null,
    loading: false,
  })

  const classify = useCallback(async (params: ClassifyRequest) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const data = await clientModule.classifyQuery(params)
      setState({ data, error: null, loading: false })
    } catch (err) {
      setState(prev => ({ ...prev, error: clientModule.normaliseError(err), loading: false }))
    }
  }, [])

  return { ...state, classify }
}
