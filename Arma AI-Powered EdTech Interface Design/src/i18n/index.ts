import { en } from './locales/en';
import { ru } from './locales/ru';
import { uz } from './locales/uz';

export type Language = 'en' | 'ru' | 'uz';

export const translations: Record<Language, typeof en> = {
  en,
  ru,
  uz,
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  ru: 'Русский',
  uz: "O'zbek",
};

export const defaultLanguage: Language = 'en';
