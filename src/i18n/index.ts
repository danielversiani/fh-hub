import en from './en.json';
import ptBr from './pt-br.json';

export const LOCALES = ['pt-br', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pt-br';

export type MessageKey = keyof typeof ptBr;

/** The `satisfies` clause makes a missing English key a type error (ADR-0007). */
const dictionaries = { 'pt-br': ptBr, en } satisfies Record<Locale, Record<MessageKey, string>>;

export function t(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  return dictionaries[locale][key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? `{${name}}`),
  );
}

/** PT-BR lives at the root, English under /en/. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locale === DEFAULT_LOCALE ? clean : `/en${clean === '/' ? '/' : clean}`;
}

export const otherLocale = (locale: Locale): Locale => (locale === 'en' ? 'pt-br' : 'en');

export const htmlLang = (locale: Locale): string => (locale === 'en' ? 'en' : 'pt-BR');

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(htmlLang(locale)).format(value);
}

export function formatDate(locale: Locale, iso: string | undefined): string {
  if (!iso) return '—';
  return (
    new Intl.DateTimeFormat(htmlLang(locale), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(iso)) + ' UTC'
  );
}

/** Translation of a key built at run time (e.g. `carType.<slug>`), or `fallback` when missing. */
export function tMaybe(locale: Locale, key: string, fallback: string): string {
  return (dictionaries[locale] as Record<string, string>)[key] ?? fallback;
}

/** Every key with a prefix, without the prefix (e.g. all `carType.*` for the Preact islands). */
export function tGroup(locale: Locale, prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dictionaries[locale])
      .filter(([key]) => key.startsWith(`${prefix}.`))
      .map(([key, value]) => [key.slice(prefix.length + 1), value]),
  );
}
