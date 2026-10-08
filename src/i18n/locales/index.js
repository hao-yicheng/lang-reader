import de from "./de.js";
import en from "./en.js";
import zh from "./zh.js";
import bg from "./bg.js";
import ja from "./ja.js";

export const LOCALE_ORDER = ["de", "en", "zh", "bg", "ja"];
export const LOCALES_BY_CODE = { de, en, zh, bg, ja };
export const LOCALES = LOCALE_ORDER.map((code) => LOCALES_BY_CODE[code]);
