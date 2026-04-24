import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Link } from '@mui/material';
import {
  computeMonthlyCostsFromPrices,
  fetchDatasetCities,
  type DatasetCity,
} from '../../api/costOfLiving';
import { citySlug } from '../../lib/slug';

function parsePairSlug(slug: string | undefined): [string, string] | null {
  if (!slug) return null;
  const marker = '-vs-';
  const idx = slug.indexOf(marker);
  if (idx <= 0) return null;
  const a = slug.slice(0, idx);
  const b = slug.slice(idx + marker.length);
  if (!a || !b) return null;
  return [a, b];
}

const ComparisonPage: React.FC = () => {
  const { pairSlug } = useParams<{ pairSlug: string }>();
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

  const parsed = useMemo(() => parsePairSlug(pairSlug), [pairSlug]);

  const summaries = useMemo(() => {
    if (!parsed || !cities.length) return null;
    const [slugA, slugB] = parsed;
    const entryA = cities.find((c) => citySlug(c.city, c.country) === slugA);
    const entryB = cities.find((c) => citySlug(c.city, c.country) === slugB);
    if (!entryA || !entryB) return null;
    const toPrices = (e: DatasetCity) =>
      e.prices.map((p) => ({
        category_name: p.category,
        item_name: p.item,
        usd: { avg: p.usd },
      }));
    return [entryA, entryB].map((e) => {
      const { totalUsd, byCategory } = computeMonthlyCostsFromPrices(toPrices(e));
      return { city: e.city, country: e.country, totalUsd, byCategory };
    });
  }, [parsed, cities]);

  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading comparison…
      </Typography>
    );
  }

  if (!summaries) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="h5" component="h1" fontWeight={600}>
          Comparison not found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We couldn't find both cities in our dataset.{' '}
          <Link component={RouterLink} to="/cities-comparison">
            Try building a comparison from the full city list
          </Link>
          .
        </Typography>
      </Box>
    );
  }

  const [a, b] = summaries;
  const cheaperIsA = a.totalUsd <= b.totalUsd;
  const cheaper = cheaperIsA ? a : b;
  const pricier = cheaperIsA ? b : a;
  const diffPct =
    pricier.totalUsd > 0
      ? ((pricier.totalUsd - cheaper.totalUsd) / pricier.totalUsd) * 100
      : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography component="h1" variant="h4" fontWeight={600}>
          {a.city}, {a.country} vs {b.city}, {b.country}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Side-by-side monthly cost of living. {cheaper.city} is about{' '}
          <strong>{diffPct.toFixed(0)}%</strong> cheaper than {pricier.city} based on
          our dataset.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
        {summaries.map((s) => (
          <Card key={s.city}>
            <CardContent>
              <Typography variant="h6">
                {s.city}, {s.country}
              </Typography>
              <Typography variant="h4" color="primary" sx={{ mt: 1 }}>
                ${s.totalUsd.toFixed(0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Monthly total (USD)
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {Array.from(s.byCategory.entries())
                  .sort((a2, b2) => b2[1] - a2[1])
                  .map(([category, value]) => (
                    <Typography key={category} variant="body2">
                      <strong>{category}:</strong> ${value.toFixed(0)}
                    </Typography>
                  ))}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card>
        <CardContent>
          <Typography variant="body2">
            <Link component={RouterLink} to="/cities-comparison">
              Build a multi-city comparison
            </Link>{' '}
            or{' '}
            <Link component={RouterLink} to="/purchasing-power">
              see equivalent incomes across cities
            </Link>
            .
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ComparisonPage;
