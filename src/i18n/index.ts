import { sk } from './sk';
import { en } from './en';
import { fr } from './fr';
import { de } from './de';

export type Language = 'sk' | 'en' | 'fr' | 'de';
export type Translations = typeof sk;

const languages: Record<Language, Translations> = { sk, en, fr, de };

/**
 * Získa jazyk prehliadača alebo vráti predvolený (en).
 */
export function getBrowserLanguage(): Language {
  const lang = navigator.language.split('-')[0];
  if (Object.keys(languages).includes(lang)) {
    return lang as Language;
  }
  return 'en';
}

/**
 * Pomocná funkcia na získanie prekladu podľa kľúča (napr. "ui.welcome")
 */
export function getTranslation(lang: Language, key: string): string {
  const keys = key.split('.');
  let current: any = languages[lang];
  
  for (const k of keys) {
    if (current[k] === undefined) return key;
    current = current[k];
  }
  
  return current;
}

export { languages };
