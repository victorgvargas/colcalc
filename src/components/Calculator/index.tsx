import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Paper,
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
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

type ApiPriceItem = {
  category_name?: string;
  item_name?: string;
  avg_price?: number;
  [key: string]: unknown;
};

type ApiPricesResponse = {
  prices?: ApiPriceItem[];
  [key: string]: unknown;
};

type CalculationRecord = {
  id: number;
  city: string;
  country: string;
  income: number;
  totalCosts: number;
  netBudget: number;
};

type SortKey = 'city' | 'income' | 'totalCosts' | 'netBudget';
type SortDirection = 'asc' | 'desc';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA46BE', '#FF6F91'];

const Calculator: React.FC = () => {
  const [income, setIncome] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [country, setCountry] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prices, setPrices] = useState<ApiPriceItem[]>([]);
  const [records, setRecords] = useState<CalculationRecord[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>('city');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [citySearch, setCitySearch] = useState('');

  const totalCosts = useMemo(
    () => prices.reduce((sum, p) => sum + (typeof p.avg_price === 'number' ? p.avg_price : 0), 0),
    [prices],
  );

  const netBudget = useMemo(() => {
    const numericIncome = Number(income) || 0;
    return numericIncome - totalCosts;
  }, [income, totalCosts]);

  const chartData = useMemo(() => {
    if (!prices.length) return [];

    const byCategory = new Map<string, number>();
    prices.forEach((p) => {
      const category = (p.category_name || 'Other') as string;
      const value = typeof p.avg_price === 'number' ? p.avg_price : 0;
      if (!value) return;
      byCategory.set(category, (byCategory.get(category) || 0) + value);
    });

    return Array.from(byCategory.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [prices]);

  const filteredAndSortedRecords = useMemo(() => {
    const search = citySearch.trim().toLowerCase();

    let data = records;
    if (search) {
      data = data.filter((r) => r.city.toLowerCase().includes(search));
    }

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

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
  }, [records, citySearch, sortKey, sortDirection]);

  const paginatedRecords = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAndSortedRecords.slice(start, start + rowsPerPage);
  }, [filteredAndSortedRecords, page, rowsPerPage]);

  const handleRequestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError(null);

    const numericIncome = Number(income);
    if (!numericIncome || !city.trim() || !country.trim()) {
      setError('Please provide a valid income, city, and country.');
      return;
    }

    setIsLoading(true);

    try {
      const url = new URL('https://cost-of-living-and-prices.p.rapidapi.com/prices');
      url.searchParams.set('city_name', city.trim());
      url.searchParams.set('country_name', country.trim());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-key': 'bf8010588dmsh35bf3ec00a6a414p1d2bb4jsn76cf746787c2',
          'x-rapidapi-host': 'cost-of-living-and-prices.p.rapidapi.com',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ApiPricesResponse;
      const fetchedPrices = Array.isArray(data.prices) ? data.prices : [];

      setPrices(fetchedPrices);

      const computedTotalCosts = fetchedPrices.reduce(
        (sum, p) => sum + (typeof p.avg_price === 'number' ? p.avg_price : 0),
        0,
      );

      const record: CalculationRecord = {
        id: Date.now(),
        city: city.trim(),
        country: country.trim(),
        income: numericIncome,
        totalCosts: computedTotalCosts,
        netBudget: numericIncome - computedTotalCosts,
      };

      setRecords((prev) => [record, ...prev]);
      setPage(0);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong while fetching data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setIncome('');
    setCity('');
    setCountry('');
    setPrices([]);
    setError(null);
  };

  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        overflow: 'auto',
      }}
    >
      <Typography variant="h4" gutterBottom>
        Cost of Living Calculator
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Enter your details
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }} noValidate>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <TextField
                label="Monthly Income (USD)"
                type="number"
                fullWidth
                required
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                inputProps={{ min: 0, step: 100 }}
              />
              <TextField
                label="City"
                fullWidth
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <TextField
                label="Country"
                fullWidth
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                mt: 2,
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                >
                  {isLoading ? 'Calculating…' : 'Calculate'}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleReset}
                  disabled={isLoading}
                >
                  Reset
                </Button>
              </Box>
              <Box textAlign={{ xs: 'left', sm: 'right' }}>
                <Typography variant="subtitle1">
                  Total costs: {totalCosts.toFixed(2)} USD
                </Typography>
                <Typography
                  variant="subtitle1"
                  color={netBudget >= 0 ? 'success.main' : 'error.main'}
                >
                  Net budget: {netBudget.toFixed(2)} USD
                </Typography>
              </Box>
            </Box>
            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
        }}
      >
        <Box sx={{ flex: { xs: '0 0 auto', md: '0 0 40%' } }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: 360 }}>
              <Typography variant="h6" gutterBottom>
                Expenditure breakdown
              </Typography>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="75%"
                      label
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          // eslint-disable-next-line react/no-array-index-key
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `${value.toFixed(2)} USD`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Run a calculation to see the cost breakdown pie chart.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: 1 }}>
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
                      Income (USD)
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
                      Total costs (USD)
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
                      Net budget (USD)
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRecords.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>{record.city}</TableCell>
                    <TableCell>{record.country}</TableCell>
                    <TableCell align="right">
                      {record.income.toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      {record.totalCosts.toFixed(2)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          record.netBudget >= 0 ? 'success.main' : 'error.main',
                      }}
                    >
                      {record.netBudget.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                {!paginatedRecords.length && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
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
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default Calculator;