function parseLlmJson(content) {
  const trimmed = String(content || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(raw);
  } catch (firstErr) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (_) {
        // fall through
      }
    }
    throw new Error(`Could not parse JSON from model response: ${firstErr.message}`);
  }
}

async function callOpenAIChatCompletions({ apiKey, baseUrl, model, prompt, systemContent, timeoutMs, temperature = 0.1 }) {
  const url = new URL('/v1/chat/completions', baseUrl);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          { role: 'system', content: systemContent || 'You are a helpful assistant. Return only valid JSON when asked.' },
          { role: 'user', content: prompt }
        ]
      }),
      signal: controller.signal
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`LLM HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM response missing message content');
    return content;
  } finally {
    clearTimeout(t);
  }
}

function getOpenAIConfig() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
  const timeoutMs = Math.min(15000, Math.max(2000, Number(process.env.HSN_SAC_LLM_TIMEOUT_MS || 8000)));
  return { apiKey, model, baseUrl, timeoutMs };
}

module.exports = {
  parseLlmJson,
  callOpenAIChatCompletions,
  getOpenAIConfig
};
