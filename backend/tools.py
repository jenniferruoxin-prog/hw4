"""Tools the Campus Customs agent can call, plus the product queries they share with the API.

Every tool reads the local SQLite database through a read-only connection, so
the agent can look up products, prices and stock but can never change them.
"""

import json
import re
import sqlite3
from contextlib import closing
from typing import Literal

from pydantic_ai import RunContext

from db import connect
from models import (
    CustomerContext,
    NotFound,
    PageContext,
    PageInfo,
    PriceInfo,
    ProductCard,
    ProductDescription,
    ProductDetail,
    ProductSummary,
    SearchResults,
    ShopDeps,
    SizeAvailability,
    SizeStock,
    StockReport,
    ViewedProduct,
)

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]
LOW_STOCK_MAX = 3  # 1-3 units left counts as "low_stock"

# How shoppers write sizes -> the size codes in the inventory table.
SIZE_ALIASES = {
    "xs": "XS", "extra small": "XS", "x small": "XS", "xsmall": "XS",
    "s": "S", "small": "S", "sm": "S",
    "m": "M", "medium": "M", "med": "M",
    "l": "L", "large": "L", "lg": "L",
    "xl": "XL", "extra large": "XL", "x large": "XL", "xlarge": "XL",
    "xxl": "XXL", "2xl": "XXL", "xx large": "XXL", "xxlarge": "XXL", "double xl": "XXL",
}

PRODUCT_QUERY = """
    SELECT c.*, COALESCE(SUM(i.quantity), 0) AS total_stock
    FROM catalogue c
    LEFT JOIN inventory i ON i.product_id = c.product_id
"""


# ---------- Shared product queries (API + tools) ----------

def _card(row: sqlite3.Row) -> ProductCard:
    return ProductCard(
        product_id=row["product_id"],
        name=row["name"],
        garment_type=row["garment_type"],
        description=row["description"],
        colors=json.loads(row["colors"]),
        search_tags=json.loads(row["search_tags"]),
        price=row["price"],
        # image_file_path is relative to data/, e.g. "products/x.jpg"
        image_url=f"/images/{row['image_file_path']}",
        total_stock=row["total_stock"],
    )


def _size_key(size: str) -> int:
    return SIZE_ORDER.index(size) if size in SIZE_ORDER else len(SIZE_ORDER)


def all_products() -> list[ProductCard]:
    with closing(connect()) as conn:
        rows = conn.execute(PRODUCT_QUERY + " GROUP BY c.product_id ORDER BY c.name").fetchall()
    stock = _stock_by_product()
    cards = [_card(r) for r in rows]
    for card in cards:
        card.in_stock_sizes = [s.size for s in stock.get(card.product_id, []) if s.quantity > 0]
    return cards


def product_detail(product_id: str) -> ProductDetail | None:
    with closing(connect()) as conn:
        row = conn.execute(
            PRODUCT_QUERY + " WHERE c.product_id = ? GROUP BY c.product_id", (product_id,)
        ).fetchone()
        if row is None:
            return None
        stock = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()
    sizes = sorted((SizeStock(size=s["size"], quantity=s["quantity"]) for s in stock), key=lambda s: _size_key(s.size))
    card = _card(row)
    card.in_stock_sizes = [s.size for s in sizes if s.quantity > 0]
    return ProductDetail(**card.model_dump(), sizes=sizes)


def product_cards(product_ids: list[str]) -> list[ProductCard]:
    """Cards for the given ids, in the same order, skipping ids that don't exist."""
    if not product_ids:
        return []
    by_id = {p.product_id: p for p in all_products()}
    seen: set[str] = set()
    cards = []
    for pid in product_ids:
        if pid in by_id and pid not in seen:
            seen.add(pid)
            cards.append(by_id[pid])
    return cards


def _stock_by_product() -> dict[str, list[SizeStock]]:
    with closing(connect()) as conn:
        rows = conn.execute("SELECT product_id, size, quantity FROM inventory").fetchall()
    stock: dict[str, list[SizeStock]] = {}
    for r in rows:
        stock.setdefault(r["product_id"], []).append(SizeStock(size=r["size"], quantity=r["quantity"]))
    for sizes in stock.values():
        sizes.sort(key=lambda s: _size_key(s.size))
    return stock


# ---------- Search helpers ----------

STOPWORDS = {
    "a", "an", "and", "any", "are", "can", "do", "does", "for", "have", "i", "im", "in", "is", "it",
    "looking", "me", "my", "of", "on", "or", "please", "show", "some", "something", "that", "the",
    "there", "this", "to", "want", "what", "which", "with", "you", "your", "got", "get", "need",
    "would", "like", "one", "ones", "items", "item", "stuff", "merch", "sell", "carry",
}

# Shopper words -> words used in the catalogue (after normalizing, e.g. "t-shirt" -> "tshirt").
SYNONYMS = {
    "hoodie": ["hoodie", "hooded", "hood"],
    "hoody": ["hoodie", "hooded", "hood"],
    "tee": ["tee", "tshirt"],
    "tshirt": ["tshirt", "tee"],
    "shirt": ["shirt", "tee"],
    "sweatshirt": ["sweatshirt", "crewneck", "hoodie", "hooded"],
    "sweater": ["sweater", "sweatshirt", "crewneck"],
    "crew": ["crewneck", "crew"],
    "jacket": ["jacket", "fleece", "bomber"],
    "zip": ["zip"],
    "quarterzip": ["quarterzip", "14 zip", "1 4 zip"],
    "grey": ["gray", "grey"],
    "gray": ["gray", "grey"],
}


def _norm(text: str) -> str:
    text = text.lower().replace("-", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _tokens(query: str) -> list[str]:
    words = []
    for w in _norm(query).split():
        if w in STOPWORDS:
            continue
        if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]  # hoodies -> hoodie, tees -> tee
        words.append(w)
    return words


def _score(card: ProductCard, words: list[str]) -> int:
    fields = [
        (_norm(card.name), 3),
        (_norm(card.garment_type), 3),
        (_norm(" ".join(card.search_tags)), 2),
        (_norm(" ".join(card.colors)), 2),
        (_norm(card.description), 1),
    ]
    score = 0
    for w in words:
        variants = SYNONYMS.get(w, [w])
        best = max((weight for text, weight in fields if any(v in text for v in variants)), default=0)
        score += best
    return score


# ---------- Agent tools ----------

def _sizes_text(sizes: list[SizeStock]) -> str:
    in_stock = [s.size for s in sizes if s.quantity > 0]
    if not in_stock:
        return "none"
    return "all" if len(in_stock) == len(SIZE_ORDER) else ",".join(in_stock)


def search_products(
    query: str = "",
    color: str | None = None,
    max_price: float | None = None,
    size: str | None = None,
    sort: Literal["relevance", "price_low", "price_high"] = "relevance",
    limit: int = 8,
) -> SearchResults:
    """Search the Campus Customs catalogue. Use this to find products (and their product_id) before recommending or naming any.

    Its prices and size lists are fine for comparing several items. For a question about one specific item, confirm with
    get_price / get_stock.

    Args:
        query: Shopper's words, e.g. "navy hoodie", "Branford college", "baseball", "Harvard game tee".
            Leave empty to browse everything (combine with filters or sort).
        color: Only products that include this color, e.g. "navy", "gray", "white".
        max_price: Only products at or below this price in USD.
        size: Only products that currently have this size in stock (XS, S, M, L, XL, XXL).
        sort: "relevance" (default), "price_low" (cheapest first) or "price_high".
        limit: Max results, 1-30. Use 30 for "what X do you have?" so every match can be shown on the page.

    Returns:
        count (how many matched; quote it exactly) and results with price, colors and in-stock sizes ('all' = XS-XXL).
        count 0 means nothing matched.
    """
    words = _tokens(query)
    limit = max(1, min(limit, 30))
    size = size.strip().upper() if size else None
    color_variants = SYNONYMS.get(_norm(color), [_norm(color)]) if color else None
    stock = _stock_by_product()

    scored: list[tuple[int, ProductCard]] = []
    for card in all_products():
        if max_price is not None and card.price > max_price:
            continue
        if color_variants and not any(v in _norm(" ".join(card.colors)) for v in color_variants):
            continue
        sizes = stock.get(card.product_id, [])
        if size and not any(s.size == size and s.quantity > 0 for s in sizes):
            continue
        score = _score(card, words) if words else 1
        if score > 0:
            scored.append((score, card))

    if sort == "price_low":
        scored.sort(key=lambda sc: (sc[1].price, -sc[0], sc[1].name))
    elif sort == "price_high":
        scored.sort(key=lambda sc: (-sc[1].price, -sc[0], sc[1].name))
    else:
        scored.sort(key=lambda sc: (-sc[0], sc[1].name))

    results = []
    for _, card in scored[:limit]:
        sizes = stock.get(card.product_id, [])
        results.append(
            ProductSummary(
                product_id=card.product_id,
                name=card.name,
                price=card.price,
                colors="/".join(card.colors),
                sizes=_sizes_text(sizes),
            )
        )
    return SearchResults(count=len(results), results=results)


# Lookup tools (Problem 6). Each takes a product_id or the product's exact name
# and returns a typed result, or NotFound. They never guess a close match.

def _resolve(product: str) -> ProductDetail | NotFound:
    """Finds one product by exact product_id or exact name (case-insensitive)."""
    key = product.strip()
    detail = product_detail(key) or product_detail(key.lower())
    if detail:
        return detail
    wanted = _norm(key)
    for card in all_products():
        if _norm(card.name) == wanted:
            return product_detail(card.product_id)  # type: ignore[return-value]
    suggestions = [p.product_id for p in search_products(key, limit=3).results]
    return NotFound(
        error=f"No product with id or exact name '{product}'. Use one of the suggestions or search_products; do not guess.",
        suggestions=suggestions,
    )


def _normalize_size(size: str) -> str | None:
    key = re.sub(r"[^a-z0-9 ]+", " ", size.lower()).strip()
    key = " ".join(key.split())
    return SIZE_ALIASES.get(key) or (size.strip().upper() if size.strip().upper() in SIZE_ORDER else None)


def _status(quantity: int) -> str:
    if quantity == 0:
        return "sold_out"
    return "low_stock" if quantity <= LOW_STOCK_MAX else "in_stock"


def get_product_description(product: str) -> ProductDescription | NotFound:
    """Get the catalogue description, garment type and colors of one product.

    Use this when the shopper asks what an item looks like, what is on it, or what colors it comes in.

    Args:
        product: The product_id from search_products (e.g. "boola-boola-t-shirt") or the exact product name.
    """
    found = _resolve(product)
    if isinstance(found, NotFound):
        return found
    return ProductDescription(
        product_id=found.product_id,
        name=found.name,
        garment_type=found.garment_type,
        description=found.description,
        colors=found.colors,
    )


def get_price(product: str) -> PriceInfo | NotFound:
    """Get the exact current price of one product from the catalogue. Call this for every price question.

    Args:
        product: The product_id from search_products or the exact product name.
    """
    found = _resolve(product)
    if isinstance(found, NotFound):
        return found
    return PriceInfo(
        product_id=found.product_id,
        name=found.name,
        price=found.price,
        price_display=f"${found.price:,.2f}",
    )


def get_stock(product: str, size: str | None = None) -> StockReport | NotFound:
    """Get how many units of one product are in stock, for one size or for every size.

    Call this for every stock, availability or "do you have it in my size" question.

    Args:
        product: The product_id from search_products or the exact product name.
        size: The size the shopper asked about (XS, S, M, L, XL, XXL; words like "medium" or "extra large" work too).
            Leave empty to get every size.
    """
    found = _resolve(product)
    if isinstance(found, NotFound):
        return found

    sizes = [SizeAvailability(size=s.size, quantity=s.quantity, status=_status(s.quantity)) for s in found.sizes]
    in_stock = [s.size for s in sizes if s.quantity > 0]
    sold_out = [s.size for s in sizes if s.quantity == 0]
    in_stock_text = ", ".join(in_stock) if in_stock else "none"

    requested = None
    if size and size.strip():
        requested = _normalize_size(size)
        match = next((s for s in sizes if s.size == requested), None)
        if match is None:
            return NotFound(
                error=f"{found.name} does not come in size '{size}'. It comes in: {', '.join(s.size for s in sizes)}."
            )
        sizes = [match]
        if match.status == "sold_out":
            summary = f"Sold out in {match.size}. In stock: {in_stock_text}."
        elif match.status == "low_stock":
            summary = f"Only {match.quantity} left in {match.size}."
        else:
            summary = f"{match.quantity} in stock in {match.size}."
    else:
        summary = f"In stock: {in_stock_text}." + (f" Sold out: {', '.join(sold_out)}." if sold_out else "")

    return StockReport(
        product_id=found.product_id,
        name=found.name,
        size_requested=requested,
        sizes=sizes,
        total_in_stock=found.total_stock,
        in_stock_sizes=in_stock,
        sold_out_sizes=sold_out,
        summary=summary,
    )


# ---------- Context: who is chatting and what page they're on (Problem 8) ----------

PAGE_TYPES = {"": "home", "products": "products", "about": "about", "login": "login", "signup": "signup"}


def build_page_context(info: PageInfo | None) -> PageContext | None:
    """Turns the page info the website sent (untrusted) into a checked PageContext.

    The product is looked up in the catalogue, so only a real product can become "this item".
    """
    if info is None:
        return None
    path = info.path if info.path.startswith("/") else "/"
    parts = [p for p in path.split("/") if p]
    product = None
    page_type = PAGE_TYPES.get(parts[0] if parts else "", "other")
    product_id = info.product_id or (parts[1] if len(parts) == 2 and parts[0] == "products" else None)
    if product_id:
        detail = product_detail(product_id)
        if detail:
            page_type = "product_detail"
            product = ViewedProduct(
                product_id=detail.product_id, name=detail.name, garment_type=detail.garment_type, colors=detail.colors
            )
    return PageContext(
        path=path,
        page_type=page_type,
        product=product,
        category=(info.category or None) if page_type == "products" else None,
        search=(info.search or None) if page_type == "products" else None,
    )


def get_current_customer(ctx: RunContext[ShopDeps]) -> CustomerContext | str:
    """Get the logged-in customer's account details: first and last name, email and member-since date.

    Use this when the shopper asks about their own account ("what email is my account under?", "do you know who I am?").
    Returns a message if the shopper is a guest.
    """
    if ctx.deps.customer is None:
        return "The shopper is a guest (not logged in), so no account details are available."
    return ctx.deps.customer


def get_current_page(ctx: RunContext[ShopDeps]) -> PageContext | str:
    """Get the page the shopper is looking at right now, including the product on a single-item page.

    Use this to find out what "this", "it" or "this one" refers to.
    """
    if ctx.deps.page is None:
        return "The current page is unknown."
    return ctx.deps.page


AGENT_TOOLS = [
    search_products,
    get_product_description,
    get_price,
    get_stock,
    get_current_customer,
    get_current_page,
]
