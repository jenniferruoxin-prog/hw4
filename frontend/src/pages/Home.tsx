import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Bulldog from '../components/Bulldog'
import ProductCard from '../components/ProductCard'
import { CATEGORIES, categoryOf, formatPrice, getProducts, type Product } from '../api'
import { openAssistant } from '../chatShortcuts'

const FEATURED_IDS = [
  '2025-yale-vs-harvard-t-shirt',
  'basic-hoodie-big-yale',
  'boola-boola-t-shirt',
  'champion-reverse-weave-crewneck',
]

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setProducts([]))
  }, [])

  const featured = FEATURED_IDS.map((id) => products.find((p) => p.product_id === id)).filter(
    (p): p is Product => Boolean(p),
  )
  const shown = featured.length >= 4 ? featured : products.slice(0, 4)

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <p className="eyebrow">Officially licensed · 57 Broadway, New Haven</p>
            <h1>
              Wear your Bulldog pride,
              <br />
              <em>from Old Campus to The Game.</em>
            </h1>
            <p className="hero-copy">
              Hoodies for late nights at Sterling, crewnecks for crisp walks down Hillhouse, and tees for every
              tailgate. Real Yale gear, real prices, and real stock you can check in seconds.
            </p>
            <div className="hero-actions">
              <Link to="/products" className="btn primary">
                Shop the collection
              </Link>
              <button className="btn ghost" onClick={() => openAssistant()}>
                <Bulldog size={26} collar={false} title="" /> Ask Handsome Dan
              </button>
            </div>
            <ul className="hero-points">
              <li>{products.length || 100}+ styles</li>
              <li>Live size &amp; stock</li>
              <li>College, team &amp; family gear</li>
            </ul>
          </div>

          <div className="hero-collage" aria-hidden="true">
            {shown.slice(0, 3).map((p, i) => (
              <Link key={p.product_id} to={`/products/${p.product_id}`} className={`polaroid polaroid-${i}`} tabIndex={-1}>
                <img src={p.image_url} alt="" />
                <span>
                  {p.name} <strong>{formatPrice(p.price)}</strong>
                </span>
              </Link>
            ))}
            <div className="hero-dan">
              <p className="speech">Need a size? Ask me — I check the stockroom live!</p>
              <Bulldog size={132} />
            </div>
          </div>
        </div>
        <div className="pennant-stripe" />
      </section>

      <section className="section">
        <p className="eyebrow center">Find your fit</p>
        <h2 className="section-title">Shop by style</h2>
        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <Link key={c} to={`/products?category=${encodeURIComponent(c)}`} className="category-tile">
              <span>{c}</span>
              <small>{products.filter((p) => categoryOf(p.garment_type) === c).length} styles</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Handpicked</p>
            <h2 className="section-title">Fan favorites</h2>
          </div>
          <Link to="/products" className="text-link">
            View all →
          </Link>
        </div>
        <div className="product-grid">
          {shown.map((p, i) => (
            <ProductCard key={p.product_id} product={p} index={i} />
          ))}
        </div>
      </section>

      <section className="section promo">
        <Bulldog size={88} />
        <div>
          <h2>Something for every Eli</h2>
          <p>
            Students, alumni, proud parents and future Bulldogs: find your residential college, your team, or a
            classic Yale wordmark. Not sure where to start? Handsome Dan, our bulldog guide in the corner, can
            sniff out your size.
          </p>
        </div>
        <Link to="/signup" className="btn primary">
          Create an account
        </Link>
      </section>
    </>
  )
}
