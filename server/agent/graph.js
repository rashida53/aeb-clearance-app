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

/**
 * Run one conversation turn and stream the assistant's text back.
 * LangGraph runs the loop internally: model → (tool calls → tool results →)* → final answer.
 * streamMode 'messages' emits [messageChunk, metadata]; we forward only the
 * assistant text produced by the model node (the "agent" node), skipping the
 * tool node's outputs.
 */
async function streamTurn({ message, threadId, onToken }) {
    const app = getAgent();
    const stream = await app.stream(
        { messages: [{ role: 'user', content: message }] },
        { configurable: { thread_id: threadId }, streamMode: 'messages' }
    );

    for await (const [chunk, meta] of stream) {
        if (meta?.langgraph_node !== 'agent') continue;
        let content = chunk?.content;
        if (typeof content === 'string' && content.length) {
            // Some HF-served chat templates leak tool-call markup into the text.
            content = content.replace(/<\/?tool_call>/g, '');
            if (content) onToken(content);
        }
    }
}

module.exports = { streamTurn, getAgent };
