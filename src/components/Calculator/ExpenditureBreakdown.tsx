import React from 'react';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { getCurrencyMeta, type CalculationRecord, type CurrencyCode } from './logic';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA46BE', '#FF6F91'];

export type BreakdownDatum = { name: string; value: number };

type Props = {
  data: BreakdownDatum[];
  /** When a saved record is selected, show its city/country alongside the heading. */
  selectedRecord?: CalculationRecord | null;
  /** Currency to render inside tooltip (the data values are already converted). */
  displayCurrency?: CurrencyCode;
  /** Number of price points the breakdown is based on. Used for provenance. */
  pricePointCount?: number;
};

const ExpenditureBreakdown: React.FC<Props> = ({
  data,
  selectedRecord = null,
  displayCurrency = 'EUR',
  pricePointCount,
}) => {
  const navigate = useNavigate();

  const handleCompare = () => {
    if (!selectedRecord) return;
    const params = new URLSearchParams();
    params.set('city1', selectedRecord.city);
    if (selectedRecord.country) params.set('country1', selectedRecord.country);
    navigate(`/cities-comparison?${params.toString()}`);
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ height: 360 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 1,
            mb: 1,
          }}
        >
          <Box>
            <Typography variant="h6">
              Expenditure breakdown
              {selectedRecord && (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  — {selectedRecord.city}, {selectedRecord.country}
                </Typography>
              )}
            </Typography>
            {selectedRecord && typeof pricePointCount === 'number' && pricePointCount > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Based on {pricePointCount} price point{pricePointCount === 1 ? '' : 's'}
              </Typography>
            )}
          </Box>
          {selectedRecord && (
            <Button size="small" variant="text" onClick={handleCompare}>
              Compare with another city →
            </Button>
          )}
        </Box>
        {data.length ? (
          <Box sx={{ height: '85%', minHeight: 0, overflow: 'hidden' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="75%"
                  isAnimationActive
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${Number(value).toFixed(2)} ${getCurrencyMeta(displayCurrency).symbol}`,
                    name,
                  ]}
                  contentStyle={{ maxWidth: '100%' }}
                  wrapperStyle={{ outline: 'none' }}
                />
                <Legend
                  wrapperStyle={{ overflow: 'hidden' }}
                  formatter={(value: string) => (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        ) : selectedRecord ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No breakdown stored for this record.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Run a calculation to see the cost breakdown pie chart.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ExpenditureBreakdown;
