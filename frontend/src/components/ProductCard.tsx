import { Link } from 'react-router-dom'
import { SIZES, formatPrice, shortDescription, stockBadge, swatchStyle, type Product } from '../api'

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const badge = stockBadge(product)
  return (
    <Link
      to={`/products/${product.product_id}`}
      className="product-card"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="product-card-image">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        {badge && <span className={`badge ${badge.tone}`}>{badge.label}</span>}
        <span className="card-cta">View details →</span>
      </div>
      <div className="product-card-body">
        <div className="card-top">
          <h3>{product.name}</h3>
          <p className="price">{formatPrice(product.price)}</p>
        </div>
        {product.colors.length > 0 && (
          <div className="swatch-row" aria-label={`Colors: ${product.colors.join(', ')}`}>
            {product.colors.slice(0, 5).map((c) => (
              <span key={c} className="swatch-dot" style={swatchStyle(c)} title={c} />
            ))}
          </div>
        )}
        <p className="muted">{shortDescription(product.description)}</p>
        <div className="size-pills" aria-label={`In stock: ${product.in_stock_sizes.join(', ') || 'none'}`}>
          {SIZES.map((s) => (
            <span key={s} className={product.in_stock_sizes.includes(s) ? 'pill' : 'pill out'}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
