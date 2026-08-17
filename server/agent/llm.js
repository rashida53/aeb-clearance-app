const { ChatOpenAI } = require('@langchain/openai');

// The one place that knows which LLM provider we use. Hugging Face exposes an
// OpenAI-compatible endpoint (router.huggingface.co/v1), so we drive it with
// LangChain's mature, tool-calling-capable ChatOpenAI. Swapping providers later
// (e.g. to another free tier) is a change to this file alone.
const token = process.env.HF_API_TOKEN;
const modelName = process.env.HF_CHAT_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

let model;
function getChatModel() {
    if (!token) {
        throw new Error('HF_API_TOKEN is not set in server/.env');
    }
    if (!model) {
        model = new ChatOpenAI({
            model: modelName,
            apiKey: token,
            temperature: 0, // deterministic tool selection
            configuration: { baseURL: 'https://router.huggingface.co/v1' },
        });
    }
    return model;
}

module.exports = { getChatModel, modelName };
