import { useState, useCallback } from 'react'

export interface ApiKeys {
  groqApiKey: string
  langchainApiKey: string
  langchainTracingV2: string
  langchainProject: string
}

const STORAGE_KEY = 'module-01-api-keys'

const DEFAULTS: ApiKeys = {
  groqApiKey: '',
  langchainApiKey: '',
  langchainTracingV2: 'true',
  langchainProject: 'module-01-dev',
}

function readFromStorage(): ApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ApiKeys>
    return {
      groqApiKey: parsed.groqApiKey ?? '',
      langchainApiKey: parsed.langchainApiKey ?? '',
      langchainTracingV2: parsed.langchainTracingV2 ?? 'true',
      langchainProject: parsed.langchainProject ?? 'module-01-dev',
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeToStorage(keys: ApiKeys): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // localStorage unavailable — degrade gracefully
  }
}

export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKeys>(() => readFromStorage())
  const [saved, setSaved] = useState(false)

  const updateKey = useCallback((field: keyof ApiKeys, value: string) => {
    setKeys(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }, [])

  const saveKeys = useCallback((newKeys: ApiKeys) => {
    setKeys(newKeys)
    writeToStorage(newKeys)
    setSaved(true)
  }, [])

  const allFilled = Boolean(
    keys.groqApiKey.trim() &&
    keys.langchainApiKey.trim() &&
    keys.langchainTracingV2.trim() &&
    keys.langchainProject.trim(),
  )

  return { keys, updateKey, saveKeys, saved, allFilled }
}

/** Read keys from storage without React — used by the Axios interceptor */
export function getStoredKeys(): ApiKeys {
  return readFromStorage()
}
