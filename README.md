# Campus Customs — Yale merch shop with a bulldog chatbot (HW4)

A class project (AI Foundations, Homework 4): a React + Vite + TypeScript storefront for Campus Customs with a Python FastAPI backend. The shop assistant, **Handsome Dan**, is a PydanticAI agent (`gpt-5.6-luna` via Portkey). It answers price and stock questions from a local SQLite database, puts matching products on the page as cards, knows which product you're viewing, and remembers logged-in shoppers' chats.

> **Not included in this repo:** the real `.env` (API key), the course database `campus_customs.db`, and the product images. They're kept out by `.gitignore`. Follow the steps below to add them locally.

## Layout

```
hw4/
├── AI_prompts.md            # prompt log, one section per problem
├── requirements.txt         # backend Python packages
├── .env.example             # placeholder for PORTKEY_API_KEY (copy to .env)
├── .gitignore
├── README.md
├── style_notes.md           # Problem 2 research notes on yalebulldogblue.com
├── data/                    # ← put the data pack here (not in git; see below)
├── frontend/                # Vite React TypeScript app
├── backend/
│   ├── main.py              # FastAPI app — run with: uvicorn main:app --reload --port 8000
│   ├── agent.py             # the agent: wiring, context, price guard, loop limits
│   ├── models.py            # Pydantic / PydanticAI types
│   ├── tools.py             # tools the agent can call (read-only DB)
│   ├── prompts/prompt.md    # system prompt: voice, tools, honesty and safety rules
│   ├── auth.py              # create account / log in / sessions
│   ├── chat_history.py      # saved chats for logged-in shoppers
│   ├── audit.py             # append-only output/audit_trail.json
│   └── db.py                # SQLite connections
└── output/
    ├── harness.md           # how the whole system works (models, tools, safety, specs)
    ├── design.md            # storefront design (Problem 10)
    ├── usability.md         # usability improvements + measurements (Problem 9)
    ├── app_check.html       # live app check, open it in a browser (Problem 11)
    ├── app_check_images/    # screenshots linked from app_check.html
    └── audit_trail.json     # agent-loop audit trail (Problem 12)
```

The agent itself is four files in `backend/`: `prompts/prompt.md`, `agent.py`, `tools.py` and `models.py`. `main.py` is the API that runs it.

## Run it

**You need:** Python 3.12+ (tested on 3.14), Node.js 20+ (tested on 24), and a Portkey API key with access to `gpt-5.6-luna`.

### 1. Place the data pack

Unzip the course data pack (`data.zip`) **into this folder**, so you get:

```
hw4/data/campus_customs.db           # SQLite: catalogue, inventory, users, chat_messages
hw4/data/products/*.jpg              # 102 product photos (paths match catalogue.image_file_path)
```

On macOS/Linux or Git Bash:
```bash
unzip data.zip -d .
```
On Windows you can also right-click the zip, choose **Extract All…**, and pick the `hw4` folder. The zip already contains the `data/` folder.

When the backend starts, it adds what it needs to this database (a `sessions` table, and a `results_title` column and an index on `chat_messages`) without changing existing rows.

### 2. Add your API key

```bash
cp .env.example .env        # then edit .env and set PORTKEY_API_KEY=...
```
`.env` can live in `hw4/` or its parent folder. It's git-ignored, and only the backend reads it. Without a key, the shop, products and log in still work, and the chat shows a friendly "can't reach the assistant" message.

### 3. Start the backend (terminal 1)

```bash
python -m venv .venv
source .venv/bin/activate          # Windows (PowerShell): .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```
Check it: http://127.0.0.1:8000/api/health should return `{"status":"ok"}`.

### 4. Start the front end (terminal 2)

```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. Vite forwards `/api` and `/images` to the backend on port 8000.

### 5. Try it

- **Log in** with the course test user: `test@campuscustoms.yale.edu` / `password`. Or create an account.
- **Ask Handsome Dan** (bottom-right) "What hoodies do you have?". Matching products appear on the page as cards.
- **On a product page**, ask "Is this in stock in XL?" or "Do you have this in pink?".
- **On Products**, sort by price and filter by price range, color and size in stock.

`npm run build` makes a production build of the front end. If a backend code change doesn't seem to apply with `--reload` (seen on Windows), stop Uvicorn and start it again. Edits to `prompts/prompt.md` apply on the next message, with no restart.

## Test data and privacy

- **No real customer data** is in this repo. The database isn't committed.
- The course database comes with test accounts only; the test user's password `password` is published by the course.
- While building, a few more test accounts were created locally on the reserved `example.test` domain, with random passwords that were never saved.
- Passwords are stored only as salted PBKDF2-SHA256 hashes (see [output/harness.md](output/harness.md) §5).
- `output/audit_trail.json` holds only test chats. Emails and card-like numbers in messages are redacted, and customer names and emails are never logged.

## Documentation

- [output/harness.md](output/harness.md): **start here.** Architecture, specs and limits, data, API, authentication, the agent, the model fields and why, tools, safety rules, the audit trail, and verification.
- [output/app_check.html](output/app_check.html): live test report with screenshots (open the file in a browser).
- [output/usability.md](output/usability.md), [output/design.md](output/design.md): Problems 9 and 10.
- [AI_prompts.md](AI_prompts.md): the prompts used to build this project, problem by problem.
