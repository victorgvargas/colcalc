import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  Fab,
  IconButton,
  SvgIcon,
  TextField,
  Typography,
  CircularProgress,
  Paper,
  Button,
} from '@mui/material';
import {
  callGemini,
  geminiApiKey,
  type GeminiContent,
  type GeminiPart,
} from '../../api/assistant';
import { runTool, TOOL_DECLARATIONS } from '../../assistant/appActions';

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; name: string; summary: string };

const SYSTEM_INSTRUCTION = `You are ColCalc Assistant, an AI helper embedded in a cost-of-living and tax calculator app.
You can answer questions about cost of living, income tax, purchasing power, and exchange rates, and you can perform actions inside the app via the provided tools.

Guidelines:
- Prefer calling a tool over guessing. For example, if the user asks "how much tax on 60k in Germany", call estimate_income_tax with countryCode="de".
- Before destructive actions (delete_record, clear_all_records), ask the user to confirm explicitly.
- When the user asks to do something in the UI ("open the tax calculator", "prefill Amsterdam"), call navigate_to or prefill_calculator.
- Keep replies concise — 1-3 sentences plus any numbers. Use the user's locale currency symbols when obvious.
- Don't invent cities that aren't in the dataset. If unsure, call search_cities first.`;

const MAX_TOOL_TURNS = 6;

function extractParts(content: GeminiContent | undefined): GeminiPart[] {
  return content?.parts ?? [];
}

const Assistant: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<GeminiContent[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  const toolCtx = useMemo(
    () => ({ currentPath: location.pathname, navigate: (path: string, state?: unknown) => navigate(path, { state }) }),
    [location.pathname, navigate],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const nextUserMessage: ChatMessage = { role: 'user', text };
    setMessages((m) => [...m, nextUserMessage]);
    setInput('');
    setError(null);
    setLoading(true);

    let turnHistory: GeminiContent[] = [
      ...history,
      { role: 'user', parts: [{ text }] },
    ];

    try {
      for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
        const response = await callGemini({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: turnHistory,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS as unknown as typeof TOOL_DECLARATIONS[number][] }],
        });

        const modelContent = response.candidates?.[0]?.content;
        const parts = extractParts(modelContent);
        if (!parts.length) {
          setMessages((m) => [...m, { role: 'assistant', text: '(no response)' }]);
          break;
        }

        turnHistory = [...turnHistory, { role: 'model', parts }];

        const functionCalls = parts.flatMap((p) =>
          'functionCall' in p ? [p.functionCall] : [],
        );
        const textParts = parts
          .flatMap((p) => ('text' in p ? [p.text] : []))
          .join('\n')
          .trim();

        if (textParts) {
          setMessages((m) => [...m, { role: 'assistant', text: textParts }]);
        }

        if (!functionCalls.length) break;

        const toolResponses: GeminiPart[] = [];
        for (const call of functionCalls) {
          let result;
          try {
            result = await runTool(call.name, call.args ?? {}, toolCtx);
          } catch (err) {
            result = { ok: false, error: err instanceof Error ? err.message : String(err) };
          }
          setMessages((m) => [
            ...m,
            {
              role: 'tool',
              name: call.name,
              summary: summarizeToolResult(call.name, result),
            },
          ]);
          toolResponses.push({
            functionResponse: { name: call.name, response: result },
          });
        }
        turnHistory = [...turnHistory, { role: 'user', parts: toolResponses }];
      }
      setHistory(turnHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, history, toolCtx]);

  if (!geminiApiKey) return null;

  return (
    <>
      <Fab
        color="primary"
        onClick={() => setOpen(true)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}
        aria-label="Open assistant"
      >
        <SvgIcon>
          <path d="M12 2a3 3 0 0 1 3 3v1h1a4 4 0 0 1 4 4v1h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v1a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-1H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1v-1a4 4 0 0 1 4-4h1V5a3 3 0 0 1 2-2.83V2zm-2.5 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
        </SvgIcon>
      </Fab>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 } } } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6">ColCalc Assistant</Typography>
            <IconButton size="small" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </IconButton>
          </Box>
          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {messages.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Ask about cost of living, taxes, or navigate around the app. Try:
                <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                  <li>"How much is the tax on $80k in Germany?"</li>
                  <li>"Show my saved records"</li>
                  <li>"Compare Amsterdam and Lisbon"</li>
                  <li>"Take me to the purchasing power page"</li>
                </Box>
              </Typography>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Thinking…
                </Typography>
              </Box>
            )}
            {error && (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            )}
          </Box>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              gap: 1,
            }}
          >
            <TextField
              size="small"
              fullWidth
              placeholder="Ask anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
            <Button type="submit" variant="contained" disabled={loading || !input.trim()}>
              Send
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  if (message.role === 'tool') {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          bgcolor: 'action.hover',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          alignSelf: 'stretch',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          tool · {message.name}
        </Typography>
        <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.summary}
        </Box>
      </Paper>
    );
  }
  const isUser = message.role === 'user';
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        bgcolor: isUser ? 'primary.main' : 'grey.100',
        color: isUser ? 'primary.contrastText' : 'text.primary',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        borderRadius: 2,
      }}
    >
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {message.text}
      </Typography>
    </Paper>
  );
};

function summarizeToolResult(name: string, result: unknown): string {
  try {
    const json = JSON.stringify(result, null, 2);
    return json.length > 400 ? `${json.slice(0, 400)}…` : json;
  } catch {
    return `(ran ${name})`;
  }
}

export default Assistant;
