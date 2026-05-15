/**
 * i18n configuration
 * Supported languages: en, es, ms, fa
 * Language preference is persisted via appSettingsStore / AsyncStorage.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import ms from './locales/ms.json';
import fa from './locales/fa.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',        nativeLabel: 'English'       },
  { code: 'es', label: 'Spanish',        nativeLabel: 'Español'       },
  { code: 'ms', label: 'Malay',          nativeLabel: 'Bahasa Melayu' },
  { code: 'fa', label: 'Persian',        nativeLabel: 'فارسی'          },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

/** Languages that use RTL layout direction */
export const RTL_LANGUAGES: LanguageCode[] = ['fa'];

export function isRTL(lang: LanguageCode): boolean {
  return RTL_LANGUAGES.includes(lang);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      ms: { translation: ms },
      fa: { translation: fa },
    },
    lng: 'en',          // default; overridden by initI18n()
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    compatibilityJSON: 'v4',
  });

/** Call once on app start with the persisted language code. */
export function setAppLanguage(lang: LanguageCode): void {
  i18n.changeLanguage(lang);
}

export default i18n;
