const { getVectorStore } = require('./vectorStore');

// Embed the question and return the k most semantically similar chunks. The
// vector store does the work: embedQuery(query) → $vectorSearch on the Atlas
// index → nearest chunks by cosine similarity, with a relevance score.
async function retrieve(query, k = 4) {
    const store = await getVectorStore();
    const results = await store.similaritySearchWithScore(query, k);
    return results.map(([doc, score]) => ({
        text: doc.pageContent,
        source: doc.metadata?.source,
        score,
    }));
}

module.exports = { retrieve };
