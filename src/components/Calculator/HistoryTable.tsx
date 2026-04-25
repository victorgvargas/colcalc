import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  IconButton,
  Paper,
  SvgIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import {
  getCurrencyMeta,
  getRecordIncomeDisplay,
  toDisplayCurrency,
  type CalculationRecord,
} from './logic';

type SortKey = 'city' | 'income' | 'totalCosts' | 'netBudget';
type SortDirection = 'asc' | 'desc';

function EditIconSvg() {
  return (
    <SvgIcon fontSize="small" sx={{ verticalAlign: 'middle' }}>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.995.995 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </SvgIcon>
  );
}

function DeleteIconSvg() {
  return (
    <SvgIcon fontSize="small" sx={{ verticalAlign: 'middle' }}>
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </SvgIcon>
  );
}

type Props = {
  records: CalculationRecord[];
  selectedRecordId: number | null;
  onSelectRecord: (id: number) => void;
  onEditRecord: (record: CalculationRecord) => void;
  onDeleteRecord: (id: number) => void;
  /** Live USD rates; used to normalize record currencies when sorting. */
  usdRates?: Record<string, number> | null;
};

const HistoryTable: React.FC<Props> = ({
  records,
  selectedRecordId,
  onSelectRecord,
  onEditRecord,
  onDeleteRecord,
  usdRates = null,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('city');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [citySearch, setCitySearch] = useState('');

  const filteredAndSortedRecords = useMemo(() => {
    const search = citySearch.trim().toLowerCase();

    let data = records;
    if (search) {
      data = data.filter((r) => r.city.toLowerCase().includes(search));
    }

    const sorted = [...data].sort((a, b) => {
      const rawAVal = sortKey === 'income' ? getRecordIncomeDisplay(a) : a[sortKey];
      const rawBVal = sortKey === 'income' ? getRecordIncomeDisplay(b) : b[sortKey];
      const aVal =
        sortKey === 'city'
          ? rawAVal
          : toDisplayCurrency(rawAVal as number, a.currency, usdRates);
      const bVal =
        sortKey === 'city'
          ? rawBVal
          : toDisplayCurrency(rawBVal as number, b.currency, usdRates);

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        const cmp = aVal - bVal;
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      return 0;
    });

    return sorted;
  }, [records, citySearch, sortKey, sortDirection, usdRates]);

  const paginatedRecords = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAndSortedRecords.slice(start, start + rowsPerPage);
  }, [filteredAndSortedRecords, page, rowsPerPage]);

  // When a new selection appears (e.g. after calculating), jump to its page.
  useEffect(() => {
    if (selectedRecordId == null) return;
    const idx = filteredAndSortedRecords.findIndex((r) => r.id === selectedRecordId);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / rowsPerPage);
    setPage((prev) => (prev === targetPage ? prev : targetPage));
  }, [selectedRecordId, filteredAndSortedRecords, rowsPerPage]);

  const handleRequestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
        }}
      >
        <Typography variant="h6">Calculation history</Typography>
        <TextField
          size="small"
          label="Search by city"
          value={citySearch}
          onChange={(e) => {
            setCitySearch(e.target.value);
            setPage(0);
          }}
        />
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sortDirection={sortKey === 'city' ? sortDirection : false}>
              <TableSortLabel
                active={sortKey === 'city'}
                direction={sortKey === 'city' ? sortDirection : 'asc'}
                onClick={() => handleRequestSort('city')}
              >
                City
              </TableSortLabel>
            </TableCell>
            <TableCell>Country</TableCell>
            <TableCell
              align="right"
              sortDirection={sortKey === 'income' ? sortDirection : false}
            >
              <TableSortLabel
                active={sortKey === 'income'}
                direction={sortKey === 'income' ? sortDirection : 'asc'}
                onClick={() => handleRequestSort('income')}
              >
                Income
              </TableSortLabel>
            </TableCell>
            <TableCell
              align="right"
              sortDirection={sortKey === 'totalCosts' ? sortDirection : false}
            >
              <TableSortLabel
                active={sortKey === 'totalCosts'}
                direction={sortKey === 'totalCosts' ? sortDirection : 'asc'}
                onClick={() => handleRequestSort('totalCosts')}
              >
                Total costs
              </TableSortLabel>
            </TableCell>
            <TableCell
              align="right"
              sortDirection={sortKey === 'netBudget' ? sortDirection : false}
            >
              <TableSortLabel
                active={sortKey === 'netBudget'}
                direction={sortKey === 'netBudget' ? sortDirection : 'asc'}
                onClick={() => handleRequestSort('netBudget')}
              >
                Net budget
              </TableSortLabel>
            </TableCell>
            <TableCell align="center" sx={{ width: 100 }}>
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedRecords.map((record) => (
            <TableRow
              key={record.id}
              hover
              selected={selectedRecordId === record.id}
              onClick={() => onSelectRecord(record.id)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>{record.city}</TableCell>
              <TableCell>{record.country}</TableCell>
              <TableCell align="right">
                {getRecordIncomeDisplay(record).toFixed(2)}{' '}
                {getCurrencyMeta(record.currency).symbol}
                {typeof record.taxRate === 'number' && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block' }}
                  >
                    net of {(record.taxRate * 100).toFixed(1)}% tax
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                {record.totalCosts.toFixed(2)} {getCurrencyMeta(record.currency).symbol}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  color: record.netBudget >= 0 ? 'success.main' : 'error.main',
                }}
              >
                {record.netBudget.toFixed(2)} {getCurrencyMeta(record.currency).symbol}
              </TableCell>
              <TableCell
                align="center"
                sx={{ width: 100 }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton
                  size="small"
                  aria-label="Edit"
                  onClick={() => onEditRecord(record)}
                >
                  <EditIconSvg />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Delete"
                  color="error"
                  onClick={() => onDeleteRecord(record.id)}
                >
                  <DeleteIconSvg />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          {!paginatedRecords.length && (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography variant="body2" color="text.secondary">
                  No records yet. Run a calculation to populate the table.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={filteredAndSortedRecords.length}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </Paper>
  );
};

export default HistoryTable;
