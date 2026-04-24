/**
 * Minimal Gemini REST client for the in-app assistant.
 * Free-tier key lives in VITE_GEMINI_API_KEY; if absent, the assistant UI stays hidden.
 *
 * Using gemini-2.5-flash-lite — free tier is available for this model on the
 * standard API key; gemini-2.0-flash and 2.5-flash return quota-zero/503 on free keys.
 */

const MODEL = 'gemini-2.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const geminiApiKey: string | undefined = import.meta.env.VITE_GEMINI_API_KEY;

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiPart[];
};

export type GeminiToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type GeminiRequest = {
  system_instruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
  tools?: { functionDeclarations: GeminiToolDeclaration[] }[];
};

export type GeminiResponse = {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  error?: { code: number; message: string; status?: string };
};

export async function callGemini(body: GeminiRequest): Promise<GeminiResponse> {
  if (!geminiApiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY.');
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiApiKey,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as GeminiResponse;
  if (!res.ok || json.error) {
    const msg = json.error?.message || `Gemini API error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}
