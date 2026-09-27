"""Account creation, login and sessions for Campus Customs.

Passwords are never stored. Each user row keeps a salted PBKDF2-SHA256 hash:
    new accounts:  pbkdf2_sha256$<iterations>$<salt>$<hex digest>
    seed accounts: pbkdf2_sha256$<salt>$<hex digest>   (120,000 iterations)
Seed-format hashes are upgraded to the new format after a successful login.

Logged-in shoppers get a random session token in an HttpOnly cookie. The
database stores only a SHA-256 of that token, so a leaked database cannot be
used to hijack sessions.
"""

import hashlib
import hmac
import re
import secrets
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

from db import connect_rw

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000  # OWASP 2023+ recommendation for PBKDF2-SHA256
LEGACY_ITERATIONS = 120_000  # used by the seed users in campus_customs.db
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128  # bounds hashing work per request

SESSION_COOKIE = "cc_session"
SESSION_DAYS = 7

# Brute-force protection: max failed logins per (ip, email) in a sliding window.
MAX_FAILED_LOGINS = 5
FAILED_LOGIN_WINDOW = 15 * 60  # seconds

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------- Password hashing ----------

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return f"{ALGORITHM}${ITERATIONS}${salt}${digest}"


def _parse_hash(stored: str) -> tuple[int, str, str] | None:
    parts = stored.split("$")
    if len(parts) == 4 and parts[0] == ALGORITHM and parts[1].isdigit():
        return int(parts[1]), parts[2], parts[3]
    if len(parts) == 3 and parts[0] == ALGORITHM:
        return LEGACY_ITERATIONS, parts[1], parts[2]
    return None


def verify_password(password: str, stored: str) -> bool:
    parsed = _parse_hash(stored)
    if parsed is None:
        return False
    iterations, salt, expected = parsed
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations).hex()
    return hmac.compare_digest(digest, expected)


def needs_rehash(stored: str) -> bool:
    # Seed-format hashes (3 parts) or fewer iterations than today's setting.
    parsed = _parse_hash(stored)
    return parsed is None or stored.count("$") != 3 or parsed[0] < ITERATIONS


# Used when the email is unknown, so a login takes the same time either way
# and response timing does not reveal which emails have accounts.
_DUMMY_HASH = hash_password(secrets.token_hex(16))


# ---------- Sessions ----------

def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _db_time(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def ensure_sessions_table() -> None:
    with closing(connect_rw()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )
        conn.commit()


def create_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (_token_digest(token), user_id, _db_time(_now() + timedelta(days=SESSION_DAYS))),
    )
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (_db_time(_now()),))
    return token


def user_from_token(token: str | None) -> dict | None:
    """Returns the public profile for a valid session token, else None."""
    if not token:
        return None
    with closing(connect_rw()) as conn:
        row = conn.execute(
            """
            SELECT u.id, u.name, u.email, u.first_name, u.last_name, u.created_at
            FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (_token_digest(token), _db_time(_now())),
        ).fetchone()
    return public_user(row) if row else None


def public_user(row: sqlite3.Row) -> dict:
    # Never include password_hash in anything sent to the browser or the agent.
    first = row["first_name"] or row["name"].split(" ")[0]
    return {
        "id": row["id"],
        "email": row["email"],
        "first_name": first,
        "last_name": row["last_name"] or "",
        "name": row["name"],
        "member_since": (row["created_at"] or "")[:10] if "created_at" in row.keys() else "",
    }


def _set_session_cookie(response: Response, request: Request, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,  # JavaScript (and injected scripts) cannot read it
        samesite="lax",  # not sent on cross-site POSTs (CSRF protection)
        secure=request.url.scheme == "https",
        path="/",
    )


# ---------- Rate limiting ----------

_failed_logins: dict[tuple[str, str], list[float]] = {}


def _recent_failures(key: tuple[str, str]) -> list[float]:
    cutoff = time.monotonic() - FAILED_LOGIN_WINDOW
    attempts = [t for t in _failed_logins.get(key, []) if t > cutoff]
    _failed_logins[key] = attempts
    return attempts


# ---------- Request models ----------

class SignupRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: str = Field(max_length=254)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def strong_enough(cls, v: str) -> str:
        if v.strip() != v or not v.strip():
            raise ValueError("Password cannot start or end with spaces")
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Password must include at least one letter and one number")
        return v


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)


# ---------- Routes ----------

@router.post("/signup", status_code=201)
def signup(body: SignupRequest, request: Request, response: Response) -> dict:
    with closing(connect_rw()) as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (name, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
                (
                    f"{body.first_name} {body.last_name}",
                    body.email,
                    hash_password(body.password),
                    body.first_name,
                    body.last_name,
                ),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="An account with that email already exists.")
        token = create_session(conn, cur.lastrowid)
        conn.commit()
        row = conn.execute(
            "SELECT id, name, email, first_name, last_name FROM users WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    _set_session_cookie(response, request, token)
    return public_user(row)


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response) -> dict:
    email = body.email.strip().lower()
    key = (request.client.host if request.client else "unknown", email)
    if len(_recent_failures(key)) >= MAX_FAILED_LOGINS:
        raise HTTPException(
            status_code=429, detail="Too many failed attempts. Please wait 15 minutes and try again."
        )

    with closing(connect_rw()) as conn:
        row = conn.execute(
            "SELECT id, name, email, first_name, last_name, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        ok = verify_password(body.password, row["password_hash"] if row else _DUMMY_HASH) and row is not None
        if not ok:
            _failed_logins[key].append(time.monotonic())
            # Same message whether the email or the password was wrong.
            raise HTTPException(status_code=401, detail="Incorrect email or password.")

        _failed_logins.pop(key, None)
        if needs_rehash(row["password_hash"]):
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(body.password), row["id"])
            )
        token = create_session(conn, row["id"])
        conn.commit()
    _set_session_cookie(response, request, token)
    return public_user(row)


@router.post("/logout")
def logout(response: Response, cc_session: str | None = Cookie(default=None)) -> dict:
    if cc_session:
        with closing(connect_rw()) as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_digest(cc_session),))
            conn.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(cc_session: str | None = Cookie(default=None)) -> dict:
    user = user_from_token(cc_session)
    if user is None:
        raise HTTPException(status_code=401, detail="Not logged in.")
    return user
