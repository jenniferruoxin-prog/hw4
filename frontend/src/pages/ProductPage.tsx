import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { colorFamilyOf, formatPrice, getProduct, swatchStyle, type ProductDetail } from '../api'
import { openAssistant } from '../chatShortcuts'

const LOW_STOCK = 3

export default function ProductPage() {
  const { productId = '' } = useParams()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')

  useEffect(() => {
    setProduct(null)
    setError('')
    setSelected('')
    getProduct(productId)
      .then(setProduct)
      .catch((e: Error) =>
        setError(e.message === 'Not found' ? 'We could not find that product.' : 'Could not load this product.'),
      )
  }, [productId])

  if (error) {
    return (
      <section className="section">
        <p className="error">{error}</p>
        <Link to="/products" className="text-link">
          ← Back to products
        </Link>
      </section>
    )
  }
  if (!product) return <section className="section muted">Loading…</section>

  const chosen = product.sizes.find((s) => s.size === selected)

  return (
    <section className="section">
      <Link to="/products" className="text-link back">
        ← All products
      </Link>
      <div className="detail">
        <div className="detail-image">
          <img src={product.image_url} alt={product.name} />
        </div>

        <div className="detail-info">
          <p className="eyebrow">{product.garment_type}</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{formatPrice(product.price)}</p>
          <button className="btn ask-item" onClick={() => openAssistant()}>
            💬 Ask about this item
          </button>
          <p>{product.description}</p>

          <h3>Colors on this item</h3>
          {product.colors.length > 0 ? (
            <div className="swatches">
              {/* One colorway per product: the garment color first, then the print/logo colors. */}
              {(() => {
                const [garment, ...details] = product.colors
                const family = colorFamilyOf(product.colors)
                const swatch = (
                  <>
                    <span className="swatch garment" style={swatchStyle(garment)}>
                      <span className="check" aria-hidden="true">✓</span>
                    </span>
                    <span className="swatch-label">
                      <strong>{garment}</strong>
                      <small>{family ? `Shop more ${family.toLowerCase()} →` : 'Garment color'}</small>
                    </span>
                  </>
                )
                return (
                  <>
                    {family ? (
                      <Link to={`/products?color=${encodeURIComponent(family)}`} className="swatch-main" title={`See all ${family} items`}>
                        {swatch}
                      </Link>
                    ) : (
                      <span className="swatch-main">{swatch}</span>
                    )}
                    {details.length > 0 && (
                      <span className="swatch-details">
                        <small>Print &amp; logo:</small>
                        {details.map((c) => (
                          <span key={c} className="swatch small" style={swatchStyle(c)} title={c} />
                        ))}
                        <small>{details.join(', ')}</small>
                      </span>
                    )}
                  </>
                )
              })()}
            </div>
          ) : (
            <p className="muted small">Color details not listed for this item.</p>
          )}

          <h3>Size &amp; stock</h3>
          <div className="sizes">
            {product.sizes.map((s) => (
              <button
                key={s.size}
                className={`size${s.size === selected ? ' active' : ''}`}
                disabled={s.quantity === 0}
                onClick={() => setSelected(s.size)}
                title={s.quantity === 0 ? 'Sold out' : `${s.quantity} in stock`}
              >
                <strong>{s.size}</strong>
                <small>{s.quantity === 0 ? 'Sold out' : `${s.quantity} left`}</small>
              </button>
            ))}
          </div>
          <p className="stock-note">
            {chosen
              ? chosen.quantity <= LOW_STOCK
                ? `Only ${chosen.quantity} left in ${chosen.size}. Grab it soon!`
                : `${chosen.quantity} in stock in ${chosen.size}.`
              : 'Select a size to check availability.'}
          </p>

          <h3>Tags</h3>
          <div className="tags">
            {product.search_tags.map((t) => (
              <span key={t} className="tag subtle">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
