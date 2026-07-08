import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock the assistant module so we can toggle geminiApiKey and spy on callGemini.
vi.mock('../../api/assistant', () => ({
  callGemini: vi.fn(),
  geminiApiKey: 'test-key',
}));
vi.mock('../../assistant/appActions', () => ({
  runTool: vi.fn(),
  TOOL_DECLARATIONS: [],
}));

import { callGemini } from '../../api/assistant';
import { runTool } from '../../assistant/appActions';
import Assistant from './index';

function renderAssistant() {
  return render(
    <MemoryRouter>
      <Assistant />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(callGemini).mockReset();
  vi.mocked(runTool).mockReset();
  localStorage.clear();
});

/** Queue a single plain-text model reply. */
function mockReply(text: string) {
  vi.mocked(callGemini).mockResolvedValueOnce({
    candidates: [{ content: { role: 'model', parts: [{ text }] } }],
  });
}

async function sendMessage(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByPlaceholderText(/Ask anything/i), text);
  await user.click(screen.getByRole('button', { name: /Send/i }));
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('<Assistant />', () => {
  it('renders a Fab trigger and opens the drawer on click', async () => {
    const user = userEvent.setup();
    renderAssistant();

    const fab = screen.getByRole('button', { name: /open assistant/i });
    expect(fab).toBeInTheDocument();
    await user.click(fab);

    expect(screen.getByRole('heading', { name: /ColCalc Assistant/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument();
  });

  it('sends a user message and displays the model reply', async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'Hi there, I can help.' }],
          },
        },
      ],
    });

    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: /open assistant/i }));

    await user.type(screen.getByPlaceholderText(/Ask anything/i), 'Hello');
    await user.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() =>
      expect(screen.getByText('Hi there, I can help.')).toBeInTheDocument(),
    );
    expect(callGemini).toHaveBeenCalledTimes(1);
    // User message also rendered.
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('invokes tools when the model returns a functionCall, then follows up', async () => {
    vi.mocked(callGemini)
      .mockResolvedValueOnce({
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                { functionCall: { name: 'list_saved_records', args: {} } },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        candidates: [
          {
            content: { role: 'model', parts: [{ text: 'You have 0 records.' }] },
          },
        ],
      });
    vi.mocked(runTool).mockResolvedValue({ count: 0, records: [] });

    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: /open assistant/i }));

    await user.type(screen.getByPlaceholderText(/Ask anything/i), 'How many records do I have?');
    await user.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => expect(runTool).toHaveBeenCalledWith(
      'list_saved_records',
      {},
      expect.objectContaining({ currentPath: '/' }),
    ));
    await waitFor(() =>
      expect(screen.getByText('You have 0 records.')).toBeInTheDocument(),
    );
    // Tool trace bubble should appear.
    expect(screen.getByText(/tool · list_saved_records/i)).toBeInTheDocument();
  });

  it('shows an error when callGemini throws', async () => {
    vi.mocked(callGemini).mockRejectedValue(new Error('Quota exceeded'));
    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: /open assistant/i }));

    await user.type(screen.getByPlaceholderText(/Ask anything/i), 'Hi');
    await user.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() =>
      expect(screen.getByText('Quota exceeded')).toBeInTheDocument(),
    );
  });

  it('keeps the send button disabled until the user types', async () => {
    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: /open assistant/i }));

    const send = screen.getByRole('button', { name: /Send/i });
    expect(send).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Ask anything/i), 'hello');
    expect(send).not.toBeDisabled();
  });
});

describe('<Assistant /> chat sessions', () => {
  it('starts a fresh conversation via the New chat button', async () => {
    mockReply('First chat reply.');
    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: /open assistant/i }));

    await sendMessage(user, 'Hello there');
    await waitFor(() => expect(screen.getByText('First chat reply.')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^New chat$/i }));

    expect(screen.queryByText('First chat reply.')).not.toBeInTheDocument();
    expect(screen.queryByText('Hello there')).not.toBeInTheDocument();
    // Empty-state hint shows again on a blank chat.
    expect(screen.getByText(/Ask about cost of living/i)).toBeInTheDocument();
  });

  it('lists previous chats in history and restores one on click', async () => {
    mockReply('Reply about Berlin.');
    mockReply('Reply about Lisbon.');
    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: /open assistant/i }));

    await sendMessage(user, 'Tell me about Berlin');
    await waitFor(() => expect(screen.getByText('Reply about Berlin.')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^New chat$/i }));
    await sendMessage(user, 'Tell me about Lisbon');
    await waitFor(() => expect(screen.getByText('Reply about Lisbon.')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^Chat history$/i }));
    expect(screen.getByRole('heading', { name: /Chat history/i })).toBeInTheDocument();
    expect(screen.getByText('Tell me about Berlin')).toBeInTheDocument();
    expect(screen.getByText('Tell me about Lisbon')).toBeInTheDocument();

    await user.click(screen.getByText('Tell me about Berlin'));
    // Back in conversation view with the old messages restored.
    expect(screen.getByText('Reply about Berlin.')).toBeInTheDocument();
    expect(screen.queryByText('Reply about Lisbon.')).not.toBeInTheDocument();
  });

  it('deletes a chat from the history list', async () => {
    mockReply('Some reply.');
    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: /open assistant/i }));

    await sendMessage(user, 'Disposable chat');
    await waitFor(() => expect(screen.getByText('Some reply.')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^Chat history$/i }));
    await user.click(
      screen.getByRole('button', { name: /Delete chat: Disposable chat/i }),
    );

    expect(screen.queryByText('Disposable chat')).not.toBeInTheDocument();
    expect(screen.getByText(/No previous chats yet/i)).toBeInTheDocument();
  });

  it('persists chats to localStorage', async () => {
    mockReply('Persisted reply.');
    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: /open assistant/i }));

    await sendMessage(user, 'Remember me');
    await waitFor(() => expect(screen.getByText('Persisted reply.')).toBeInTheDocument());

    const stored = JSON.parse(localStorage.getItem('colcalc_assistant_chats') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Remember me');
    expect(stored[0].messages).toEqual([
      { role: 'user', text: 'Remember me' },
      { role: 'assistant', text: 'Persisted reply.' },
    ]);
  });
});

describe('<Assistant /> without an API key', () => {
  it('renders nothing when geminiApiKey is missing', async () => {
    vi.resetModules();
    vi.doMock('../../api/assistant', () => ({
      callGemini: vi.fn(),
      geminiApiKey: undefined,
    }));
    const fresh = await import('./index');
    const { container } = render(
      <MemoryRouter>
        <fresh.default />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
    vi.doUnmock('../../api/assistant');
  });
});
