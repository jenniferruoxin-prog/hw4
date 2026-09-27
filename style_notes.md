# Campus Customs Style Notes (from yalebulldogblue.com)

Research notes to guide the React front end. Pulled from the public homepage on 2026-09-27.

## Brand and tone
- Store name: **Yale Bulldog Blue by Campus Customs**, tagline "Officially Licensed Merchandise".
- Tone: enthusiastic and professional, focused on school pride, e.g. "Casual comfort, classic Bulldog pride", "Back in Bulldog Blue 💙", "Tailgate Season 🏈".
- Address in footer: 57 Broadway, New Haven CT, 06511.
- Footer links: Terms of Service, Refund Policy, Privacy Policy, Contact Information.

## Navigation (top menu)
Clothing (Womens, Youth, Infant & Toddler) · Accessories · Home · Collections (Alumni, Class years) · Residential Colleges · Sports · Relatives (gifts by relationship) · Graduate & Professional Schools.

## Product cards
Image, product name, price, fabric/fit details (e.g. "50% Cotton, 50% Polyester", "Relaxed Fit"), "Choose options" / "Quick shop" button, sold-out label when out of stock.

## Visual theme (from site CSS)
| Role | Value |
|---|---|
| Primary / button (Yale navy blue) | `#00366b` |
| Button hover | `rgb(26, 74, 122)` |
| Text | `#1d1d1d` |
| Background | `#ffffff`, light panels `#f4f4f4` |
| Sale accent | `#f04f36` |
| Font | "Open Sans", sans-serif |

Project default style is black and blue. The plan is a black header/footer with Yale navy `#00366b` accents and white product areas, which is close to the real site.

## Local data (data/campus_customs.db)
- `catalogue` (102 rows): product_id, name, garment_type, description, colors (JSON), search_tags (JSON), image_file_path (relative to `data/`, e.g. `products/x.jpg`), price ($32–$98).
- `inventory` (612 rows): product_id, size (XS–XXL), quantity.
- `users` (3 rows): id, name, email, password_hash (`pbkdf2_...`), created_at, first_name, last_name. Test user: `test@campuscustoms.yale.edu`.
- `chat_messages` (22 rows): user_id, role, content, products_json, created_at. This table is also in the database.
- All 102 catalogue image paths match files in `data/products/`.
