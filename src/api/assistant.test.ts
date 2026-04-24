import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('callGemini', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws when VITE_GEMINI_API_KEY is not set', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    const mod = await import('./assistant');
    await expect(
      mod.callGemini({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
    ).rejects.toThrow(/Missing VITE_GEMINI_API_KEY/);
    vi.unstubAllEnvs();
  });

  it('sends the API key in x-goog-api-key and returns JSON on success', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'secret-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { role: 'model', parts: [{ text: 'hello' }] } }] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const mod = await import('./assistant');
    const body = { contents: [{ role: 'user' as const, parts: [{ text: 'hi' }] }] };
    const res = await mod.callGemini(body);
    expect(res.candidates?.[0]?.content?.parts?.[0]).toEqual({ text: 'hello' });

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toMatch(/generativelanguage\.googleapis\.com/);
    const init = call[1] as RequestInit;
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('secret-key');
    expect(init.body).toBe(JSON.stringify(body));
    vi.unstubAllEnvs();
  });

  it('throws with the API-provided error message on non-ok response', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'secret');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 403, message: 'Quota exceeded' } }),
    }) as unknown as typeof fetch;

    const mod = await import('./assistant');
    await expect(
      mod.callGemini({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
    ).rejects.toThrow('Quota exceeded');
    vi.unstubAllEnvs();
  });

  it('throws even when response is OK but error is present in body', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'secret');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: { code: 500, message: 'Oops' } }),
    }) as unknown as typeof fetch;

    const mod = await import('./assistant');
    await expect(
      mod.callGemini({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
    ).rejects.toThrow('Oops');
    vi.unstubAllEnvs();
  });
});
