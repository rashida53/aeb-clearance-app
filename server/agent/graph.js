const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { MemorySaver } = require('@langchain/langgraph');
const { getChatModel } = require('./llm');
const { SCHEMA_MAP } = require('./schema');
// RAG (search_docs) is paused for this release — the code lives in
// ./tools/searchDocs.js and ./rag/*; re-add it here once Google Docs ingestion
// (Atlas vector index + syncDocs) is set up.
const tools = require('./tools/queryDb');

const SYSTEM_PROMPT = `You are the assistant for the AeB Umoor Maaliyah app, used by the Anjuman-e-Burhani Austin mosque community to manage finances and clearance.

You answer questions by querying the databases with your tools (data model below). Never guess or invent data — if a tool returns an error or empty result, say so plainly. Break complex questions into multiple tool calls (e.g. look up an id first, then filter another collection by it). Be concise, and present lists and money amounts clearly.

CRITICAL: Execute tools by actually calling them. Never write a tool name, a query object, or an aggregation pipeline as text or a code block in your reply, and never say you are "about to run" a query. When you need data, call the tool now and wait for its result before answering.

${SCHEMA_MAP}`;

// Memory: MemorySaver keeps each conversation (keyed by thread_id) in process
// memory so follow-up questions retain context. This is the in-memory version;
// we swap it for the Atlas-backed MongoDB checkpointer next so threads survive
// restarts and are shared across dynos.
const checkpointer = new MemorySaver();

let agent;
function getAgent() {
    if (!agent) {
        agent = createReactAgent({
            llm: getChatModel(),
            tools,
            checkpointer,
            prompt: SYSTEM_PROMPT,
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

    for await (const [mode, payload] of stream) {
        if (mode === 'messages') {
            const [chunk, meta] = payload;
            if (meta?.langgraph_node !== 'agent') continue;
            const content = chunk?.content;
            if (typeof content === 'string' && content.length) {
                // Some HF-served chat templates leak tool-call markup into the text.
                const clean = content.replace(/<\/?tool_call>/g, '');
                if (clean) onEvent({ type: 'token', text: clean });
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
                    }
                }
            }
        }
    }
}

module.exports = { streamTurn, getAgent };
