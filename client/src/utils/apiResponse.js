export async function readApiJson(res) {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Server returned invalid JSON. Restart the backend and try again.');
    }
  }

  if (text.trimStart().startsWith('<')) {
    throw new Error(
      'Server returned a web page instead of JSON. Restart the backend (npm run dev) and try again.'
    );
  }

  if (text.startsWith('Cannot POST') || text.startsWith('Cannot GET')) {
    throw new Error(
      'API route not found. Stop and restart the backend (npm run dev), then try again.'
    );
  }

  throw new Error(text.slice(0, 240) || `Request failed (${res.status})`);
}
