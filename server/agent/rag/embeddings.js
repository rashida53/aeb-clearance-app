const { Embeddings } = require('@langchain/core/embeddings');
const { InferenceClient } = require('@huggingface/inference');

// An embedding is a fixed-length list of numbers (here 384) that captures the
// *meaning* of a piece of text — similar text → nearby vectors. We call Hugging
// Face's feature-extraction endpoint to compute them. This class implements
// LangChain's Embeddings interface (embedQuery / embedDocuments) so the Atlas
// vector store can drive it. Like llm.js, this is a provider seam — swap the
// model or provider here without touching the rest of RAG.
const token = process.env.HF_API_TOKEN;
const embedModel = process.env.HF_EMBED_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';

// Some models return one pooled vector per input; others return a vector per
// token. If we get token-level vectors, mean-pool them into a single sentence
// vector so every text maps to exactly one 384-dim vector.
function toVector(result) {
    if (Array.isArray(result) && Array.isArray(result[0])) {
        const rows = result;
        const dim = rows[0].length;
        const acc = new Array(dim).fill(0);
        for (const row of rows) for (let i = 0; i < dim; i++) acc[i] += row[i];
        return acc.map((v) => v / rows.length);
    }
    return result;
}

class HFEmbeddings extends Embeddings {
    constructor() {
        super({});
        this.client = null;
    }

    _client() {
        if (!token) throw new Error('HF_API_TOKEN is not set in server/.env');
        if (!this.client) this.client = new InferenceClient(token);
        return this.client;
    }

    async embedQuery(text) {
        const res = await this._client().featureExtraction({ model: embedModel, inputs: text });
        return toVector(res);
    }

    async embedDocuments(texts) {
        if (!texts.length) return [];
        const res = await this._client().featureExtraction({ model: embedModel, inputs: texts });
        // For an array input, HF returns one entry per text.
        return res.map(toVector);
    }
}

let embeddings;
function getEmbeddings() {
    if (!embeddings) embeddings = new HFEmbeddings();
    return embeddings;
}

module.exports = { getEmbeddings, embedModel };
