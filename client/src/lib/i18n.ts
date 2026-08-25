import { mn } from './i18n.mn';

/**
 * The dictionary the app reads from.
 *
 * Both languages used to sit in one module that the app context imported
 * directly, so every visitor downloaded ~1,700 lines of translations in the
 * entry chunk and used half of them. Mongolian — the default — is still
 * bundled; English is a separate chunk, fetched before the first paint only
 * when that is the reader's language (see `loadLanguage`).
 */
export type TranslationLanguage = 'mn' | 'en';

export const translations: Record<TranslationLanguage, Record<string, string>> = {
  mn,
  // Until the English chunk arrives, `t()` resolves through this and falls back
  // to Mongolian — which is also what happens for a key English never had.
  en: mn,
};

const loaded = new Set<TranslationLanguage>(['mn']);

/**
 * Makes a language available to `t()`. Awaited once at startup for the stored
 * language, so nothing renders in the wrong one, and again on a switch.
 */
export async function loadLanguage(language: TranslationLanguage): Promise<void> {
  if (loaded.has(language)) return;
  if (language === 'en') {
    const module = await import('./i18n.en');
    translations.en = module.en;
    loaded.add('en');
  }
}
