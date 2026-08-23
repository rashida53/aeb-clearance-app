import React, { useEffect, useRef, useState } from 'react';
import Nav from '../../components/Nav';
import Auth from '../../utils/auth';
import './Chat.css';

const WELCOME = {
    role: 'assistant',
    content: "Let's talk!",
};

const SUGGESTED_PROMPTS = [
    "Show me Hamza Karachiwala's Open Pledges",
    'How many active users do we have',
    'Show me everyone in Zone 4',
    "What was Murtaza Rawat's Wajebaat last year",
];

// Module-scoped cache so the conversation survives navigating away from and back
// to the tab (the component unmounts, but this module stays loaded). A full page
// refresh reloads the module and resets it — i.e. it sticks until you refresh.
let cachedMessages = [WELCOME];
let cachedThreadId = null;

const Chat = () => {
    const [messages, setMessages] = useState(cachedMessages);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState('');

    // Reuse the same thread id across remounts so the backend memory (keyed by
    // thread_id) stays continuous; a page refresh mints a fresh one.
    const threadId = useRef(
        cachedThreadId || (window.crypto?.randomUUID?.() || String(Date.now()))
    );
    cachedThreadId = threadId.current;

    // Persist messages to the module cache whenever they change.
    useEffect(() => {
        cachedMessages = messages;
    }, [messages]);

    const bottomRef = useRef(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = (e) => {
        e.preventDefault();
        runQuery(input);
    };

    const runQuery = async (raw) => {
        const text = (raw || '').trim();
        if (!text || streaming) return;

        setError('');
        setInput('');
        // Show the user's message. The assistant bubble and any trace lines are
        // created lazily as events stream in (traces appear above the answer).
        setMessages((prev) => [...prev, { role: 'user', content: text }]);
        setStreaming(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Auth.getToken()}`,
                },
                body: JSON.stringify({ message: text, threadId: threadId.current }),
            });

            if (!res.ok) {
                const detail = await res.text().catch(() => '');
                throw new Error(
                    res.status === 403
                        ? 'You do not have access to the assistant.'
                        : `Request failed (${res.status}). ${detail}`
                );
            }

            // Read the Server-Sent Events stream frame by frame; each frame is a
            // JSON event: {type:'token'} = answer text, {type:'trace'} = agent work.
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const frames = buffer.split('\n\n');
                buffer = frames.pop() || '';

                for (const frame of frames) {
                    const line = frame.split('\n').find((l) => l.startsWith('data:'));
                    if (!line) continue;
                    const data = line.slice(5).trim();
                    if (data === '[DONE]') continue;
                    let evt;
                    try {
                        evt = JSON.parse(data);
                    } catch {
                        evt = { type: 'token', text: data };
                    }
                    if (evt.type === 'trace') appendTrace(evt.text);
                    else appendToAssistant(evt.text || '');
                }
            }
        } catch (err) {
            setError(err.message || 'Something went wrong.');
        } finally {
            setStreaming(false);
        }
    };

    // Append answer text to the current assistant bubble, creating it lazily if
    // the last item isn't an assistant bubble (so trace lines stay above it).
    const appendToAssistant = (delta) => {
        if (!delta) return;
        setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + delta };
            } else {
                next.push({ role: 'assistant', content: delta });
            }
            return next;
        });
    };

    // Agent thinking / tool activity — shown as small italic lines outside bubbles.
    const appendTrace = (text) => {
        setMessages((prev) => [...prev, { role: 'trace', content: text }]);
    };

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="chatHeader">
                    <h1>Assistant</h1>
                </div>

                <div className="chatWindow">
                    {messages.map((m, i) => {
                        if (m.role === 'trace') return <div key={i} className="chatTrace">{m.content}</div>;
                        if (m.role === 'assistant' && !m.content?.trim()) return null;
                        return (
                            <div key={i} className={`chatMessage ${m.role}`}>
                                <div className="chatBubble">{m.content}</div>
                            </div>
                        );
                    })}
                    {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
                        <div className="chatTrace">…</div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {error && <div className="formSubmitError">{error}</div>}

                <form className="chatInputRow" onSubmit={sendMessage}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your question…"
                        disabled={streaming}
                    />
                    <button type="submit" disabled={streaming || !input.trim()}>
                        {streaming ? 'Thinking…' : 'Send'}
                    </button>
                </form>

                {messages.length <= 1 && (
                    <div className="chatSuggestions">
                        {SUGGESTED_PROMPTS.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                className="chatSuggestion"
                                onClick={() => runQuery(prompt)}
                                disabled={streaming}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default Chat;
