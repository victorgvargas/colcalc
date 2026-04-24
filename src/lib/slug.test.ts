import { describe, it, expect } from 'vitest';
import { slugify, citySlug, comparisonSlug } from './slug';

describe('slugify', () => {
  it('lowercases and replaces whitespace with hyphens', () => {
    expect(slugify('New York')).toBe('new-york');
  });

  it('strips diacritics', () => {
    expect(slugify('São Paulo')).toBe('sao-paulo');
    expect(slugify('Zürich')).toBe('zurich');
  });

  it('collapses punctuation and trims leading/trailing hyphens', () => {
    expect(slugify('  ---Hello, World!!!---  ')).toBe('hello-world');
  });

  it('collapses sequences of non-alphanumerics into a single hyphen', () => {
    expect(slugify('a  b---c!!!d')).toBe('a-b-c-d');
  });

  it('drops characters outside ASCII alphanumerics', () => {
    expect(slugify('東京 Tokyo')).toBe('tokyo');
  });

  it('returns empty string for pure-symbol input', () => {
    expect(slugify('---')).toBe('');
    expect(slugify('')).toBe('');
  });
});

describe('citySlug', () => {
  it('joins city and country slugs with a hyphen', () => {
    expect(citySlug('Berlin', 'Germany')).toBe('berlin-germany');
  });

  it('handles multi-word city and country', () => {
    expect(citySlug('New York', 'United States')).toBe('new-york-united-states');
  });
});

describe('comparisonSlug', () => {
  it('formats a vs b', () => {
    expect(
      comparisonSlug(
        { city: 'Berlin', country: 'Germany' },
        { city: 'Paris', country: 'France' },
      ),
    ).toBe('berlin-germany-vs-paris-france');
  });
});
