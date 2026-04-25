import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryTable from './HistoryTable';
import type { CalculationRecord } from './logic';

function makeRecord(partial: Partial<CalculationRecord> = {}): CalculationRecord {
  return {
    id: 1,
    city: 'Berlin',
    country: 'Germany',
    income: 5000,
    numberOfKids: 0,
    totalCosts: 2000,
    netBudget: 3000,
    currency: 'EUR',
    ...partial,
  };
}

describe('<HistoryTable /> Export/Import controls', () => {
  it('does not render Export/Import buttons when the callbacks are not wired', () => {
    render(
      <HistoryTable
        records={[makeRecord()]}
        selectedRecordId={null}
        onSelectRecord={() => {}}
        onEditRecord={() => {}}
        onDeleteRecord={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /Export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import/i })).not.toBeInTheDocument();
  });

  it('disables Export when there are no records', () => {
    const onExport = vi.fn();
    render(
      <HistoryTable
        records={[]}
        selectedRecordId={null}
        onSelectRecord={() => {}}
        onEditRecord={() => {}}
        onDeleteRecord={() => {}}
        onExport={onExport}
      />,
    );
    expect(screen.getByRole('button', { name: /Export/i })).toBeDisabled();
  });

  it('calls onExport when Export is clicked', async () => {
    const onExport = vi.fn();
    const user = userEvent.setup();
    render(
      <HistoryTable
        records={[makeRecord()]}
        selectedRecordId={null}
        onSelectRecord={() => {}}
        onEditRecord={() => {}}
        onDeleteRecord={() => {}}
        onExport={onExport}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Export/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('surfaces a success message and forwards the file contents on import', async () => {
    const onImport = vi.fn(() => ({ ok: true as const, imported: 2 }));
    const user = userEvent.setup();
    render(
      <HistoryTable
        records={[]}
        selectedRecordId={null}
        onSelectRecord={() => {}}
        onEditRecord={() => {}}
        onDeleteRecord={() => {}}
        onImport={onImport}
      />,
    );

    // The hidden file input is labelled for a11y.
    const fileInput = screen.getByLabelText(/Import records/i) as HTMLInputElement;
    const file = new File(['[]'], 'records.json', { type: 'application/json' });
    await user.upload(fileInput, file);

    expect(onImport).toHaveBeenCalledWith('[]');
    expect(await screen.findByText(/Imported 2 records\./)).toBeInTheDocument();
  });

  it('surfaces an error message when the importer rejects the file', async () => {
    const onImport = vi.fn(() => ({ ok: false as const, error: 'Bad file' }));
    const user = userEvent.setup();
    render(
      <HistoryTable
        records={[]}
        selectedRecordId={null}
        onSelectRecord={() => {}}
        onEditRecord={() => {}}
        onDeleteRecord={() => {}}
        onImport={onImport}
      />,
    );
    const fileInput = screen.getByLabelText(/Import records/i) as HTMLInputElement;
    const file = new File(['garbage'], 'records.json', { type: 'application/json' });
    await user.upload(fileInput, file);
    expect(await screen.findByText('Bad file')).toBeInTheDocument();
  });
});
