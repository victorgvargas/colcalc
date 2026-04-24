import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import type { CalculationRecord } from './logic';

type Props = {
  record: CalculationRecord | null;
  onClose: () => void;
  onSave: (update: { income: number; numberOfKids: number }) => void;
};

const EditRecordDialog: React.FC<Props> = ({ record, onClose, onSave }) => {
  const [editIncome, setEditIncome] = useState('');
  const [editNumberOfKids, setEditNumberOfKids] = useState(0);

  useEffect(() => {
    if (!record) return;
    setEditIncome(String(record.income));
    setEditNumberOfKids(record.numberOfKids ?? 0);
  }, [record]);

  const handleSave = () => {
    if (!record) return;
    const newIncome = Number(editIncome);
    const newKids = Math.max(0, Math.floor(Number(editNumberOfKids)) || 0);
    if (!Number.isFinite(newIncome) || newIncome < 0) return;
    onSave({ income: newIncome, numberOfKids: newKids });
  };

  const hasTax = typeof record?.taxRate === 'number';

  return (
    <Dialog open={record !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit record</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label={hasTax ? 'Gross income' : 'Income'}
            type="number"
            fullWidth
            value={editIncome}
            onChange={(e) => setEditIncome(e.target.value)}
            inputProps={{ min: 0, step: 100 }}
            helperText={
              hasTax
                ? `Net budget applies ${(record!.taxRate! * 100).toFixed(1)}% tax`
                : undefined
            }
          />
          <TextField
            label="Number of kids"
            type="number"
            fullWidth
            value={editNumberOfKids}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setEditNumberOfKids(Number.isNaN(n) || n < 0 ? 0 : n);
            }}
            inputProps={{ min: 0, step: 1 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditRecordDialog;
