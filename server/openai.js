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

async function callOpenAIChatCompletions({
  apiKey,
  baseUrl,
  model,
  prompt,
  systemContent,
  timeoutMs,
  temperature = 0.1,
  maxTokens,
  messages
}) {
  const url = new URL('/v1/chat/completions', baseUrl);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const chatMessages = messages || [
    { role: 'system', content: systemContent || 'You are a helpful assistant. Return only valid JSON when asked.' },
    { role: 'user', content: prompt }
  ];
  const body = {
    model,
    temperature,
    messages: chatMessages
  };
  if (maxTokens != null && Number.isFinite(maxTokens)) {
    body.max_tokens = maxTokens;
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
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

function getOpenAIVisionConfig() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
  const timeoutMs = Math.min(60000, Math.max(5000, Number(process.env.IMPORTED_INVOICE_LLM_TIMEOUT_MS || 30000)));
  return { apiKey, model, baseUrl, timeoutMs };
}

async function callOpenAIVision({ apiKey, baseUrl, model, imageBase64, mimeType, prompt, systemContent, timeoutMs, temperature = 0.1 }) {
  const url = new URL('/v1/chat/completions', baseUrl);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const dataUrl = `data:${mimeType};base64,${imageBase64}`;
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
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
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

module.exports = {
  parseLlmJson,
  callOpenAIChatCompletions,
  callOpenAIVision,
  getOpenAIConfig,
  getOpenAIVisionConfig
};
