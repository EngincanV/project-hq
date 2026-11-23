// URL/folder-safe slugs. Turkish letters are transliterated (ç→c, ğ→g, ı/İ→i, ö→o, ş→s, ü→u).

const TURKISH: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
};

/** "Rock & Roll" → "rock-roll", "Günlük Ödev" → "gunluk-odev". May return "" for input with no letters/digits. */
export function slugify(input: string): string {
  return input
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TURKISH[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** `slugify(input)` made unique against `taken` by appending -2, -3… Falls back to `fallback` when empty. */
export function uniqueSlug(input: string, taken: Iterable<string>, fallback = 'project'): string {
  const used = new Set(taken);
  const base = slugify(input) || fallback;
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}
