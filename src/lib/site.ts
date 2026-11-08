/**
 * Site-wide settings that are not data.
 *
 * DONATE_URL: the owner's donation page (Ko-fi, Livepix, Apoia.se…). While it is empty, the
 * donation box still shows, with a "coming soon" button. The site has no ads (ADR-0013).
 */
export const DONATE_URL: string | undefined = undefined;

/** Notice required by Microsoft's Game Content Usage Rules (kept in English, as published). */
export const MICROSOFT_NOTICE =
  'Forza Horizon 6 © Microsoft Corporation. Forza Paddock was created under Microsoft\'s "Game Content Usage Rules" using assets from Forza Horizon 6, and it is not endorsed by or affiliated with Microsoft.';
/** Pre-launch (ADR-0015): banner on every page and no search-engine indexing. */
export const PRELAUNCH = true;
/** Where authors ask for removal and testers leave feedback. */
export const FEEDBACK_URL = 'https://github.com/danielversiani/fh-hub/issues';

export const MICROSOFT_RULES_URL = 'https://www.xbox.com/en-US/developers/rules';
