const { MongoDBAtlasVectorSearch } = require('@langchain/mongodb');
const { clearanceDb } = require('../../config/connection');
const { getEmbeddings } = require('./embeddings');

// Where chunks + their vectors live. The Atlas Vector Search index must be
// created on this collection (see setup notes) with numDimensions 384 and
// cosine similarity, named to match ATLAS_VECTOR_INDEX.
const COLLECTION = 'docChunks';
const INDEX = process.env.ATLAS_VECTOR_INDEX || 'docchunks_vector_index';
const TEXT_KEY = 'text';       // field holding the chunk text
const EMBEDDING_KEY = 'embedding'; // field holding the 384-dim vector

async function getVectorStore() {
    await clearanceDb.asPromise();
    const collection = clearanceDb.db.collection(COLLECTION);
    return new MongoDBAtlasVectorSearch(getEmbeddings(), {
        collection,
        indexName: INDEX,
        textKey: TEXT_KEY,
        embeddingKey: EMBEDDING_KEY,
    });
}

module.exports = { getVectorStore, COLLECTION, INDEX, TEXT_KEY, EMBEDDING_KEY };
