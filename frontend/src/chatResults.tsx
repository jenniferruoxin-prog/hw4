import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Product } from './api'

// Products the chat agent matched, shown as cards on the page (see ChatResults.tsx).

export interface ChatResultSet {
  id: number // changes on every new result set, so the page can react (scroll, expand)
  title: string
  products: Product[]
}

interface ChatResultsState {
  results: ChatResultSet | null
  show: (title: string, products: Product[]) => void
  clear: () => void
}

const STORAGE_KEY = 'cc_chat_results'
const ChatResultsContext = createContext<ChatResultsState | null>(null)

function load(): ChatResultSet | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatResultSet) : null
  } catch {
    return null
  }
}

export function ChatResultsProvider({ children }: { children: ReactNode }) {
  // Kept in sessionStorage so results survive a page reload in the same tab.
  const [results, setResults] = useState<ChatResultSet | null>(load)

  const show = useCallback((title: string, products: Product[]) => {
    const next = { id: Date.now(), title, products }
    setResults(next)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const clear = useCallback(() => {
    setResults(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  return <ChatResultsContext.Provider value={{ results, show, clear }}>{children}</ChatResultsContext.Provider>
}

export function useChatResults(): ChatResultsState {
  const ctx = useContext(ChatResultsContext)
  if (!ctx) throw new Error('useChatResults must be used inside <ChatResultsProvider>')
  return ctx
}
