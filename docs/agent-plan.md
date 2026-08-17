# Conversational Agent Tab for the AeB Clearance App

## Context

The AeB app has no AI features today (greenfield). We're adding a conversational `/chat` tab, gated to a **new dedicated `CHAT_ADMIN` role** (kept separate from `LETTER_ADMIN` — do not conflate), where those users ask natural-language questions and get natural-language answers, backed by two capabilities:

1. **RAG** over a set of Google Docs (community/finance reference material), kept in sync live.
2. **Read-only MongoDB Q&A across both databases** — `CHAT_ADMIN` users query the app's data by conversation ("who hasn't paid this period?", "how many clearance letters this year?"). Queries can span **both** `clearanceDb` and `fmbDb`; since they are separate physical connections that cannot be `$lookup`-joined, cross-DB "joins" are done in application code (the `$in` + `userMap` idiom).

The purpose is to **learn how a modern agentic chatbot is built** — LLM, RAG, vector DB, tools/skills, the agent loop, memory, and guardrails — using **state-of-the-art libraries and best practices**, with explanations of what each library does and how it works internally (not hand-rolled from scratch). Everything must be **free** and run in the **Heroku-deployed environment**: no local model servers on dynos — the LLM and runtime embeddings are HTTP calls to Hugging Face's free Inference API.

## Finalized decisions

- **Framework**: **LangChain.js** (RAG, embeddings, tools) + **LangGraph.js** (agent loop + memory) — the current best-practice stack; LangGraph replaces the legacy AgentExecutor. Each library's role is explained per phase.
- **LLM**: Hugging Face Inference, free tier, model **`Qwen/Qwen2.5-7B-Instruct`** (strong at instruction-following + tool use). Wrapped via LangChain's HF chat integration behind a thin `server/agent/llm.js` module so the provider can be swapped in one file.
- **Tool-calling strategy (decided)**: native tool-calling first (`model.bindTools`); if the model/endpoint doesn't honor it, **auto-fall back** to LangChain `.withStructuredOutput` — the model returns a validated JSON tool-choice we dispatch. Same behavior; works on any free model. A one-shot JSON "repair" retry handles malformed output.
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (384-dim) via LangChain `HuggingFaceInferenceEmbeddings` (HTTP — no dyno memory cost).
- **Vector DB**: **MongoDB Atlas Vector Search** (real ANN index, free on Atlas; you're already on Atlas) via `@langchain/mongodb` `MongoDBAtlasVectorSearch`. Requires creating a vector search index on the chunks collection (Atlas UI/API — a setup step).
- **Docs ingestion**: **Google Drive API** with a service account for live sync → LangChain splitter → embeddings → Atlas. Re-sync script runnable on-demand and via **Heroku Scheduler**.
- **Access**: entire tab + route + data tools gated to a **new `CHAT_ADMIN` role**, plumbed through client auth, `PrivateRoute`, `Nav`, and the server route (details in Files section). Distinct from `LETTER_ADMIN`.
- **Cross-DB querying**: tools reach both `clearanceDb` and `fmbDb`; the `run_read_filter` whitelist and curated `query_data` tools cover collections from both, each routed to its own connection, with cross-DB joins performed in JS.
- **Memory**: **LangGraph MongoDB checkpointer** (`@langchain/langgraph-checkpoint-mongodb`) — conversations persisted/resumable per admin thread, stored in `clearanceDb`.
- **Transport**: dedicated Express route `POST /api/chat` with **SSE streaming** (LangGraph `.stream()`), reusing the existing JWT — not GraphQL (Apollo v3 here has no streaming).

### Tool-calling on free HF (resolved)
The SOTA agent pattern (LangGraph tool-calling via `model.bindTools`) assumes native tool-calling, which free HF endpoints support inconsistently. Resolved approach: native-first, with an automatic validated structured-output fallback (above). Because `llm.js` is a one-file swap, if free HF proves too weak/rate-limited we can repoint the same agent at another free tier with strong native tool-calling — no other code changes.

## Architecture

```
Browser  /chat tab (React, admin-only)
  │  fetch POST /api/chat  (Bearer JWT; SSE stream back)
  ▼
Express route  server/routes/chat.js   ── verifyToken (reuse utils/auth.js) + require CHAT_ADMIN
  ▼
LangGraph agent  server/agent/graph.js   ← the agent loop (nodes: guard → model → tools → model …)
  ├─ LLM            server/agent/llm.js            (LangChain HF chat, provider-agnostic)
  ├─ Memory         LangGraph MongoDB checkpointer  (thread per admin, in clearanceDb)
  ├─ Guardrails     server/agent/guardrails.js      (topic scope, read-only/PII, refusals)
  └─ Tools          server/agent/tools/*.js
       ├─ search_docs      → RAG retriever over Atlas Vector Search
       ├─ query_data       → curated read-only Mongo queries (Zod-typed)
       └─ run_read_filter  → validated free-form read-only Mongo filter
                      ▲
  Google Drive ──► scripts/syncDocs.js  (Drive export → split → embed → upsert to Atlas)  ──► Atlas Vector Search
```

**Agent loop (LangGraph):** a `StateGraph` with nodes — an input **guard** node, a **model** node that decides to answer or call a tool, a **tools** node that executes the selected tool and appends the result, looping back to the model until it emits a final answer. LangGraph handles state, the loop, streaming, and checkpointed memory; we explain each node's job. This is the "sophisticated agent" spine you want to understand.

## Phase 0 — Chat round-trip (LLM + transport + admin tab)

*Learn: LLM API calls, streaming transport, LangChain chat model, adding a gated tab.*

- Add deps (server): `langchain`, `@langchain/core`, `@langchain/community`, `@huggingface/inference`, `@langchain/langgraph`.
- `server/agent/llm.js` — LangChain HF chat model reading `HF_API_TOKEN`, `HF_CHAT_MODEL`; friendly 429/rate-limit handling.
- **`CHAT_ADMIN` role plumbing** (new role, mirrors the existing role machinery):
  - `client/src/utils/auth.js` — add `isChatAdmin()` returning `roles.includes('CHAT_ADMIN')`.
  - `client/src/utils/PrivateRoute.js` — add `CHAT_ADMIN: Auth.isChatAdmin()` to the `roleChecks` map (line ~19).
  - Assign `CHAT_ADMIN` to the intended admins' records (roles merge from `Member.roles` + `User.roles`; roles are free-form string arrays, no enum change needed).
- `server/routes/chat.js` — `POST /api/chat`; `verifyToken` Express middleware (reuse `jwt.verify` + `JWT_SECRET` from `server/utils/auth.js`) + require `CHAT_ADMIN` in `req.user.roles`; stream tokens as SSE.
- `server/server.js` — mount `app.use('/api', chatRouter)` **before** the production `app.get('*')` SPA fallback (currently line 39); `express.json()` already present (line 30).
- `client/src/pages/chat/Chat.js` — follows the `OpenBalances.js` page pattern (`<><Nav /><div className="pageContainer">…</div></>`); message list + input; reads the SSE stream via `fetch` + `ReadableStream`.
- `client/src/App.js` — `const Chat = lazy(() => import('./pages/chat/Chat'))` + `<Route path="/chat" element={<PrivateRoute requiredRole="CHAT_ADMIN"><Chat/></PrivateRoute>} />`.
- `client/src/components/Nav.js` — add `<Link to="/chat">` in **both** the desktop `navLinks` and `navMobileMenu` blocks, gated by a chat-admin flag (mirror how Review/Takhmeen are gated, but keyed off `CHAT_ADMIN`).
- Env: `HF_API_TOKEN`, `HF_CHAT_MODEL` in `server/.env`.

## Phase 1 — RAG over Google Docs (embeddings + Atlas Vector Search)

*Learn: document loading, chunking, embeddings, a real vector DB, retrieval, RAG prompt augmentation.*

- Add deps: `@langchain/mongodb`, `googleapis`.
- **Google Cloud one-time setup** (documented for you to run): create a service account, enable the Drive API, share the docs folder with the service-account email; download the key JSON → `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_DRIVE_FOLDER_ID` in `server/.env`.
- **Atlas setup**: create a vector search index (dimension 384, cosine) on the chunks collection (Atlas UI/API) — documented steps.
- `server/agent/rag/vectorStore.js` — configure `MongoDBAtlasVectorSearch` (collection in `clearanceDb`, `HuggingFaceInferenceEmbeddings`, the index name).
- `server/agent/rag/retriever.js` — `vectorStore.asRetriever({ k })`; helper that formats retrieved chunks + sources for the prompt.
- `server/scripts/syncDocs.js` — Drive `files.list` in the folder → `files.export` Google Docs to `text/plain` → `RecursiveCharacterTextSplitter` (~800/100 overlap) → embed → upsert into Atlas; track `modifiedTime` to re-embed only changed docs. Runnable via `node` and schedulable with the **Heroku Scheduler** add-on.
- First RAG path: retrieve → stuff chunks into the LLM prompt → answer with citations (becomes the `search_docs` tool in Phase 2).

## Phase 2 — Tools + the LangGraph agent (incl. MongoDB Q&A)

*Learn: tool/skill design, tool-calling, the agent loop, safe read-only data access, agent memory.*

- Add deps: `@langchain/langgraph-checkpoint-mongodb`, `zod`.
- `server/agent/tools/searchDocs.js` — LangChain tool wrapping the Phase 1 retriever.
- `server/agent/tools/queryData.js` — curated read-only queries as Zod-typed tools spanning **both DBs**, built from the reusable resolver idioms: active-user filter (`isActive:{$ne:false}, zone:{$ne:'9'}`), rolling-30-day approval window, and the `$in` + `userMap` idiom for **cross-DB joins in JS** (e.g. `clearanceDb` letters/slots joined to `fmbDb` users). Import models from `server/models/index.js` for correct per-collection DB routing.
- `server/agent/tools/runReadFilter.js` — accepts `{collection, filter, projection, limit}`; whitelist-checks the collection against a map that spans **both** `clearanceDb` and `fmbDb`, forces read-only + a `limit`, strips encrypted ACH fields, routes to the correct connection.
- `server/agent/graph.js` — LangGraph `StateGraph`: guard → model → tools → loop; wire the **MongoDB checkpointer**; `thread_id` per admin conversation. Model node uses native `bindTools`, auto-falling back to `.withStructuredOutput` + JSON-repair retry (decided).
- Early probe: confirm whether `Qwen/Qwen2.5-7B-Instruct` on the HF endpoint honors native tool-calling; the module handles both paths transparently either way.
- **System-prompt schema map** must encode the exploration's quirks: model→collection names (`Commitment`→`localniyyats`, `Takhmeen`→`huqooq`, `Masjid`→`masjid`), which model is in which DB, mixed date formats (`Date` vs epoch-ms `Number` vs `"HH:MM"`), the `"1448-49"` year format, and that ACH fields are encrypted/off-limits.
- Confirm the HF model's tool-calling path here (native vs structured-output fallback).

## Phase 3 — Guardrails

*Learn: scoping an agent, input/output guards, refusals, rate-limit handling.*

- `server/agent/guardrails.js`, wired as the LangGraph **guard node**:
  - **Topic scope (input guard)** — embed the question and compare similarity to the doc corpus + domain seed sentences; below threshold → polite refusal ("I can only help with AeB clearance, finances, and community info"). Reuses the embedding infra (embeddings beyond RAG).
  - **System-prompt scoping** — persona restricted to the site/community/finance/docs.
  - **Output guard** — never surface encrypted/PII fields; read-only only (no write tools exist).
  - **Rate-limit / error handling** — graceful messages on HF free-tier limits.
- Role gating (Phase 0/2) is part of the guardrail story.

## First execution step

Before Phase 0, copy this plan into the repo as `docs/agent-plan.md` (the working copy currently lives in the plans directory, which plan mode restricts edits to). Keep it updated as the build progresses.

## Files to create / modify

- **New (server)**: `server/routes/chat.js`; `server/agent/{llm,graph,guardrails}.js`; `server/agent/rag/{vectorStore,retriever}.js`; `server/agent/tools/{searchDocs,queryData,runReadFilter}.js`; `server/scripts/syncDocs.js`.
- **New (client)**: `client/src/pages/chat/Chat.js` (+ styles).
- **Modify**: `server/server.js` (mount router before SPA fallback), `client/src/App.js` (`CHAT_ADMIN`-gated route), `client/src/components/Nav.js` (chat-admin links, both blocks), `client/src/utils/auth.js` (`isChatAdmin()`), `client/src/utils/PrivateRoute.js` (`CHAT_ADMIN` in `roleChecks`), `server/.env` (`HF_API_TOKEN`, `HF_CHAT_MODEL`, `HF_EMBED_MODEL`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`, `ATLAS_VECTOR_INDEX`), `server/package.json` (deps above). Plus assigning the `CHAT_ADMIN` role to the intended admin records in the data.

## Reused existing patterns

- Page shell: `client/src/pages/openBalances/OpenBalances.js` (`<Nav/>` + `pageContainer`).
- Admin gating machinery: `PrivateRoute` `roleChecks` map + `Auth.is*Admin()` methods (see `/review`, `/takhmeen` gated by `LETTER_ADMIN`); we add `CHAT_ADMIN` the same way rather than reusing `LETTER_ADMIN`.
- JWT verify: `server/utils/auth.js` (`jwt.verify`, `JWT_SECRET`) → adapt into an Express middleware.
- Client auth header: `authLink` in `client/src/App.js:28`.
- DB routing + read idioms: `server/config/connection.js`, `server/models/index.js`, and the `$in`/`userMap` + active-user/date-window patterns in `server/schemas/resolvers.js`.

## Verification

- **Phase 0**: `npm run develop`; as a `CHAT_ADMIN` open `/chat`, send "hello" → streamed reply. Confirm a non-`CHAT_ADMIN` (including a `LETTER_ADMIN` without the new role) doesn't see the tab, is redirected by `PrivateRoute`, and the route rejects them (403) and a missing/invalid token.
- **Phase 1**: run the Google Cloud + Atlas setup; `node server/scripts/syncDocs.js` → chunks appear in Atlas with embeddings; ask a docs-only question → answer cites a source; edit a Doc, re-run sync → only that doc re-embeds.
- **Phase 2**: ask "how many active households?" (fmbDb) and "how many clearance letters this period?" (clearanceDb) → agent calls `query_data`, correct counts (spot-check against Mongo). Ask a **cross-DB** question (e.g. "which active households have a clearance letter this period?") → confirm the JS `$in`+`userMap` join works across both DBs. Ask a follow-up relying on the prior turn → memory works (thread persisted). Confirm ACH fields never appear.
- **Phase 3**: off-topic ("what's the weather?") → refusal; write-style request ("delete user X") → refused; simulate HF 429 → graceful message.
- Throughout: keep `git status` to intended files; `npm run build` before any Heroku deploy; add the Heroku Scheduler job for `syncDocs.js`.
