const express = require('express');
const jwt = require('jsonwebtoken');
const { streamTurn } = require('../agent/graph');

const secret = process.env.JWT_SECRET || 'clearance-dev-secret';
const router = express.Router();

// Server-side auth — this is the real gate (the React PrivateRoute is only UX).
// Mirrors the JWT verification in utils/auth.js but shaped for a plain Express route.
function verifyToken(req, res, next) {
    let token = req.headers.authorization || req.body.token;
    if (req.headers.authorization) {
        token = token.split(' ').pop().trim();
    }
    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }
    try {
        const { data } = jwt.verify(token, secret);
        req.user = data;
        return next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function requireChatAdmin(req, res, next) {
    const roles = req.user?.roles || [];
    if (!roles.includes('CHAT_ADMIN')) {
        return res.status(403).json({ error: 'CHAT_ADMIN role required' });
    }
    return next();
}

router.post('/chat', verifyToken, requireChatAdmin, async (req, res) => {
    const { message, threadId } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
    }

    // Open a Server-Sent Events stream.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Each event is a JSON object {type:'token'|'trace', text} so newlines/quotes
    // survive the one-frame-per-line SSE format; the client JSON.parses each payload.
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
        // thread_id ties this turn to the conversation's memory. Fall back to the
        // authenticated user's id if the client didn't supply one.
        const thread = threadId || `user:${req.user?.userId || 'anon'}`;
        await streamTurn({ message, threadId: thread, onEvent: (event) => send(event) });
    } catch (err) {
        const rateLimited = /429|rate.?limit/i.test(err.message || '');
        send({
            type: 'token',
            text: rateLimited
                ? '\n\n[The assistant is rate-limited right now. Please try again shortly.]'
                : '\n\n[The assistant hit an error. Please try again.]',
        });
        console.error('chat stream error:', err.message);
    } finally {
        res.write('data: [DONE]\n\n');
        res.end();
    }
});

module.exports = router;
