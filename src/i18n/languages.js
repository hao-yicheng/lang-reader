import { LOCALE_ORDER, LOCALES } from "./locales/index.js";

export const LANGUAGE_ORDER = LOCALE_ORDER;
export const LANGUAGE_DEFINITIONS = Object.fromEntries(
  LOCALES.map((locale) => [locale.code, toLanguage(locale)])
);
export const LANGUAGES = LANGUAGE_ORDER.map((code) => LANGUAGE_DEFINITIONS[code]);

const LANGUAGE_ALIASES = new Map(
  LANGUAGES.flatMap((language) => languageAliases(language).map((alias) => [alias, language.code]))
);
const VOICE_LANGUAGE_NAME_RE = new RegExp(
  `\\s+\\((?:${LANGUAGES.map((language) => language.names.en).filter(Boolean).map(escapeRegExp).join("|")})\\b.*\\)$`,
  "i"
);

export function getLanguage(code) {
  return LANGUAGE_DEFINITIONS[code] || LANGUAGE_DEFINITIONS[LANGUAGE_ORDER[0]];
}

export function getLanguageLabel(code, uiLanguage = "en") {
  const language = getLanguage(code);
  return language.names[uiLanguage] || language.names.en || language.code;
}

export function normalizeDocumentLanguage(value) {
  const normalized = normalizeAlias(value);
  if (/^(mix|mixed|na|n\/a|same|target)$/.test(normalized)) return "target";
  return LANGUAGE_ALIASES.get(normalized) || "";
}

export function speechLangFor(language) {
  return getLanguage(language).tts;
}

export function htmlLangFor(language) {
  return getLanguage(language).tts;
}

export function isValidLanguageCode(code) {
  return Object.hasOwn(LANGUAGE_DEFINITIONS, code);
}

export function getVoiceBaseName(name) {
  return String(name || "").replace(VOICE_LANGUAGE_NAME_RE, "");
}

export function filterSpeechText(text, languageCode) {
  const source = String(text || "");
  const characters = getLanguage(languageCode).speechCharacters || {};
  const allowedSource = `${characters.language || ""}${characters.common || ""}`;
  if (!allowedSource) return source.trim();
  const allowedCharacter = new RegExp(`[${allowedSource}\\s]`, "u");
  return Array.from(source)
    .map((character) => allowedCharacter.test(character) ? character : " ")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function toLanguage(locale) {
  return {
    code: locale.code,
    short: locale.short,
    tts: locale.tts,
    names: locale.names,
    aliases: locale.aliases || [],
    speechCharacters: locale.speechCharacters || {}
  };
}

function languageAliases(language) {
  return [
    language.code,
    language.short,
    language.tts,
    ...Object.values(language.names || {}),
    ...(language.aliases || [])
  ].map(normalizeAlias).filter(Boolean);
}

function normalizeAlias(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
