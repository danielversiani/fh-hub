import { describe, expect, it } from 'vitest';
import en from './en.json';
import { localePath, t } from './index';
import ptBr from './pt-br.json';

describe('i18n', () => {
  it('has the same keys in every locale', () =>
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBr).sort()));

  it('has no empty strings', () => {
    for (const dict of [en, ptBr])
      expect(Object.values(dict).every((v) => v.trim() !== '')).toBe(true);
  });

  it('builds locale paths', () => {
    expect(localePath('pt-br', '/status')).toBe('/status');
    expect(localePath('en', '/status')).toBe('/en/status');
    expect(localePath('en', '/')).toBe('/en/');
  });

  it('translates', () => expect(t('en', 'nav.tunes')).toBe('Tunes'));
});
