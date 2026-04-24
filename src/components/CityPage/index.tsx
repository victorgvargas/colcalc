import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Link } from '@mui/material';
import {
  computeMonthlyCostsFromPrices,
  fetchDatasetCities,
  type DatasetCity,
} from '../../api/costOfLiving';
import { citySlug } from '../../lib/slug';

const CityPage: React.FC = () => {
  const { citySlug: slug } = useParams<{ citySlug: string }>();
  const [cities, setCities] = useState<DatasetCity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDatasetCities()
      .then((data) => {
        if (!cancelled) setCities(data);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entry = useMemo(
    () => cities.find((c) => citySlug(c.city, c.country) === slug),
    [cities, slug],
  );

  const summary = useMemo(() => {
    if (!entry) return null;
    const prices = entry.prices.map((p) => ({
      category_name: p.category,
      item_name: p.item,
      usd: { avg: p.usd },
    }));
    const { totalUsd, byCategory } = computeMonthlyCostsFromPrices(prices);
    return { totalUsd, byCategory };
  }, [entry]);

  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading city…
      </Typography>
    );
  }

  if (!entry) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="h5" component="h1" fontWeight={600}>
          City not found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          That URL doesn't match a city in our dataset.{' '}
          <Link component={RouterLink} to="/calculator">
            Go to the calculator
          </Link>{' '}
          to search for one.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography component="h1" variant="h4" fontWeight={600}>
          Cost of living in {entry.city}, {entry.country}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Monthly cost estimate based on rent, groceries, utilities, transport, and
          childcare prices. Values shown in USD.
        </Typography>
      </Box>

      {summary && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Estimated monthly total
            </Typography>
            <Typography variant="h4" color="primary">
              ${summary.totalUsd.toFixed(0)}
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {Array.from(summary.byCategory.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([category, value]) => (
                  <Typography key={category} variant="body2">
                    <strong>{category}:</strong> ${value.toFixed(0)}
                  </Typography>
                ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            What's next
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <li>
              <Link component={RouterLink} to="/calculator">
                Calculate your net budget in {entry.city}
              </Link>
            </li>
            <li>
              <Link component={RouterLink} to="/cities-comparison">
                Compare {entry.city} against another city
              </Link>
            </li>
            <li>
              <Link component={RouterLink} to="/purchasing-power">
                See equivalent incomes in other cities
              </Link>
            </li>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CityPage;
