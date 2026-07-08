import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  SvgIcon,
  TextField,
  Tooltip,
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
import { useChatSessions, type ChatMessage, type ChatSession } from './useChatSessions';

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
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    sessions,
    activeSession,
    startNewChat,
    selectChat,
    deleteChat,
    beginSession,
    appendMessage,
    setSessionHistory,
  } = useChatSessions();

  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession]);

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

    const sessionId = activeSession?.id ?? beginSession(text);
    appendMessage(sessionId, { role: 'user', text });
    setInput('');
    setError(null);
    setLoading(true);

    let turnHistory: GeminiContent[] = [
      ...(activeSession?.history ?? []),
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
          appendMessage(sessionId, { role: 'assistant', text: '(no response)' });
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
          appendMessage(sessionId, { role: 'assistant', text: textParts });
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
          appendMessage(sessionId, {
            role: 'tool',
            name: call.name,
            summary: summarizeToolResult(call.name, result),
          });
          toolResponses.push({
            functionResponse: { name: call.name, response: result },
          });
        }
        turnHistory = [...turnHistory, { role: 'user', parts: toolResponses }];
      }
      setSessionHistory(sessionId, turnHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeSession, beginSession, appendMessage, setSessionHistory, toolCtx]);

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
              alignItems: 'center',
              gap: 0.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" sx={{ flex: 1, minWidth: 0 }} noWrap>
              {showHistory ? 'Chat history' : 'ColCalc Assistant'}
            </Typography>
            <Tooltip title="New chat">
              <IconButton
                size="small"
                aria-label="New chat"
                onClick={() => {
                  startNewChat();
                  setShowHistory(false);
                  setError(null);
                }}
              >
                <SvgIcon fontSize="small">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </SvgIcon>
              </IconButton>
            </Tooltip>
            <Tooltip title="Chat history">
              <IconButton
                size="small"
                aria-label="Chat history"
                color={showHistory ? 'primary' : 'default'}
                onClick={() => setShowHistory((v) => !v)}
              >
                <SvgIcon fontSize="small">
                  <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z" />
                </SvgIcon>
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </IconButton>
          </Box>
          {showHistory ? (
            <ChatHistoryList
              sessions={sessions}
              activeId={activeSession?.id ?? null}
              onSelect={(id) => {
                selectChat(id);
                setShowHistory(false);
                setError(null);
              }}
              onDelete={deleteChat}
            />
          ) : (
            <>
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
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
};

const ChatHistoryList: React.FC<{
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ sessions, activeId, onSelect, onDelete }) => {
  if (sessions.length === 0) {
    return (
      <Box sx={{ flex: 1, p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No previous chats yet. Start a conversation and it will show up here.
        </Typography>
      </Box>
    );
  }
  return (
    <List sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
      {sessions.map((s) => (
        <ListItem
          key={s.id}
          disablePadding
          secondaryAction={
            <Tooltip title="Delete chat">
              <IconButton
                edge="end"
                size="small"
                aria-label={`Delete chat: ${s.title}`}
                onClick={() => onDelete(s.id)}
              >
                <SvgIcon fontSize="small">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </SvgIcon>
              </IconButton>
            </Tooltip>
          }
        >
          <ListItemButton selected={s.id === activeId} onClick={() => onSelect(s.id)}>
            <ListItemText
              primary={s.title}
              secondary={new Date(s.updatedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              slotProps={{
                primary: { noWrap: true },
                secondary: { variant: 'caption' },
              }}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
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
