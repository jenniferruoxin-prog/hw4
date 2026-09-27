"""Pydantic / PydanticAI structured types for the Campus Customs backend.

Used by the product API (main.py), the agent's tools (tools.py) and the agent's
structured output (agent.py). Prices and stock always come from the database,
never from the model.
"""

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field


# ---------- Products ----------

class SizeStock(BaseModel):
    size: str = Field(description="XS, S, M, L, XL or XXL")
    quantity: int = Field(ge=0, description="Units in stock; 0 means sold out in this size")


class ProductCard(BaseModel):
    """Compact product info for product grids and cards shown in the chat."""

    product_id: str
    name: str
    garment_type: str
    description: str
    colors: list[str]
    search_tags: list[str]
    price: float = Field(description="USD price from the catalogue table")
    image_url: str = Field(description="Browser URL of the product photo, e.g. /images/products/x.jpg")
    total_stock: int = Field(ge=0, description="Units in stock across all sizes")
    in_stock_sizes: list[str] = Field(default_factory=list, description="Sizes with stock now (for size filters)")


class ProductDetail(ProductCard):
    sizes: list[SizeStock]


class ProductSummary(BaseModel):
    """What search_products returns to the agent: enough to recommend, small enough to keep context short.

    Kept compact on purpose (Problem 9, cheaper runs): search can return up to 30 of these per call, and
    every field is re-sent to the model on each later request in the turn. Full details live in the
    lookup tools.
    """

    product_id: str
    name: str
    price: float
    colors: str = Field(description="Garment color first, then print/logo colors, e.g. 'navy blue/white'")
    sizes: str = Field(description="Sizes in stock now: 'all' (XS-XXL), a list like 'S,M,XL', or 'none'")


class SearchResults(BaseModel):
    """What search_products returns: the matches plus how many there are (Problem 11).

    The explicit count stops the model miscounting long lists (it once said "28 hoodies" for 27 cards).
    """

    count: int = Field(description="Number of products in results. Quote this exact number when saying how many you found")
    results: list[ProductSummary]


# ---------- Agent lookup results (Problem 6) ----------

StockStatus = Literal["in_stock", "low_stock", "sold_out"]


class ProductDescription(BaseModel):
    """get_product_description result: what the item looks like, from the catalogue table."""

    product_id: str
    name: str
    garment_type: str = Field(description="e.g. 'pullover hoodie', 'crewneck sweatshirt'")
    description: str = Field(description="Full catalogue description; quote or paraphrase, never embellish")
    colors: list[str] = Field(
        description="Every color visible on this one item (garment first, then print/logo colors). "
        "NOT a list of color options to choose from; each product comes in one colorway."
    )


class PriceInfo(BaseModel):
    """get_price result: the exact catalogue price."""

    product_id: str
    name: str
    price: float = Field(description="Price in USD from catalogue.price")
    currency: Literal["USD"] = "USD"
    price_display: str = Field(description="Ready-to-quote price, e.g. '$68.00'. Use this text as-is")


class SizeAvailability(BaseModel):
    """Stock for one size, from the inventory table."""

    size: str = Field(description="XS, S, M, L, XL or XXL")
    quantity: int = Field(ge=0, description="Exact units in stock right now")
    status: StockStatus = Field(description="sold_out if 0, low_stock if 1-3, otherwise in_stock")


class StockReport(BaseModel):
    """get_stock result: per-size inventory for one product."""

    product_id: str
    name: str
    size_requested: str | None = Field(description="The size the shopper asked about, or null for all sizes")
    sizes: list[SizeAvailability] = Field(description="Only the requested size, or every size in XS→XXL order")
    total_in_stock: int = Field(ge=0, description="Units across all sizes of this product")
    in_stock_sizes: list[str] = Field(description="Every size with quantity > 0 (always all sizes, to suggest alternatives)")
    sold_out_sizes: list[str] = Field(description="Every size with quantity 0")
    summary: str = Field(description="One-line plain-English answer, e.g. 'Sold out in L. In stock: XS, S, M, XL, XXL.'")


class NotFound(BaseModel):
    """Returned instead of a result when the product or size can't be found. Never guess in this case."""

    error: str
    suggestions: list[str] = Field(default_factory=list, description="product_id values of close matches, if any")


# ---------- Chat ----------

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class PageInfo(BaseModel):
    """What page the shopper is on, sent by the website with each chat message (untrusted input)."""

    path: str = Field(default="/", max_length=200, description="Current URL path, e.g. /products/boola-boola-t-shirt")
    product_id: str | None = Field(default=None, max_length=120, description="Set on a single-item page")
    category: str | None = Field(default=None, max_length=60, description="Products page category filter, if any")
    search: str | None = Field(default=None, max_length=100, description="Products page search box text, if any")


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    # Used for guests only. For logged-in shoppers the server loads history from the database.
    history: list[ChatTurn] = Field(default_factory=list, max_length=50)
    page: PageInfo | None = None


# ---------- Agent context (Problem 8) ----------

class CustomerContext(BaseModel):
    """The logged-in shopper, as the agent sees them. Never includes password_hash or session data."""

    user_id: int
    first_name: str
    last_name: str
    email: str
    member_since: str = Field(description="Account creation date, YYYY-MM-DD")


class ViewedProduct(BaseModel):
    """The product on the page the shopper is looking at, verified against the catalogue."""

    product_id: str
    name: str
    garment_type: str
    colors: list[str]


class PageContext(BaseModel):
    """Server-checked page context passed to the agent in its deps."""

    path: str
    page_type: Literal["home", "products", "product_detail", "about", "login", "signup", "other"]
    product: ViewedProduct | None = None
    category: str | None = None
    search: str | None = None


class StoredChatMessage(BaseModel):
    """One saved chat message, as returned by GET /api/chat/history."""

    id: int
    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)
    results_title: str | None = None
    created_at: str


MAX_PAGE_CARDS = 30  # most product cards one chat reply can put on the page


class ShopReply(BaseModel):
    """Structured output the agent must return for every chat turn (the agent side of the API contract)."""

    reply: str = Field(
        description="The message shown to the shopper, in the Campus Customs voice. Plain text, short paragraphs or '- ' bullets. "
        "When product_ids is not empty, the cards appear on the page, so do not list every item in the text."
    )
    show_search_results: bool = Field(
        default=False,
        description="True = show EVERY result of your most recent search_products call as product cards on the page, "
        "in search order. Use this for type/category questions ('what hoodies do you have?'). "
        "When true, leave product_ids empty.",
    )
    product_ids: list[str] = Field(
        default_factory=list,
        description=f"Hand-picked product_id values (from tool results in this turn only) to show as product cards, "
        f"best first, at most {MAX_PAGE_CARDS}. Use for recommendations or one specific item. "
        "Empty if show_search_results is true or the reply is not about specific products.",
    )
    results_title: str | None = Field(
        default=None,
        max_length=60,
        description="Short heading for the cards on the page, e.g. 'Hoodies', 'Navy crewnecks under $60', "
        "'Branford College gear'. Null when product_ids is empty.",
    )


class ChatResponse(BaseModel):
    """What POST /api/chat returns to the front end (the website side of the API contract).

    products are full ProductCards rebuilt from the database from the agent's product_ids, so
    every price, photo and description shown comes from campus_customs.db, not from the model.
    """

    reply: str
    products: list[ProductCard] = Field(default_factory=list, max_length=MAX_PAGE_CARDS)
    results_title: str | None = None


# ---------- Agent deps ----------

@dataclass
class ShopDeps:
    """Per-request context handed to the agent (PydanticAI deps).

    Built by main.py from the session cookie (customer) and the page the website says the
    shopper is on (page, checked against the catalogue). Tools read it via RunContext.
    """

    customer: CustomerContext | None = None  # None = guest
    page: PageContext | None = None
    price_guard_retries: int = 0  # how many replies the price guard sent back this turn (for the usage log)
