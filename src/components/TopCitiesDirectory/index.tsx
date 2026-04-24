import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Link } from '@mui/material';
import directory from '../../data/topCities.json';

type DirectoryEntry = {
  cities: { city: string; country: string; slug: string }[];
  pairs: {
    a: { city: string; country: string };
    b: { city: string; country: string };
    slug: string;
  }[];
};

const data = directory as DirectoryEntry;

/**
 * Indexable anchor links to the highest-value city/comparison pages.
 * Provides Google internal link equity and surfaces the SEO URLs from
 * inside the app.
 */
const TopCitiesDirectory: React.FC = () => {
  if (!data.cities.length) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Explore popular cities
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Dedicated cost-of-living pages for the most-searched cities.
        </Typography>
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            pl: 0,
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 0.5,
          }}
        >
          {data.cities.map((c) => (
            <li key={c.slug}>
              <Link
                component={RouterLink}
                to={`/cost-of-living/${c.slug}`}
                variant="body2"
                underline="hover"
              >
                {c.city}
              </Link>
            </li>
          ))}
        </Box>

        {data.pairs.length > 0 && (
          <>
            <Typography variant="h6" component="h2" sx={{ mt: 3 }} gutterBottom>
              Popular city comparisons
            </Typography>
            <Box
              component="ul"
              sx={{
                listStyle: 'none',
                pl: 0,
                m: 0,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 0.5,
              }}
            >
              {data.pairs.map((p) => (
                <li key={p.slug}>
                  <Link
                    component={RouterLink}
                    to={`/compare/${p.slug}`}
                    variant="body2"
                    underline="hover"
                  >
                    {p.a.city} vs {p.b.city}
                  </Link>
                </li>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TopCitiesDirectory;
