# Campus Customs — Usability Improvements (Problem 9)

Four improvements: two on the front end (look and ease of use) and two on the agent/backend (better, cheaper and safer answers). Each section says **what was added** and **why it helps** a Campus Customs shopper or the business, followed by how it was checked in the running app.

*I wrote this file before building (as a plan), then updated it with what was actually built and measured.*

| # | Improvement | Where |
|---|---|---|
| F1 | Sort and filter on the Products page | `frontend/src/pages/Products.tsx`, `frontend/src/api.ts` |
| F2 | Chat shortcuts: suggested questions and "Ask about this item" | `frontend/src/chatShortcuts.ts`, `ChatWidget.tsx`, `ProductPage.tsx` |
| B1 | Cheaper agent runs: token diet and usage tracking | `backend/tools.py`, `backend/agent.py`, `backend/models.py`, `backend/prompts/prompt.md` |
| B2 | Price guard: no invented prices | `backend/agent.py` (`price_guard`, `unverified_prices`) |

---

## F1 — Sort and filter on the Products page

**What I added**
- A toolbar under the search box and category chips with four drop-downs:
  - **Sort:** Featured (A–Z), Price: low to high, Price: high to low, Name: Z–A.
  - **Price:** Any, Under $40, $40–$60, $60–$80, Over $80.
  - **Color:** the garment's main color, grouped into Navy, Gray, Cream & White, Pink & Coral. This uses the first entry of `colors`, the garment color, so a gray shirt with a navy logo counts as gray.
  - **Size in stock:** XS–XXL. It shows only products with that size available **right now**. To support this, `/api/products` now includes each product's `in_stock_sizes`, read from the `inventory` table.
- The filters combine with the existing search and category chips.
- The count line says "10 products in stock in M", and **Clear filters (n)** resets the filters but keeps your sort.
- All settings live in the URL (e.g. `/products?sort=price_low&price=40to60&color=Navy&size=M`), so a filtered view survives a reload and can be shared or bookmarked.
- There is no "popularity" sort on purpose: the database has no sales data, and a made-up popularity order would mislead shoppers.

**Why it helps**
- Shoppers usually start with their size and budget. "Navy, medium, under $60" goes from scrolling 102 cards to a few clicks.
- "Size in stock" stops shoppers opening items that are sold out in their size, a common reason people give up on a purchase. That helps sales, not just looks.
- Sorting by price helps budget shoppers (students) and gift buyers find the right price quickly.

**Checked in the running app (Edge, automated)**
- Price low → high runs $32.00 … $98.00 across all 102 products, fully sorted. High → low runs $98.00 … $32.00. Name Z–A starts with "Yale Uncle Hoodie" and ends with "2025 Yale Vs Harvard T Shirt".
- $40–$60 + Navy + size M → **10 products**, the same 10 names a direct SQL query on `catalogue` + `inventory` returns. Adding the Hoodies chip → 1 (UA Gameday Double Knit Hood).
- Pink & Coral → Big Yale Tri Blend T Shirt. Jackets & Fleece in XS → 7.
- The filters survive a page reload, and Clear filters returns all 102 while keeping the sort.

## F2 — Chat shortcuts

**What I added**
- **Suggested questions** as one-click chips above the chat input, in a single scrolling row:
  - **Elsewhere on the site:** "What hoodies do you have?", "Gift ideas under $60", "What's your cheapest crewneck?", "Show me Branford College gear". These show until the shopper asks their first question.
  - **On a product page:** "Is this in stock in medium?", "What does this one look like?", "Do you have this in another color?", "Show me similar items under $60". These always show there, because the page context (Problem 8) tells the agent what "this" means.
- **"💬 Ask about this item"** button on every product page, under the price. It opens the chat with those product questions ready.
- Any component can open the chat through a small `openAssistant()` helper in `chatShortcuts.ts`, which the chat widget listens for.

**Why it helps**
- Many shoppers don't know what a shop chatbot can do, or don't want to type. The chips show off the assistant's strengths (stock by size, gift ideas, cards on the page) in one tap, which is especially handy on phones.
- On a product page, the most common questions (size, stock, colors) become one click. The answer comes from the live database, and it doesn't repeat what's already on the page, like "which size is left in M?".
- For the business, more shoppers use the assistant and get to an in-stock item faster.

**Checked in the running app**
- On the Home page the four general chips appear. Clicking "What's your cheapest crewneck?" sent it and got "Our cheapest crewnecks are $58.00…" (correct per the DB), and the chips then hid.
- On the Branford 1/4 Zip page, **Ask about this item** opened the chat with the four product chips. "Is this in stock in medium?" → "Yes, the Branford 1 4 Zip is in stock in medium, with 20 left." That's correct: the DB has M = 20.

## B1 — Cheaper agent runs (token diet + usage tracking)

**What I added**
1. **Usage tracking.** Every chat turn appends one line to `output/usage_log.jsonl` with `requests`, `tool_calls`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `price_guard_retries`, `logged_in` and `page_type`.
   - **No message text or personal data** is logged.
   - The file is git-ignored, because it's runtime data.
2. **Smaller search results.** `ProductSummary` (what `search_products` returns, up to 30 at a time) went from 7 fields to 5.
   - `colors` and in-stock `sizes` are now short strings: `"navy blue/white"`, and `"all"` or `"S,M,XL"`.
   - `garment_type` and `sold_out_sizes` were dropped. They can be worked out, or looked up with the detail tools.
   - A 27-hoodie search result shrank from ~6,500 to ~4,000 characters (**−38%**).
3. **Shorter history.** The model now sees the last **10** messages instead of 20, and assistant replies older than the last exchange are cut to 300 characters.
   - The full conversation is still saved and shown to the shopper. Only what's re-sent to the model is trimmed.
4. **Fewer, cheaper steps (prompt).**
   - The shopper names a product → call `get_price` / `get_stock` directly, without searching first.
   - Independent lookups (price + stock, or two items being compared) are called **together in one step**. Every extra step re-sends the whole context.
5. **Shorter prompt, same rules.** `prompts/prompt.md` was rewritten more concisely: 9,987 → 6,597 characters (**−34%**, about 850 fewer tokens on every model request). Every rule was kept.
6. **Cache-friendly order (kept).** The static prompt comes first and the per-message sections ("Who is chatting", "Current page") last, so the provider's automatic prompt caching reuses the identical prefix. The logs show 70–90% of input tokens are served from cache.

I also tested lowering the model's reasoning effort. `gpt-5.6-luna` used only 47–97 reasoning tokens per two turns, so it isn't a real saving. The `"minimal"` setting isn't supported by this model, so I left the setting unchanged.

**Why it helps**
- Every chat message is paid for in model tokens, and each tool step re-sends the prompt, tool schemas and conversation. Sending less on every step lowers the cost of each conversation and makes replies faster, with the same answers.
- The usage log lets the business see real cost per turn, spot expensive conversations, and check that future changes don't make things worse.

**Measured.** The same 6 fixed chat turns were run through the agent before and after, with the same model, a logged-in customer, and one turn with a long saved history:

| Turn | Input tokens before | after | Change |
|---|---:|---:|---:|
| what hoodies do you have? | 8,597 | 6,402 | −26% |
| how much is the boola tee, in stock in large? | 11,617 | 8,975 | −23% |
| do you have this in pink? (product page) | 10,634 | 8,366 | −21% |
| gift ideas for my dad under $70 | 7,018 | 6,609 | −6% |
| what crewnecks do you have? | 8,871 | 6,607 | −26% |
| is the first one in medium? (24-message history) | 10,480 | 6,442 | **−39%** |
| **Total** | **57,217** | **43,401** | **−24%** |

- **Model requests:** 14 before, 14 after, so the comparison is fair. **Input tokens per request:** 4,087 → 3,100 (−24%). **Output tokens:** 1,537 → 1,491 (−3%).
- **Uncached input:** about the same (~12.5k before and after). Most of the saving is on cached tokens, which are cheaper, so the drop in the actual bill is smaller than 24%. The biggest per-turn saving is in long conversations (−39%), which are also the most expensive ones.
- Answer quality was re-checked after the changes:
  - "Boola Boola T Shirt in large?" → "sold out in L", in the first sentence.
  - The pink question and the off-topic refusal were handled as before.
  - A stale "$25" claim was corrected to $32.00.
  - "Difference in price between the tee and the Basic Hoodie" → "$36.00 more".

## B2 — Price guard (no invented prices)

**What I added**
- A PydanticAI **output validator** (`price_guard` in `agent.py`) that checks every reply before the shopper sees it. `unverified_prices()` finds each dollar amount in the text and allows only amounts that are:
  - a price returned by a tool (`get_price`, `search_products`) **in this turn**, or
  - a difference or sum of two such prices (e.g. "$36.00 more", "$100.00 for both"), or
  - an amount the shopper typed (e.g. their "under $70" budget).
- Anything else makes the agent retry with a message naming the bad amount: *"Your reply mentions $25.00, but no tool returned that price in this turn. Look the price up with get_price (or remove it), then quote price_display exactly."*
- Up to 2 retries (the agent's `retries=2`). The retry count is written to the usage log (`price_guard_retries`), so the business can see how often the guard steps in.
- The prompt tells the agent about the check, so it looks prices up from the start.

**Why it helps**
- A wrong price in chat is a real business problem: a customer sees "$25" and arrives at the store expecting it. The prompt already told the agent to quote tool prices exactly; the guard turns that into a **hard rule enforced in code**.
- It also catches **stale prices** repeated from earlier in the conversation, since only this turn's tool results count.
- Together with Problem 7 (product cards built from the database), every price a shopper sees in the chat or on the page is traceable to `catalogue.price`.

**Checked**
- **Unit check:** real prices, a difference, a sum and a shopper's budget all pass. An invented "$25.00" is flagged, and a reply with no amounts passes.
- **Inside the real agent loop:** I replaced the model with a scripted PydanticAI `FunctionModel` whose first answer invents a price ("on sale for $25.00!"). The guard rejected it with the message above, the scripted model then called `get_price`, and the shopper got **"The Boola Boola T Shirt is $32.00."** (`price_guard_retries = 1`).
- **With the real model:** across the regression questions the guard never needed to step in (`price_guard_retries = 0`), because the agent looked every price up. That's the expected result; the guard is a safety net.
