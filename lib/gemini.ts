export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Calls Gemini and parses a JSON response. Returns null if the call or parsing fails.
export async function generateJSON<T>(prompt: string): Promise<T | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not configured');
        return null;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
                }),
                cache: 'no-store',
                signal: AbortSignal.timeout(40_000), // fail fast on a dropped connection
            }
        );

        if (!res.ok) {
            console.error('Gemini request failed', res.status, await res.text().catch(() => ''));
            if (res.status === 429 || res.status >= 500) continue;
            return null;
        }

        const data = await res.json();
        const text: string | undefined = data?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text || '')
            .join('');
        if (!text) return null;

        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        return JSON.parse(cleaned) as T;
    } catch (e) {
        console.error(`Gemini error (attempt ${attempt + 1}):`, (e as Error).message);
    }
    }
    return null;
}
