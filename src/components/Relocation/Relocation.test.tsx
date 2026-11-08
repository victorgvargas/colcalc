import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationReport, ProfileEditor, WorkspaceDashboard } from './index';
import { WorkspaceProvider } from '../../relocation/WorkspaceContext';
import { STORAGE_KEY } from '../../relocation/model';

vi.mock('../../api/costOfLiving', () => ({
  fetchDatasetCities: async () => [{ city: 'Lisbon', country: 'Portugal', prices: [{ category: 'Rent', item: 'Apartment (1 bedroom) Outside of Centre', usd: 900 }] }],
  fetchDatasetMeta: async () => ({ source: 'Test city prices', generatedAt: '2026-01-01' }),
}));
function app(path = '/onboarding') {
  return render(<MemoryRouter initialEntries={[path]}><WorkspaceProvider><Routes>
    <Route path="/onboarding" element={<ProfileEditor />} />
    <Route path="/app" element={<WorkspaceDashboard />} />
    <Route path="/app/reports/:id" element={<DestinationReport />} />
  </Routes></WorkspaceProvider></MemoryRouter>);
}
beforeEach(() => localStorage.clear());
describe('relocation planning flow', () => {
  it('creates, persists and reopens a report without implying a complete estimate', async () => {
    const first = app();
    await screen.findByRole('option', { name: 'Portugal · Lisbon' });
    fireEvent.change(screen.getByLabelText('Destination city'), { target: { value: JSON.stringify(['Lisbon', 'Portugal']) } });
    fireEvent.click(screen.getByRole('button', { name: /Create my destination report/ }));
    expect(await screen.findByRole('heading', { name: 'Your next chapter in Lisbon.' })).toBeInTheDocument();
    expect(screen.getByText('Not yet known')).toBeInTheDocument();
    expect(screen.getByText('Reviewed coverage unavailable')).toBeInTheDocument();
    expect(screen.getByText('Test city prices', { exact: false })).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.reports).toHaveLength(1);
    first.unmount();
    app(`/app/reports/${saved.reports[0].id}`);
    expect(screen.getByRole('heading', { name: 'Your next chapter in Lisbon.' })).toBeInTheDocument();
  });
  it('persists checklist progress and handles absent report IDs', async () => {
    const first = app('/app');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).completedTasks).toEqual(['rights']));
    first.unmount();
    app('/app/reports/not-a-report');
    expect(screen.getByRole('heading', { name: 'Report not found on this device.' })).toBeInTheDocument();
  });
  it('keeps the user on the form and shows an error if persistence fails', async () => {
    app();
    await screen.findByRole('option', { name: 'Portugal · Lisbon' });
    fireEvent.change(screen.getByLabelText('Destination city'), { target: { value: JSON.stringify(['Lisbon', 'Portugal']) } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    fireEvent.click(screen.getByRole('button', { name: /Create my destination report/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('could not save');
    expect(screen.getByRole('heading', { name: 'First, a little about your move.' })).toBeInTheDocument();
  });
});
