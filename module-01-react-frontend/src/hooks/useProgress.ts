import { useState, useCallback } from 'react'
import type { ProgressState } from '../types/api'

const STORAGE_KEY = 'module-01-progress'

function readFromStorage(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    const state: ProgressState = {}
    for (let i = 1; i <= 6; i++) {
      state[i] = parsed[String(i)] === true
    }
    return state
  } catch {
    return {}
  }
}

function writeToStorage(state: ProgressState): void {
  try {
    const serialisable: Record<string, boolean> = {}
    for (let i = 1; i <= 6; i++) {
      serialisable[String(i)] = state[i] === true
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialisable))
  } catch {
    // localStorage unavailable — degrade gracefully (state kept in memory)
  }
}

export function useProgress() {
  const [completed, setCompleted] = useState<ProgressState>(() => readFromStorage())

  const markComplete = useCallback((stepIndex: number) => {
    setCompleted(prev => {
      const next = { ...prev, [stepIndex]: true }
      writeToStorage(next)
      return next
    })
  }, [])

  const highestCompleted = (() => {
    let highest = 0
    for (let i = 1; i <= 6; i++) {
      if (completed[i]) highest = i
    }
    return highest
  })()

  const isLocked = useCallback(
    (stepIndex: number) => stepIndex > highestCompleted + 1,
    [highestCompleted],
  )

  const completedCount = Object.values(completed).filter(Boolean).length

  return { completed, markComplete, isLocked, highestCompleted, completedCount }
}
