# HW4 AI Prompt Log

This log records the prompts I typed to my AI coding assistant while completing Homework 4. Each problem has its own section, so the work can be reviewed problem by problem. Each section includes the problem number and title, at least one prompt I typed, and a follow-up prompt only if I actually needed one.

## Problem 1 — Create and maintain the AI_prompts.md log

### Prompts typed

> working on homework 4

> I will give you the instructions from now on. We are working in that folder so everything in this chat should be stored there.

> I need you to create AI_prompts.md at the start of the assignment and keep it updated as we work.This file is the log of what I typed to you. Put one section for each problem. Each section must include:
> The problem number and title
>  At least one prompt I typed
>  One follow-up prompt, only if I actually needed it and typed it

### Follow-up prompt

> I forgot to tell you but creating AI_prompts.md was the problem 1. put what I typed in the problem 1 section

## Problem 2 — Campus Customs website context and data setup

### Prompt typed

> now we work on problem 2. I want to give you some context first. 
> Campus Customs needs a real customer website with a helpful chatbot. I will build a React + Vite TypeScript front end and a Python FastAPI backend whose brain is a PydanticAlagent. Shoppers should be able to browse products, create an account, chat about merch, see matching items appear on the page, and get honest answers about price and stock from
> a local database.
> I will give you campus_customs.db with tables for the product catalogue, inventory by size, and users (with hashed passwords). Product image file paths are in the catalogue table.Research yalebulldogblue.com to learn the style of Campus Customs page and information.
> In the end I will push my project to a public GitHub repo and submit the repo URL on Canvas (the last problem will show the file tree). Now, unzip the data.zip so we have: data/campus_customs.db, a SQLite database with tables catalogue, inventory and
> users (one test user is already there)
> we also have data/products/, product images; paths match the catalogue table

### Follow-up prompt

> Continuing problem 2, look at the database data/campus_customs.db and understand the fields of each table, at a minimum understand catalogue, inventory, and users. And then start the file output/harness.md. Write down each table and its fields, and one short line on why each field matters for the shop or the chatbot. In the future I will keep growing this harness file in later problems, for example put in models, tools, safety, specs etc.

## Problem 3 — React + Vite front end and product API

### Prompt typed

> Now we work on the Problem 3. Scaffold a React + Vite + TypeScript front end for Campus Customs. Put a nav bar at the top that links to the main pages:
> ·Home
> ·Products
> ·About Us
> ·Log in
> ·Create account
> Pull Campus Customs-style wording from yalebulldogblue.com for Home and About Us, but write these pages in your own voice (do not copy the original site text). and then on the Products page, show product images from the catalogue (use the image paths in the database) with basic product info (name, price, short description).
> Make each product open a single-item page (large image on one side, full product text on the other - description, price, sizes/stock when you have them). Clicking a card on Products should take the shopper there.
> Add a chat interface in the bottom right of the site (a floating chat panel is fine). It does not need to talk to an agent yet - a stub that will call our backend later is enough for this problem.
> I will need a small API soon to read the database. It is fine to start a simple FastAPI app in backend/main.py just to serve products and images, then grow it into the agent backend in Problem 5

### Follow-up prompt

> show me the site in the preview

## Problem 4 — Create account and log in

### Prompt typed

> Now we work on problem 4. we need to build a normal create-account / login flow.
> for Create account: first name, last name, email, password (confirm password is a nice
> for Log in: email and password
> New accounts go into the users table. Make sure to store passwords securely so hackers (human or Al) cannot access them.The seed database already has a test user you can use while building:
> ·Email: test@campuscustoms.yale.edupassword
> Password: password
> Confirm you can log in as that user, and that a brand-new account you create also works
> Then update output/harness.md with how auth works (what you store for a user and how passwords are protected).

### Follow-up prompt

> can you add some kind of notes so whoever see what I uploaded onto github will know that these accounts are for testing only? then you can keep it

## Problem 5 — PydanticAI shop chatbot behind FastAPI

### Prompt typed

> Now we work on problem 5. Build the shop chatbot as a PydanticAl agent behind FastAPl, plugged into your front-endchat widget. Put the API app in backend/main.py, that is the file you run with Uvicorn. Keep the agent as these four files next to it (same idea as Homework 3, which I saw that you already read the log before talking to me)
> backend/prompts/prompt.md- system prompt (grow this same file later)
> backend/agent.py- agent entry / wiring; and backend/tools.py- tools the agent can call; and backend/models.py- Pydantic / PydanticAl structured types
> In main.py, expose a chat route so a message from the website returns a reply from the agent (and whatever else you need for products/auth). the Al model API key will be needed for the agent. Then, put Campus Customs voice and safety basics into prompts/prompt.md (I will expand tools and safety later). Start or update types in models.py for chat replies / product cards as needed. In  output/harness.md, note how the front end talks to FastAPI and how the agent is  loaded (prompt file + model).
> Make sure the backend runs from the
> backend/ folder like this: uvicorn main:app --reload --port 8000

## Problem 6 — Database lookup tools for description, price and stock

### Prompt typed

> Now we work on problem 6. Give the agent tools that look up real information from
> campus_customs.db
> · Product description
> · Price
> · How many are in stock (by size when the customer asks)
> The agent mustuse the database - it should not invent prices or quantities. If a size is out of stock, say so clearly. Then, expand prompts/prompt.md so the agent knows to call these tools for price and stock questions. Add or update return types in models.py.
> In output/harness.md, list each tool and explain which model fields you chose for lookup results and why.

## Problem 7 — Chat search results as product cards on the page

### Prompt typed

> Now we work on problem 7. Now we will add a neat feature to the site. When a customer asks about a type of item - forexample "what hoodies do you have?" - the agent should search the catalogue and the website should dynamically show those matching items as product cards (image, name,price, short info).
> This is an API contract: the agent returns structured product matches and then the front end renders them on the website. After the dynamic product cards are loaded by our new feature, make sure the same single-item page behavior I built in Problem 3 still works: each product card - including the ones the chat just put on the page - should still open that detail view (large image + full info) when clicked.  Update prompts/prompt.md and output/harness.md so it is clear hwo search results reach the page.

## Problem 8 — Saved chat history, customer context and page context

### Prompt typed

> Now we work on problem 8. When a shopper is logged in, save their chat history in the database in an appropriate tableand reload it when they return. The agent should know who is chatting (name, email) - put that in agent deps (or an equivalent clear pattern) and/or tools the agent can call. 
> Also pass enough page context that if someone is on a product page and asks "do you have this in pink?", the agent knows which item they mean. Maybe consider puting code into the agent context. Guests can still chat, but history only needs to persist for logged-in users. Document in output/harness.md: how user chat history is stored, what customer fields the agent sees, and how page context is passed.

## Problem 9 — Usability improvements (2 front end, 2 agent/backend)

### Prompt typed

> Now we work on problem 9. Now that the core shop works, improve it. Choose and implement:
> · 2 front-end usability improvements
> · 2 agent / backend usability improvements
> Front-end mprovements are things that make the site look better and make it easier to use.
> Agent/ backend improvements are things that make the agent output better, more accurate,or safer. These could be new agent tools or things that make the agent run faster or cheaper. Writeoutput/usability.md
> before or as you build. For each of the improvements, say:
> ·What you added
>  Why it helps a Campus Customs shopper or the business
> Then make sure all improvements actually show up in the running app. for example maybe for frontend add sorting options for price, popularity, and product name. Or a search bar and filters for product category, price range, color, and availability. or product comparison view. these are just my thoughts, pick two that you think are helpful and also easy to build. Also I'd prefer a backend improvement that makes the agent ran cheaper

## Problem 10 — Storefront design (fonts, color, hero, swatches, bulldog guide)

### Prompt typed

> Now we work on problem 10. Add creative design so the site feels like a real Campus Customs storefront - fonts, color,
> hierarchy, motion, product presentation, chat feel. Write output/design.md what you changed and why it should help customers stick around and buy. Keep it concrete and short. For example, what I can now think of include 1. Campus-Inspired Heading Font
> Use a serif or varsity-style font for headings to give the storefront the look and feel of a university publication or collegiate athletics brand. This creates a distinctive campus identity and makes important titles stand out.
> 2. Clear Sans-Serif Body Font
> Use a clean sans-serif font, such as Inter, for body text, product descriptions, prices, buttons, and navigation. This improves readability and balances the more expressive heading font.
> 3. Storefront Hero Section
> Add a visually engaging hero section at the top of the homepage with a strong headline, a short value proposition, featured product imagery, and clear calls to action such as "Shop Best Sellers" and "Design Your Own." This immediately communicates what Campus Customs offers and guides shoppers toward the main shopping actions.
> 4. Product Color Swatches
> Replace text-only color options such as "Blue," "White," and "Gray" with clickable circular color swatches. Show a visible outline or checkmark on the selected swatch and update the product preview when the shopper chooses a different color. This makes color selection faster, more visual, and easier to understand. 5. add some icon of culldogs to the page, and also change the campus customs assistant into a bulldog icon to have a bulldog guide the consumers shop. Feel free to add 2 other changes on top of the 5 that you think is creative.

## Problem 11 — Live app check (output/app_check.html)

### Prompt typed

> Now we work on problem 11. Test the live site and document it inoutput/app_check.html (a page I can double-clickopen). Include clear screenshots and short captions for:
> 1. Chat checking the inventory level of an item (honest stock/price from the DB) 2. The dynamic search-result cards appearing after a category question (e.g. hoodies) 3. One of the usability features I added in Problem 9. And then, make the HTML easy to grade: heading for each check, screenshot, one or two sentenceson what the screenshot proves.  Put the screenshot image files inoutput/app_check_images/ and link them from app_check.html with relative paths (for example app_check_images/inventory.png )

## Problem 12 — Audit trail, safety rules and the finished harness

### Prompt typed

> Now we work on problem 12. Keep an append-only output/audit_trail.json of agent-loop activity (time, tool name,short args/result, stop reason). Do not wipe it between runs. 
> Also, think of some safety rules to give the agent and put them in prompts/prompt.md. Then, Finish output/harness.md so it is clear how the system works. 
> · Model fields in models.pyand why you chose them
> ·Tools and abilities
> ·Safety rules
> ·Specs (loop limits, result caps, models, how to run front + back)

## Problem 13 — Public GitHub repo (hw4)

### Prompt typed

> Now we work on problem 13. Put our code in a folder named hw4 and push it to a public GitHub repository. I need the repo URL that I will submit by myself to some other places. DO NOT put my real .env, campus_customs.db, or product images in the GitHub repo.Use .gitignore. Include .env.example with placeholders only.
> Expected file layout can be found in the picture The agent itself is four files under backend/ : prompts/prompt.md, agent.py, tools.py and models.py. README.md should explain how to run the front end and back end after placing the data pack.

