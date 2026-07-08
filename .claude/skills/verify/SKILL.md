---
name: verify
description: Build, launch, and drive ColCalc (Vite + React SPA) to verify changes end-to-end in a real browser.
---

# Verifying ColCalc changes

## Node version gotcha
The default nvm Node (v22.2.0) is too old for Vite 7 and breaks vitest/jsdom
(`ERR_REQUIRE_ESM`). Always prepend the newer install:

```bash
export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH"
```

## Launch
```bash
npm install --legacy-peer-deps   # plain `npm install` fails on peer deps; do NOT let it touch yarn.lock
VITE_GEMINI_API_KEY=test-dummy-key npx vite --port 5199 &
```
The assistant (chat FAB, bottom-right) only renders when `VITE_GEMINI_API_KEY`
is set — there is no local `.env`, so pass a dummy key.

## Drive
Playwright is available via `node_modules/playwright` (browsers in
`~/.cache/ms-playwright`; run `npx playwright install chromium` if revisions
mismatch). In a standalone script outside the repo, import by absolute path:

```js
import { chromium } from '/home/victor/Documents/Projects/colcalc/node_modules/playwright/index.mjs';
```

Mock the Gemini endpoint so assistant flows work without a real key:

```js
await page.route('**/generativelanguage.googleapis.com/**', (route) =>
  route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    candidates: [{ content: { role: 'model', parts: [{ text: 'Mock reply' }] } }],
  })}));
```

Useful selectors: `getByRole('button', { name: 'Open assistant' })`,
`getByPlaceholder('Ask anything…')`, `getByRole('button', { name: 'Send' })`.
Assistant chat sessions persist in localStorage under `colcalc_assistant_chats`;
calculator records under `colcalc_records*`.

## Known flakiness
The full `npx vitest run` suite has pre-existing load-related timeouts in
`Calculator.test.tsx` (passes in isolation). Don't attribute those to a change
without checking the clean tree.
