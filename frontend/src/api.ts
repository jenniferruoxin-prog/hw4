// Typed client for the Campus Customs FastAPI backend.
// Vite proxies /api and /images to http://127.0.0.1:8000 during development.

export interface Product {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  search_tags: string[]
  price: number
  image_url: string
  total_stock: number
  in_stock_sizes: string[]
}

export interface SizeStock {
  size: string
  quantity: number
}

export interface ProductDetail extends Product {
  sizes: SizeStock[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  products?: Product[]
  resultsTitle?: string | null
}

/** POST /api/chat response. Mirrors ChatResponse in backend/models.py. */
export interface ChatResponse {
  reply: string
  products: Product[] // full cards rebuilt from the database by the backend
  results_title: string | null // heading for the cards on the page, e.g. "Hoodies"
}

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  name: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin', // sends the HttpOnly session cookie
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : null
    throw new ApiError(res.status, detail ?? (res.status === 404 ? 'Not found' : `Request failed (${res.status})`))
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const getMe = () => request<User>('/api/auth/me')

export const login = (email: string, password: string) =>
  post<User>('/api/auth/login', { email, password })

export const signup = (data: { first_name: string; last_name: string; email: string; password: string }) =>
  post<User>('/api/auth/signup', data)

export const logout = () => post<{ ok: boolean }>('/api/auth/logout', {})

export const getProducts = () => request<Product[]>('/api/products')

export const getProduct = (id: string) =>
  request<ProductDetail>(`/api/products/${encodeURIComponent(id)}`)

/** Which page the shopper is on, sent with each chat message. Mirrors PageInfo in backend/models.py. */
export interface PageInfo {
  path: string
  product_id: string | null
  category: string | null
  search: string | null
}

/** A saved message from GET /api/chat/history. Mirrors StoredChatMessage in backend/models.py. */
export interface StoredChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  products: Product[]
  results_title: string | null
  created_at: string
}

// history is only used by the server for guests; logged-in history is loaded from the database.
export const sendChat = (message: string, history: ChatMessage[], page: PageInfo) =>
  request<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history.map(({ role, content }) => ({ role, content })),
      page,
    }),
  })

export const getChatHistory = () => request<StoredChatMessage[]>('/api/chat/history')

export const clearChatHistory = () =>
  request<{ deleted: number }>('/api/chat/history', { method: 'DELETE' })

export const formatPrice = (price: number) =>
  price.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** First sentence of a description, for compact product cards. */
export function shortDescription(text: string, max = 110): string {
  const first = text.split(/(?<=\.)\s/)[0]
  return first.length <= max ? first : `${first.slice(0, max).trimEnd()}…`
}

/** Groups the free-text garment_type values into shopper-friendly categories. */
export function categoryOf(garmentType: string): string {
  const g = garmentType.toLowerCase()
  if (g.includes('quarter-zip')) return 'Quarter-Zips'
  if (g.includes('jacket')) return 'Jackets & Fleece'
  if (g.includes('hood')) return 'Hoodies'
  if (g.includes('crew') && !g.includes('t-shirt')) return 'Crewnecks'
  if (g.includes('mockneck')) return 'Crewnecks'
  if (g.includes('t-shirt') || g.includes('shirt')) return 'T-Shirts & Tees'
  return 'Other'
}

export const CATEGORIES = ['Hoodies', 'Crewnecks', 'Quarter-Zips', 'T-Shirts & Tees', 'Jackets & Fleece']

// ---------- Products page sort & filters (Problem 9) ----------

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export const SORTS = [
  { value: 'featured', label: 'Featured (A–Z)' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'name_desc', label: 'Name: Z–A' },
]

export const PRICE_RANGES = [
  { value: 'any', label: 'Any price', min: 0, max: Infinity },
  { value: 'under40', label: 'Under $40', min: 0, max: 40 },
  { value: '40to60', label: '$40 – $60', min: 40, max: 60.01 },
  { value: '60to80', label: '$60 – $80', min: 60.01, max: 80.01 },
  { value: '80plus', label: 'Over $80', min: 80.01, max: Infinity },
]

export const COLOR_FAMILIES = ['Navy', 'Gray', 'Cream & White', 'Pink & Coral']

/** Main garment color (the first entry in colors) grouped into a filter family. */
export function colorFamilyOf(colors: string[]): string | null {
  const c = (colors[0] ?? '').toLowerCase()
  if (c.includes('navy')) return 'Navy'
  if (c.includes('gray') || c.includes('grey') || c.includes('charcoal')) return 'Gray'
  if (c.includes('cream') || c.includes('ivory') || c.includes('white')) return 'Cream & White'
  if (c.includes('coral') || c.includes('pink')) return 'Pink & Coral'
  return null
}

// ---------- Design helpers (Problem 10) ----------

const COLOR_HEX: [string, string][] = [
  ['navy', '#1b2a4a'],
  ['royal blue', '#2554c7'],
  ['light blue', '#8db8e8'],
  ['blue', '#2f6fbf'],
  ['dark heather charcoal', '#3d3f44'],
  ['heather charcoal', '#4a4c52'],
  ['charcoal', '#45474d'],
  ['dark heather gray', '#6b6e74'],
  ['light gray', '#d3d5d8'],
  ['heather gray', '#a8abb0'],
  ['gray', '#9a9da3'],
  ['black', '#111111'],
  ['white', '#ffffff'],
  ['ivory', '#fbf6e9'],
  ['cream', '#f3ead6'],
  ['dusty coral', '#e0897d'],
  ['red', '#c8102e'],
  ['green', '#2e7d4f'],
  ['yellow', '#f2c230'],
  ['gold', '#c9a227'],
]

/** Swatch color for a catalogue color name ("heather gray" → hex). "multicolor" gets a gradient. */
export function swatchStyle(name: string): { background: string } {
  const n = name.toLowerCase()
  if (n.includes('multi')) return { background: 'conic-gradient(#c8102e, #f2c230, #2e7d4f, #2f6fbf, #c8102e)' }
  const hit = COLOR_HEX.find(([key]) => n.includes(key))
  return { background: hit ? hit[1] : '#9a9da3' }
}

/** Honest, data-driven badge for a product card (from live inventory). */
export function stockBadge(p: Product): { label: string; tone: 'good' | 'warn' | 'bad' } | null {
  if (p.total_stock === 0 || p.in_stock_sizes.length === 0) return { label: 'Sold out', tone: 'bad' }
  if (p.total_stock <= 15) return { label: 'Low stock', tone: 'warn' }
  if (p.in_stock_sizes.length <= 3) return { label: 'Few sizes left', tone: 'warn' }
  if (p.in_stock_sizes.length === SIZES.length) return { label: 'Every size in stock', tone: 'good' }
  return null
}
