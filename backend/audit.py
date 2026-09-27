"""Append-only audit trail of agent-loop activity: output/audit_trail.json.

One entry per chat turn: when it ran, who/where (guest or user id, page), each model step's
tool calls with short args and results, price-guard retries, token usage, the stop reason and
a short reply. Entries are only ever appended; the file is never wiped. If it can't be parsed,
it is renamed (kept) and a new list is started.

Privacy: shopper text is shortened and emails / card-like numbers are redacted before logging.
Customer email and password data are never written here.
"""

import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    ToolCallPart,
    ToolReturnPart,
)

from models import (
    CustomerContext,
    NotFound,
    PageContext,
    PriceInfo,
    ProductDescription,
    SearchResults,
    ShopDeps,
    StockReport,
)

AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
TEXT_LIMIT = 300
ARGS_LIMIT = 200
RESULT_LIMIT = 240

log = logging.getLogger("campus_customs.audit")
_lock = threading.Lock()

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_CARD = re.compile(r"\b\d(?:[ -]?\d){11,18}\b")


def redact(text: str, limit: int = TEXT_LIMIT) -> str:
    text = _CARD.sub("[card-number redacted]", _EMAIL.sub("[email redacted]", str(text)))
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _short_result(value: Any) -> str:
    """One readable line per tool result (never the customer's email)."""
    if isinstance(value, SearchResults):
        names = "; ".join(r.name for r in value.results[:3])
        more = f" (+{value.count - 3} more)" if value.count > 3 else ""
        text = f"{value.count} results: {names}{more}" if value.count else "0 results"
    elif isinstance(value, PriceInfo):
        text = f"{value.name}: {value.price_display}"
    elif isinstance(value, StockReport):
        text = f"{value.name}: {value.summary}"
    elif isinstance(value, ProductDescription):
        text = f"{value.name}: {value.description}"
    elif isinstance(value, NotFound):
        text = f"NotFound: {value.error}" + (f" suggestions={value.suggestions}" if value.suggestions else "")
    elif isinstance(value, CustomerContext):
        text = f"customer user_id={value.user_id} (name/email withheld from log)"
    elif isinstance(value, PageContext):
        text = f"page {value.page_type} {value.path}" + (f" product={value.product.product_id}" if value.product else "")
    elif isinstance(value, BaseModel):
        text = value.model_dump_json()
    else:
        text = str(value)
    return redact(text, RESULT_LIMIT)


def _short_args(part: ToolCallPart) -> str:
    try:
        args = part.args_as_dict()
    except (ValueError, TypeError):
        args = {"raw": str(part.args)}
    return redact(json.dumps(args, ensure_ascii=False), ARGS_LIMIT)


def trace(messages: list[ModelMessage]) -> tuple[list[dict], list[str], str]:
    """Tool calls (with results), price-guard/validation retries and the last finish reason of one run."""
    returns = {
        part.tool_call_id: part.content
        for msg in messages
        if isinstance(msg, ModelRequest)
        for part in msg.parts
        if isinstance(part, ToolReturnPart)
    }
    calls: list[dict] = []
    retries: list[str] = []
    step = 0
    finish = "none"
    for msg in messages:
        if isinstance(msg, ModelResponse):
            step += 1
            finish = msg.finish_reason or "unknown"
            for part in msg.parts:
                if isinstance(part, ToolCallPart) and part.tool_name != "final_result":
                    result = returns.get(part.tool_call_id, "(no result)")
                    calls.append(
                        {"step": step, "tool": part.tool_name, "args": _short_args(part), "result": _short_result(result)}
                    )
        elif isinstance(msg, ModelRequest):
            for part in msg.parts:
                if isinstance(part, RetryPromptPart):
                    content = part.content if isinstance(part.content, str) else json.dumps(part.content, default=str)
                    retries.append(redact(f"step {step}: {content}", RESULT_LIMIT))
    return calls, retries, finish


def record(
    *,
    started: datetime,
    model: str,
    deps: ShopDeps,
    message: str,
    messages: list[ModelMessage],
    stop_reason: str,
    reply: str,
    cards: int = 0,
    results_title: str | None = None,
    usage: Any = None,
) -> None:
    """Appends one agent-loop entry to output/audit_trail.json."""
    calls, retries, finish = trace(messages)
    page = deps.page
    entry = {
        "time": started.isoformat(timespec="seconds"),
        "duration_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
        "model": model,
        "shopper": f"user:{deps.customer.user_id}" if deps.customer else "guest",
        "page": (f"{page.page_type} {page.path}" if page else "unknown"),
        "message": redact(message),
        "tool_calls": calls,
        "retries": retries,
        "model_requests": getattr(usage, "requests", None),
        "input_tokens": getattr(usage, "input_tokens", None),
        "cached_input_tokens": getattr(usage, "cache_read_tokens", None),
        "output_tokens": getattr(usage, "output_tokens", None),
        "stop_reason": f"{stop_reason} (last finish_reason={finish})",
        "reply": redact(reply),
        "cards_shown": cards,
        "results_title": results_title,
    }
    _append(entry)


def _append(entry: dict) -> None:
    with _lock:
        try:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            rows: list = []
            if AUDIT_PATH.exists() and AUDIT_PATH.read_text(encoding="utf-8").strip():
                try:
                    rows = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
                    if not isinstance(rows, list):
                        raise ValueError("not a JSON list")
                except ValueError:
                    # Never wipe history: keep the unreadable file under a new name, start a new list.
                    backup = AUDIT_PATH.with_name(f"audit_trail.corrupt-{datetime.now():%Y%m%d-%H%M%S}.json")
                    AUDIT_PATH.rename(backup)
                    log.warning("audit_trail.json was unreadable; kept it as %s", backup.name)
                    rows = []
            rows.append(entry)
            tmp = AUDIT_PATH.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, AUDIT_PATH)  # atomic: a crash mid-write can't truncate the trail
        except OSError:
            log.exception("Could not append to %s", AUDIT_PATH)
