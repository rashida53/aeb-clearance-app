const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { retrieve } = require('../rag/retriever');

// RAG as a tool: the agent calls this when a question is about policy, process,
// or reference material (rather than database records). It returns relevant
// passages from the Google Docs knowledge base, each with its source doc.
const searchDocs = tool(
    async ({ query }) => {
        try {
            const hits = await retrieve(query, 4);
            if (!hits.length) {
                return JSON.stringify({ results: [], note: 'No relevant documents found.' });
            }
            return JSON.stringify({
                results: hits.map((h) => ({ source: h.source, text: h.text })),
            });
        } catch (err) {
            return JSON.stringify({ error: err.message });
        }
    },
    {
        name: 'search_docs',
        description:
            'Search the community reference documents (the Google Docs knowledge base) for ' +
            'policies, procedures, and how-to/reference information. Use this for questions about ' +
            'how things work or what the rules are — NOT for looking up specific people or records ' +
            '(use the data tools for those). Returns relevant passages with their source.',
        schema: z.object({
            query: z.string().describe('What to look up in the reference docs'),
        }),
    }
);

module.exports = searchDocs;
