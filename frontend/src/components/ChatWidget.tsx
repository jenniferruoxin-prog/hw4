import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { clearChatHistory, getChatHistory, sendChat, type ChatMessage, type PageInfo } from '../api'
import { useAuth } from '../auth'
import { useChatResults } from '../chatResults'
import { onOpenAssistant, suggestionsFor } from '../chatShortcuts'
import Bulldog from './Bulldog'

function greeting(firstName?: string): ChatMessage {
  return {
    role: 'assistant',
    content: firstName
      ? `Woof, welcome back ${firstName}! It's Handsome Dan. Want me to check a size, a price or find a gift?`
      : "Woof! I'm Handsome Dan, your Campus Customs shopping guide. Ask me about sizes, prices, stock or gift ideas.",
  }
}

/** Page context sent with each message, so the agent knows what "this" means on a product page. */
function usePageInfo(): PageInfo {
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)
  const detail = matchPath('/products/:productId', pathname)
  return {
    path: pathname,
    product_id: detail?.params.productId ?? null,
    category: pathname === '/products' ? params.get('category') : null,
    search: pathname === '/products' ? params.get('q') : null,
  }
}

export default function ChatWidget() {
  const { user, loading: authLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([greeting()])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [historyNote, setHistoryNote] = useState('')
  // One-time "Ask Handsome Dan" tooltip next to the launcher (per browser tab).
  const [showHint, setShowHint] = useState(() => !sessionStorage.getItem('cc_dan_hint'))
  const chatResults = useChatResults()
  const page = usePageInfo()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Logged in: load the saved conversation from the server. Logged out / guest: start fresh.
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    if (!user) {
      setMessages([greeting()])
      setHistoryNote('')
      return
    }
    setMessages([greeting(user.first_name)])
    getChatHistory()
      .then((saved) => {
        if (cancelled) return
        setMessages([
          greeting(user.first_name),
          ...saved.map((m) => ({
            role: m.role,
            content: m.content,
            products: m.products,
            resultsTitle: m.results_title,
          })),
        ])
        setHistoryNote(saved.length ? `Loaded ${saved.length} saved messages` : '')
      })
      .catch(() => !cancelled && setHistoryNote("Couldn't load your saved chat"))
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  async function clearHistory() {
    if (!window.confirm('Delete your saved chat history? This cannot be undone.')) return
    await clearChatHistory().catch(() => undefined)
    setMessages([greeting(user?.first_name)])
    setHistoryNote('Chat history cleared')
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send(e?: FormEvent) {
    e?.preventDefault()
    await sendText(input)
  }

  async function sendText(raw: string) {
    const text = raw.trim()
    if (!text || thinking) return
    const history = messages
    setMessages([...history, { role: 'user', content: text }])
    setInput('')
    setThinking(true)
    try {
      const res = await sendChat(text, history, page)
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: res.reply, products: res.products, resultsTitle: res.results_title },
      ])
      // API contract: the agent's matches arrive as full product cards; put them on the page.
      if (res.products.length > 0) chatResults.show(res.results_title ?? 'Suggested for you', res.products)
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: "Sorry, I couldn't reach the Campus Customs server. Please try again." },
      ])
    } finally {
      setThinking(false)
    }
  }

  // "Ask about this item" and other shortcuts elsewhere on the site open the chat here.
  const sendRef = useRef(sendText)
  sendRef.current = sendText
  useEffect(
    () =>
      onOpenAssistant((question) => {
        setOpen(true)
        if (question) void sendRef.current(question)
      }),
    [],
  )

  const onProductPage = Boolean(page.product_id)
  const hasAskedSomething = messages.some((m) => m.role === 'user')
  const suggestions = !thinking && (onProductPage || !hasAskedSomething) ? suggestionsFor(onProductPage) : []

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a new line.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="chat">
      {open && (
        <section className="chat-panel" aria-label="Campus Customs chat">
          <header className="chat-header">
            <div className="chat-identity">
              <span className="chat-avatar">
                <Bulldog size={40} title="" />
              </span>
              <span className="chat-title">
                <strong>Handsome Dan</strong>
                <small>
                  <span className="online-dot" /> {user ? 'Your chat is saved' : 'Guest chat · log in to save'}
                </small>
              </span>
            </div>
            <div className="chat-header-actions">
              {user && messages.length > 1 && (
                <button className="chat-clear" onClick={clearHistory} title="Delete saved chat history">
                  Clear
                </button>
              )}
              <button className="chat-close" aria-label="Close chat" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </header>

          <div className="chat-messages">
            {historyNote && <p className="chat-note">{historyNote}</p>}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === 'assistant' && (
                  <span className="msg-avatar" aria-hidden="true">
                    <Bulldog size={26} collar={false} title="" />
                  </span>
                )}
                <div className="bubble">{m.content}</div>
                {m.products && m.products.length > 0 && (
                  <button
                    className="chat-results-link"
                    onClick={() => chatResults.show(m.resultsTitle ?? 'Suggested for you', m.products!)}
                    title="Show these products on the page"
                  >
                    <span className="chat-results-thumbs" aria-hidden="true">
                      {m.products.slice(0, 3).map((p) => (
                        <img key={p.product_id} src={p.image_url} alt="" />
                      ))}
                    </span>
                    <span>
                      <strong>{m.resultsTitle ?? 'Suggested for you'}</strong>
                      <small>
                        {m.products.length} {m.products.length === 1 ? 'item' : 'items'} · show on page ↑
                      </small>
                    </span>
                  </button>
                )}
              </div>
            ))}
            {thinking && (
              <div className="chat-msg assistant">
                <span className="msg-avatar" aria-hidden="true">
                  <Bulldog size={26} collar={false} title="" />
                </span>
                <div className="bubble thinking" aria-label="Handsome Dan is typing">
                  <span className="paws">
                    <span />
                    <span />
                    <span />
                  </span>
                  <small>Sniffing through the stockroom…</small>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {suggestions.length > 0 && (
            <div className="chat-suggestions" aria-label="Suggested questions">
              {suggestions.map((q) => (
                <button key={q} className="chat-suggestion" onClick={() => void sendText(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form className="chat-input" onSubmit={send}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              placeholder="Ask Dan about sizes, prices, gifts…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button type="submit" disabled={!input.trim() || thinking}>
              Send
            </button>
          </form>
        </section>
      )}

      {!open && showHint && (
        <button
          className="chat-hint"
          onClick={() => {
            setOpen(true)
            setShowHint(false)
            sessionStorage.setItem('cc_dan_hint', '1')
          }}
        >
          Need a size? <strong>Ask Handsome Dan</strong>
        </button>
      )}
      <button
        className={`chat-launcher${open ? ' open' : ''}`}
        aria-label={open ? 'Close chat' : 'Chat with Handsome Dan'}
        onClick={() => {
          setOpen((o) => !o)
          setShowHint(false)
          sessionStorage.setItem('cc_dan_hint', '1')
        }}
      >
        {open ? <span className="launcher-x">×</span> : <Bulldog size={50} title="" />}
      </button>
    </div>
  )
}
