const INTERNAL_API_HOST = process.env.INTERNAL_API_HOST ?? '127.0.0.1';
const INTERNAL_API_PORT = process.env.INTERNAL_API_PORT;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

export class InternalBotError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 503) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export async function postInternalBot<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  if (!INTERNAL_API_PORT || !INTERNAL_API_TOKEN) {
    throw new InternalBotError('internal_bot_not_configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`http://${INTERNAL_API_HOST}:${INTERNAL_API_PORT}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_API_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new InternalBotError(
        typeof data.error === 'string' ? data.error : `internal_bot_http_${response.status}`,
        response.status,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof InternalBotError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new InternalBotError('internal_bot_timeout');
    }
    throw new InternalBotError('internal_bot_unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
