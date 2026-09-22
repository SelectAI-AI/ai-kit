import { useState, useCallback } from 'react'

const STORAGE_KEY = 'module-01-checklist'
const ITEM_COUNT = 4

type ChecklistItems = Record<string, boolean>

function loadFromStorage(): ChecklistItems {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: ChecklistItems = {}
    for (let i = 0; i < ITEM_COUNT; i++) {
      result[String(i)] = parsed[String(i)] === true
    }
    return result
  } catch {
    return {}
  }
}

function saveToStorage(items: ChecklistItems): void {
  const toSave: Record<string, boolean> = {}
  for (let i = 0; i < ITEM_COUNT; i++) {
    toSave[String(i)] = items[String(i)] === true
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}

export function useChecklist() {
  const [items, setItems] = useState<ChecklistItems>(() => loadFromStorage())

  const toggle = useCallback((index: number) => {
    setItems(prev => {
      const key = String(index)
      const updated = { ...prev, [key]: !prev[key] }
      saveToStorage(updated)
      return updated
    })
  }, [])

  const completedCount = Object.values(items).filter(Boolean).length

  return { items, toggle, completedCount }
}
