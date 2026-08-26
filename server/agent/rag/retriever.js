const { clearanceDb } = require('../../config/connection');
const { getEmbeddings } = require('./embeddings');
const { COLLECTION, INDEX } = require('./vectorStore');

async function retrieve(query, k = 4) {
    await clearanceDb.asPromise();
    const col = clearanceDb.db.collection(COLLECTION);
    const embeddings = getEmbeddings();
    const vector = await embeddings.embedQuery(query);

    const results = await col.aggregate([
        {
            $vectorSearch: {
                index: INDEX,
                path: 'embedding',
                queryVector: vector,
                numCandidates: 10 * k,
                limit: k,
            },
        },
        {
            $project: {
                score: { $meta: 'vectorSearchScore' },
                text: 1,
                'metadata.title': 1,
                'metadata.source': 1,
            },
        },
    ]).toArray();

    return results.map((doc) => ({
        text: doc.text,
        source: doc.metadata?.title || doc.metadata?.source,
        score: doc.score,
    }));
}

module.exports = { retrieve };
