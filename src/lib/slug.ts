/**
 * Slug helpers shared by routing, SEO, and the sitemap generator.
 * Keep ASCII-only so URLs stay clean; strip diacritics, collapse punctuation.
 */

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function citySlug(city: string, country: string): string {
  return `${slugify(city)}-${slugify(country)}`;
}

export function comparisonSlug(
  a: { city: string; country: string },
  b: { city: string; country: string },
): string {
  return `${citySlug(a.city, a.country)}-vs-${citySlug(b.city, b.country)}`;
}
