import { useCallback, useEffect, useState } from 'react';
import type { GeminiContent } from '../../api/assistant';

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; name: string; summary: string };

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  history: GeminiContent[];
};

export const CHATS_STORAGE_KEY = 'colcalc_assistant_chats';

/** Oldest sessions are dropped past this cap so localStorage stays bounded. */
const MAX_SESSIONS = 50;

function parseSessions(raw: string | null): ChatSession[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is ChatSession =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as ChatSession).id === 'string' &&
        typeof (s as ChatSession).title === 'string' &&
        typeof (s as ChatSession).updatedAt === 'string' &&
        Array.isArray((s as ChatSession).messages) &&
        Array.isArray((s as ChatSession).history),
    );
  } catch {
    return [];
  }
}

function makeTitle(firstUserText: string): string {
  const oneLine = firstUserText.trim().replace(/\s+/g, ' ');
  if (!oneLine) return 'New chat';
  return oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine;
}

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Result = {
  /** All sessions, most recently updated first. */
  sessions: ChatSession[];
  /** The session currently shown in the drawer, or null for a fresh chat. */
  activeSession: ChatSession | null;
  /** Switch to a blank chat; a session is only created once a message is sent. */
  startNewChat: () => void;
  /** Open a previous chat by id. */
  selectChat: (id: string) => void;
  /** Remove a chat; if it was active, falls back to a blank chat. */
  deleteChat: (id: string) => void;
  /** Create a session titled after the first user message and make it active. */
  beginSession: (firstUserText: string) => string;
  /** Append a rendered message to a session. */
  appendMessage: (id: string, message: ChatMessage) => void;
  /** Replace a session's Gemini turn history after a completed exchange. */
  setSessionHistory: (id: string, history: GeminiContent[]) => void;
};

/**
 * Persisted assistant chat sessions.
 *
 * Sessions live in localStorage so conversations survive closing the drawer
 * or reloading. The active chat starts blank; the session record is created
 * lazily on the first message so "New chat" never litters empty sessions.
 */
export function useChatSessions(): Result {
  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    typeof localStorage !== 'undefined'
      ? parseSessions(localStorage.getItem(CHATS_STORAGE_KEY))
      : [],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  const startNewChat = useCallback(() => setActiveId(null), []);

  const selectChat = useCallback((id: string) => setActiveId(id), []);

  const deleteChat = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const beginSession = useCallback((firstUserText: string): string => {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: makeId(),
      title: makeTitle(firstUserText),
      createdAt: now,
      updatedAt: now,
      messages: [],
      history: [],
    };
    setSessions((prev) => [session, ...prev].slice(0, MAX_SESSIONS));
    setActiveId(session.id);
    return session.id;
  }, []);

  const appendMessage = useCallback((id: string, message: ChatMessage) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, messages: [...s.messages, message], updatedAt: new Date().toISOString() }
          : s,
      ),
    );
  }, []);

  const setSessionHistory = useCallback((id: string, history: GeminiContent[]) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, history, updatedAt: new Date().toISOString() } : s,
      ),
    );
  }, []);

  const sorted = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    sessions: sorted,
    activeSession,
    startNewChat,
    selectChat,
    deleteChat,
    beginSession,
    appendMessage,
    setSessionHistory,
  };
}
