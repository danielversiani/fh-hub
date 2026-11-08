import { describe, expect, it } from 'vitest';
import { lapRefStripper } from './lap-refs';
import { translator } from './translate';

const translate = translator(
  { '白川59.0后段弱': { 'pt-br': 'Fraco no fim.', en: 'Weak at the top end.' } },
  lapRefStripper({ 白川: 'Shirakawa' }),
);

describe('translator', () => {
  it('uses the translation memory', () =>
    expect(translate('白川59.0后段弱')).toEqual({
      'pt-br': 'Fraco no fim.',
      en: 'Weak at the top end.',
    }));

  it('keeps text that is not Chinese as written', () =>
    expect(translate('EZ Car')).toEqual({ 'pt-br': 'EZ Car', en: 'EZ Car' }));

  it('needs no words for a note that is only a lap time', () =>
    expect(translate('白川 1:01.7')).toEqual({ 'pt-br': '', en: '' }));

  it('returns nothing for Chinese it does not know (never shows it untranslated)', () =>
    expect(translate('操控很好')).toBeUndefined());
});
