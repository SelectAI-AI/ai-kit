import { useState, useEffect, useCallback } from 'react'
import { getApiStatus } from '../api/client'
import type { ApiStatusResponse } from '../types/api'

interface ApiStatusState {
  connected: boolean
  langsmithProject: string | null
  groqModel: string
  loading: boolean
}

export function useApiStatus() {
  const [state, setState] = useState<ApiStatusState>({
    connected: false,
    langsmithProject: null,
    groqModel: 'llama3-8b-8192',
    loading: true,
  })

  const poll = useCallback(async () => {
    try {
      const data: ApiStatusResponse = await getApiStatus()
      setState({
        connected: data.connected,
        langsmithProject: data.langsmith_project,
        groqModel: data.groq_model,
        loading: false,
      })
    } catch {
      setState(prev => ({ ...prev, connected: false, loading: false }))
    }
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, 30_000)
    return () => clearInterval(interval)
  }, [poll])

  return state
}
