const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { MemorySaver } = require('@langchain/langgraph');
const { getChatModel } = require('./llm');
const { SCHEMA_MAP } = require('./schema');
// RAG: search_docs retrieves passages from the Google Drive knowledge base
// (Docs + Sheets ingested by scripts/syncDocs.js into Atlas Vector Search).
const searchDocs = require('./tools/searchDocs');
const searchQb = require('./tools/searchQb');
const tools = [
    ...require('./tools/queryDb'),
    ...require('./tools/pledges'),
    searchDocs,
    searchQb,
];

const SYSTEM_PROMPT = `You are the assistant for the AeB Umoor Maaliyah app, used by the Anjuman-e-Burhani Austin mosque community to manage finances and clearance.

You answer questions by querying the databases with your tools (data model below). Never guess or invent data — if a tool returns an error or empty result, say so plainly. Break complex questions into multiple tool calls (e.g. look up an id first, then filter another collection by it). Be concise, and present lists and money amounts clearly.

TWO KINDS OF KNOWLEDGE:
- The DATABASES (data tools below) are the source of truth for records about people, events, finances, slots, and letters — use them for anything about specific people or counts.
- search_docs searches the community's reference documents (Google Docs + Sheets: policies, procedures, guidelines, reference tables). Use it for "how does X work / what is the policy / what are the guidelines" questions. When you answer from search_docs, cite the source title. If neither the docs nor the database cover a question, say so.

CRITICAL: Execute tools by actually calling them. Never write a tool name, a query object, or an aggregation pipeline as text or a code block in your reply, and never say you are "about to run" a query. When you need data, call the tool now and wait for its result before answering.

CREATING PLEDGES (write action): use create_pledge to create QuickBooks pledges from people's localniyyats (Commitment) amounts (category default "kr", year default "1448-49"; allUsers:true for everyone). ALWAYS preview first: call create_pledge with confirm:false, show the user exactly what would be created (each person: amount + DocNumber, or the skip reason), and only call again with confirm:true AFTER the user explicitly approves. It is idempotent — pledges already in QuickBooks are skipped — so retries never duplicate.

${SCHEMA_MAP}`;

// Memory: MemorySaver keeps each conversation (keyed by thread_id) in process
// memory so follow-up questions retain context. This is the in-memory version;
// we swap it for the Atlas-backed MongoDB checkpointer next so threads survive
// restarts and are shared across dynos.
const checkpointer = new MemorySaver();

// Today's date in the community's timezone, e.g. "2026-08-18 (Tuesday)".
function currentDateLine() {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Chicago',
            weekday: 'long',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
            .formatToParts(new Date())
            .map((p) => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day} (${parts.weekday})`;
}

let agent;
function getAgent() {
    if (!agent) {
        agent = createReactAgent({
            llm: getChatModel(),
            tools,
            checkpointer,
            // Function prompt so the current date is fresh on every turn (not baked
            // in at startup). Used for relative dates like "the upcoming Sunday".
            prompt: (state) => [
                {
                    role: 'system',
                    content: `/no_think\nCurrent date: ${currentDateLine()}, timezone America/Chicago. Use this for ALL relative dates (today, this/last month, the upcoming Sunday, etc.).\n\n${SYSTEM_PROMPT}`,
                },
                ...state.messages,
            ],
        });
    }
    return agent;
}

function preview(value, max = 160) {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s && s.length > max ? `${s.slice(0, max)}…` : s || '';
}

/**
 * Run one conversation turn and stream events back.
 * LangGraph runs the loop internally: model → (tool calls → tool results →)* → final answer.
 * Two stream modes together:
 *  - 'messages' → incremental assistant answer text, emitted as {type:'token'}
 *  - 'updates'  → whole-node outputs; we surface tool calls and tool results as
 *                 {type:'trace'} so the UI can show the agent's work outside the
 *                 chat bubbles.
 */
async function streamTurn({ message, threadId, onEvent }) {
    const app = getAgent();
    const stream = await app.stream(
        { messages: [{ role: 'user', content: message }] },
        { configurable: { thread_id: threadId }, streamMode: ['messages', 'updates'] }
    );

    let inThinking = false;
    let firstContent = true;

    for await (const [mode, payload] of stream) {
        if (mode === 'messages') {
            const [chunk, meta] = payload;
            if (meta?.langgraph_node !== 'agent') continue;
            const content = chunk?.content;
            if (typeof content === 'string' && content.length) {
                let text = content.replace(/<\/?tool_call>/g, '');
                let out = '';
                for (let i = 0; i < text.length; i++) {
                    if (!inThinking && text.startsWith('<think>', i)) {
                        inThinking = true;
                        i += 6;
                    } else if (inThinking && text.startsWith('</think>', i)) {
                        inThinking = false;
                        i += 7;
                    } else if (!inThinking) {
                        out += text[i];
                    }
                }
                if (firstContent) { out = out.replace(/^\s+/, ''); }
                if (out) { firstContent = false; onEvent({ type: 'token', text: out }); }
            }
        } else if (mode === 'updates') {
            for (const [node, data] of Object.entries(payload)) {
                for (const msg of data?.messages || []) {
                    if (node === 'agent' && msg.tool_calls?.length) {
                        for (const tc of msg.tool_calls) {
                            onEvent({ type: 'trace', text: `${tc.name}(${preview(tc.args)})` });
                        }
                    } else if (node === 'tools') {
                        onEvent({ type: 'trace', text: `↳ ${preview(msg.content)}` });
                        firstContent = true;
                    }
                }
            }
        }
    }
}

module.exports = { streamTurn, getAgent };
