/**
 * Site-wide settings that are not data.
 *
 * DONATE_LINKS: the owner's donation pages, one button each in the donation box (the first one
 * is the main button). Add a Ko-fi link here for supporters abroad. The site has no ads (ADR-0013).
 */
export const DONATE_LINKS: {
  url: string;
  label: 'donate.pix' | 'donate.pixMonthly' | 'donate.kofi';
}[] = [
  { url: 'https://livepix.gg/danielversiani', label: 'donate.pix' },
  { url: 'https://livepix.gg/danielversiani/assinatura', label: 'donate.pixMonthly' },
  { url: 'https://ko-fi.com/danielversiani', label: 'donate.kofi' },
];

/** Notice required by Microsoft's Game Content Usage Rules (kept in English, as published). */
export const MICROSOFT_NOTICE =
  'Forza Horizon 6 © Microsoft Corporation. Forza Paddock was created under Microsoft\'s "Game Content Usage Rules" using assets from Forza Horizon 6, and it is not endorsed by or affiliated with Microsoft.';
/** Where authors ask for removal or correction (linked from the data-use page only). */
export const FEEDBACK_URL = 'https://github.com/danielversiani/fh-hub/issues';

export const MICROSOFT_RULES_URL = 'https://www.xbox.com/en-US/developers/rules';
