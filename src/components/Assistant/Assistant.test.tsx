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
});

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
