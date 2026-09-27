"""Campus Customs API: products, accounts and the shop chatbot.

- Products and images come from the local SQLite database (tools.py queries).
- Create account / log in / sessions live in auth.py.
- POST /api/chat sends the shopper's message to the PydanticAI agent (agent.py), with
  who is chatting and which page they are on. Logged-in chats are saved (chat_history.py).

Run from the backend/ folder:
    uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import Cookie, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import auth
import chat_history
from agent import MAX_HISTORY_TURNS, run_chat
from db import PRODUCTS_DIR
from models import (
    ChatRequest,
    ChatResponse,
    CustomerContext,
    ProductCard,
    ProductDetail,
    ShopDeps,
    StoredChatMessage,
)
from tools import all_products, build_page_context, product_detail


@asynccontextmanager
async def lifespan(_: FastAPI):
    auth.ensure_sessions_table()
    chat_history.ensure_schema()
    yield


app = FastAPI(title="Campus Customs API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Plain messages only. FastAPI's default echoes the submitted input, which would include passwords.
    messages = [
        f"{str(err['loc'][-1]).replace('_', ' ').capitalize()}: {err['msg'].removeprefix('Value error, ')}"
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": " ".join(messages)})


app.include_router(auth.router)

# Only the product photo folder is public, never the data folder (which holds the database).
app.mount("/images/products", StaticFiles(directory=PRODUCTS_DIR), name="product-images")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/products")
def list_products() -> list[ProductCard]:
    return all_products()


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> ProductDetail:
    detail = product_detail(product_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return detail


def _customer(user: dict) -> CustomerContext:
    return CustomerContext(
        user_id=user["id"],
        first_name=user["first_name"],
        last_name=user["last_name"],
        email=user["email"],
        member_since=user["member_since"],
    )


@app.post("/api/chat")
async def chat(req: ChatRequest, cc_session: str | None = Cookie(default=None)) -> ChatResponse:
    """Anyone can chat. Logged-in shoppers get their saved history and the turn is saved."""
    user = auth.user_from_token(cc_session)
    deps = ShopDeps(customer=_customer(user) if user else None, page=build_page_context(req.page))
    # Logged in: history comes from the database, not the browser, so it can't be forged.
    # Guest: the browser sends the conversation so far (kept only in the page).
    history = chat_history.load_turns(user["id"], MAX_HISTORY_TURNS) if user else req.history
    response, saveable = await run_chat(req.message, history, deps)
    if user and saveable:
        chat_history.save_turn(user["id"], req.message, response)
    return response


def _require_user(cc_session: str | None) -> dict:
    user = auth.user_from_token(cc_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Log in to see your saved chat history.")
    return user


@app.get("/api/chat/history")
def get_chat_history(cc_session: str | None = Cookie(default=None)) -> list[StoredChatMessage]:
    """The logged-in shopper's saved chat, oldest first (only their own messages)."""
    return chat_history.load_messages(_require_user(cc_session)["id"])


@app.delete("/api/chat/history")
def clear_chat_history(cc_session: str | None = Cookie(default=None)) -> dict:
    return {"deleted": chat_history.clear(_require_user(cc_session)["id"])}
