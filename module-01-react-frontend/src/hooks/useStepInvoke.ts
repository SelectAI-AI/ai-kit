import { useState, useCallback } from 'react'
import { normaliseError } from '../api/client'
import type { ApiError } from '../types/api'

interface StepInvokeState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
}

export function useStepInvoke<T>() {
  const [state, setState] = useState<StepInvokeState<T>>({
    data: null,
    error: null,
    loading: false,
  })

  const invoke = useCallback(async (fn: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fn()
      setState({ data, error: null, loading: false })
    } catch (err) {
      setState(prev => ({ ...prev, error: normaliseError(err), loading: false }))
    }
  }, [])

  return { ...state, invoke }
}
