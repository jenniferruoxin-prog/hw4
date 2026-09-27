import { useEffect, useRef, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import ProductCard from './ProductCard'
import { useChatResults } from '../chatResults'

const PREVIEW_COUNT = 8

/**
 * "From your chat" section: the products the agent matched, as the same ProductCards used on
 * the Products page, so clicking one opens the single-item page (/products/:id).
 * On a single-item page it starts collapsed, so the large image and details stay in view.
 */
export default function ChatResults() {
  const { results, clear } = useChatResults()
  const { pathname } = useLocation()
  const detailMatch = matchPath('/products/:productId', pathname)
  const onDetailPage = Boolean(detailMatch)
  const [expanded, setExpanded] = useState(!onDetailPage)
  const [showAll, setShowAll] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  // Results restored from sessionStorage on load count as already seen (no scroll).
  const lastId = useRef<number | null>(results?.id ?? null)

  // Collapse when opening a product page, expand again on other pages.
  useEffect(() => {
    setExpanded(!onDetailPage)
  }, [onDetailPage, pathname])

  // New results from the chat: show them and bring them into view.
  useEffect(() => {
    if (!results || results.id === lastId.current) return
    lastId.current = results.id
    setShowAll(false)
    const onlyThisProduct =
      results.products.length === 1 && results.products[0].product_id === detailMatch?.params.productId
    if (onlyThisProduct) return // the shopper is already looking at it
    setExpanded(true)
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [results, detailMatch?.params.productId])

  if (!results || results.products.length === 0) return null

  const { title, products } = results
  const visible = showAll ? products : products.slice(0, PREVIEW_COUNT)
  const count = `${products.length} ${products.length === 1 ? 'item' : 'items'}`

  return (
    <section ref={sectionRef} className={`chat-results${expanded ? '' : ' collapsed'}`} aria-label="Products from your chat">
      <div className="chat-results-inner" key={results.id}>
        <div className="chat-results-head">
          <div>
            <p className="eyebrow">💬 From your chat</p>
            <h2>
              {title} <span className="muted">· {count}</span>
            </h2>
          </div>
          <div className="chat-results-actions">
            <button className="chip" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
              {expanded ? 'Hide' : 'Show'}
            </button>
            <button className="chip" onClick={clear} aria-label="Clear chat results">
              Clear
            </button>
          </div>
        </div>

        {expanded && (
          <>
            <div className="product-grid">
              {visible.map((p, i) => (
                <ProductCard key={p.product_id} product={p} index={i} />
              ))}
            </div>
            {products.length > PREVIEW_COUNT && (
              <button className="text-link show-all" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show fewer' : `Show all ${products.length} →`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
