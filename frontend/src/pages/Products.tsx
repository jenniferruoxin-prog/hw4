import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import {
  CATEGORIES,
  COLOR_FAMILIES,
  PRICE_RANGES,
  SIZES,
  SORTS,
  categoryOf,
  colorFamilyOf,
  getProducts,
  type Product,
} from '../api'

// Problem 9: sort + price / color / size-in-stock filters. All state lives in the URL
// (?q=&category=&sort=&price=&color=&size=), so filtered views can be shared or bookmarked.
const FILTER_KEYS = ['q', 'category', 'sort', 'price', 'color', 'size']

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? 'All'
  const query = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'featured'
  const price = params.get('price') ?? 'any'
  const color = params.get('color') ?? 'any'
  const size = params.get('size') ?? 'any'

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setError('Could not load products. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const range = PRICE_RANGES.find((r) => r.value === price)
    const list = products.filter((p) => {
      if (category !== 'All' && categoryOf(p.garment_type) !== category) return false
      if (range && range.value !== 'any' && !(p.price >= range.min && p.price < range.max)) return false
      if (color !== 'any' && colorFamilyOf(p.colors) !== color) return false
      if (size !== 'any' && !p.in_stock_sizes.includes(size)) return false
      if (!q) return true
      const haystack = [p.name, p.garment_type, p.description, ...p.colors, ...p.search_tags]
        .join(' ')
        .toLowerCase()
      return q.split(/\s+/).every((word) => haystack.includes(word))
    })
    const byName = (a: Product, b: Product) => a.name.localeCompare(b.name)
    if (sort === 'price_low') list.sort((a, b) => a.price - b.price || byName(a, b))
    else if (sort === 'price_high') list.sort((a, b) => b.price - a.price || byName(a, b))
    else if (sort === 'name_desc') list.sort((a, b) => byName(b, a))
    else list.sort(byName)
    return list
  }, [products, category, query, sort, price, color, size])

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    const isDefault = !value || value === 'All' || value === 'any' || (key === 'sort' && value === 'featured')
    if (isDefault) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const activeFilters = FILTER_KEYS.filter((k) => k !== 'sort' && params.has(k)).length

  function clearFilters() {
    const next = new URLSearchParams(params)
    FILTER_KEYS.forEach((k) => k !== 'sort' && next.delete(k))
    setParams(next, { replace: true })
  }

  return (
    <section className="section">
      <div className="page-head">
        <h1>Shop Yale merch</h1>
        <p className="muted">Hoodies, crewnecks, quarter-zips and tees for every Bulldog.</p>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search by name, color, college, sport…"
          value={query}
          onChange={(e) => update('q', e.target.value)}
        />
        <div className="chips">
          {['All', ...CATEGORIES].map((c) => (
            <button
              key={c}
              className={`chip${c === category ? ' active' : ''}`}
              onClick={() => update('category', c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="toolbar" role="group" aria-label="Sort and filter">
          <label>
            Sort
            <select value={sort} onChange={(e) => update('sort', e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Price
            <select value={price} onChange={(e) => update('price', e.target.value)}>
              {PRICE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Color
            <select value={color} onChange={(e) => update('color', e.target.value)}>
              <option value="any">Any color</option>
              {COLOR_FAMILIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Size in stock
            <select value={size} onChange={(e) => update('size', e.target.value)}>
              <option value="any">Any size</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {activeFilters > 0 && (
            <button className="text-link clear-filters" onClick={clearFilters}>
              Clear filters ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {loading && <p className="muted">Loading products…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <>
          <p className="muted count">
            {visible.length} {visible.length === 1 ? 'product' : 'products'}
            {size !== 'any' && ` in stock in ${size}`}
          </p>
          <div className="product-grid">
            {visible.map((p, i) => (
              <ProductCard key={p.product_id} product={p} index={i} />
            ))}
          </div>
          {visible.length === 0 && (
            <p className="muted">
              No products match these filters.{' '}
              {activeFilters > 0 && (
                <button className="text-link clear-filters" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </p>
          )}
        </>
      )}
    </section>
  )
}
