import { useState, useCallback } from 'react'
import * as clientModule from '../api/client'
import type { InvokeChainRequest, InvokeChainResponse, ApiError } from '../types/api'

interface UseChainInvokeState {
  data: InvokeChainResponse | null
  error: ApiError | null
  loading: boolean
  latencyMs: number | null
}

export function useChainInvoke() {
  const [state, setState] = useState<UseChainInvokeState>({
    data: null,
    error: null,
    loading: false,
    latencyMs: null,
  })

  const invoke = useCallback(async (params: InvokeChainRequest) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    const start = performance.now()
    try {
      const data = await clientModule.invokeChain(params)
      const latencyMs = Math.round(performance.now() - start)
      setState({ data, error: null, loading: false, latencyMs })
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: clientModule.normaliseError(err),
        loading: false,
        latencyMs: null,
      }))
    }
  }, [])

  return { ...state, invoke }
}
