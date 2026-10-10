// Runs on Vercel's servers. Never shipped to the browser.
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'server misconfigured' });

    // Minimal guard so randoms can't burn your quota by hitting the URL directly.
    const origin = req.headers.origin || '';
    const allowed = [
        'https://tommichael88.github.io',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
    ];
    if (origin && !allowed.includes(origin)) {
        return res.status(403).json({ error: 'forbidden origin' });
    }

    try {
        const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,   // ← the key, server-side only
            },
            body: JSON.stringify(req.body),
        });
        const data = await upstream.json();
        return res.status(upstream.status).json(data);
    } catch (err) {
        return res.status(502).json({ error: 'upstream failed' });
    }
}
