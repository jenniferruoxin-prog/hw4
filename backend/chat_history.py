"""Saved chat history for logged-in shoppers, in the chat_messages table.

One row per message:
    chat_messages(id, user_id → users.id, role 'user'|'assistant', content,
                  products_json, results_title, created_at)

products_json keeps a snapshot of the product cards shown with an assistant reply
(the same list-of-products format as the seed rows). When history is reloaded, the
cards are rebuilt from the catalogue by product_id, so prices and photos are current.
Guests' chats are never written here.
"""

import json
from contextlib import closing

from db import connect_rw
from models import ChatResponse, ChatTurn, StoredChatMessage
from tools import product_cards

MAX_CONTENT = 4000  # matches ChatTurn.content max_length


def ensure_schema() -> None:
    """Adds what Problem 8 needs to the seed chat_messages table, without touching existing rows."""
    with closing(connect_rw()) as conn:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(chat_messages)")}
        if "results_title" not in columns:
            conn.execute("ALTER TABLE chat_messages ADD COLUMN results_title TEXT")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages (user_id, id)")
        conn.commit()


def _product_ids(products_json: str | None) -> list[str]:
    if not products_json:
        return []
    try:
        items = json.loads(products_json)
    except json.JSONDecodeError:
        return []
    return [item["product_id"] for item in items if isinstance(item, dict) and "product_id" in item]


def load_messages(user_id: int, limit: int = 200) -> list[StoredChatMessage]:
    """The shopper's most recent messages, oldest first, with product cards rebuilt from the catalogue."""
    with closing(connect_rw()) as conn:
        rows = conn.execute(
            """
            SELECT id, role, content, products_json, results_title, created_at
            FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    messages = []
    for row in reversed(rows):
        cards = product_cards(_product_ids(row["products_json"]))
        messages.append(
            StoredChatMessage(
                id=row["id"],
                role=row["role"],
                content=row["content"],
                products=cards,
                results_title=row["results_title"] or ("Suggested for you" if cards else None),
                created_at=row["created_at"],
            )
        )
    return messages


def load_turns(user_id: int, limit: int) -> list[ChatTurn]:
    """The last `limit` messages as plain turns for the agent's message history."""
    with closing(connect_rw()) as conn:
        rows = conn.execute(
            "SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [ChatTurn(role=r["role"], content=r["content"][:MAX_CONTENT]) for r in reversed(rows)]


def save_turn(user_id: int, user_message: str, response: ChatResponse) -> None:
    """Saves the shopper's message and the assistant's reply in one transaction."""
    products_json = json.dumps([p.model_dump() for p in response.products]) if response.products else None
    with closing(connect_rw()) as conn:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)",
            (user_id, user_message),
        )
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json, results_title) VALUES (?, 'assistant', ?, ?, ?)",
            (user_id, response.reply, products_json, response.results_title),
        )
        conn.commit()


def clear(user_id: int) -> int:
    with closing(connect_rw()) as conn:
        deleted = conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,)).rowcount
        conn.commit()
    return deleted

