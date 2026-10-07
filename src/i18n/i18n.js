import { LOCALES } from "./locales/index.js";

export const I18N = Object.fromEntries(LOCALES.map((locale) => [locale.code, locale.ui]));
