export const DEFAULT_ROLES = ["sentence", "sentence", "sentence"];
export const DEFAULT_PARSER_ROLES = ["word", "translation", "sentence"];
export const DEFAULT_TAG = "sentence";
export const DEFAULT_TARGET_LANGUAGE = "de";
export const REPEAT_INFINITY_VALUE = 21;
export const MAX_FINITE_REPEAT = 20;
export const APP_CONFIG_PATHS = ["config/app.config.json", "config/app.config.example.json"];
export const DEFAULT_DOCUMENT_PATH = "docs/templates/how-to-use.md";
export const DEFAULT_APP_CONFIG = {
  defaults: {
    uiLanguage: "en",
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    translationLanguage: "en",
    parseMode: "reader",
    readTranslations: false,
    hideTranslations: false,
    theme: "auto"
  },
  documentSources: ["docs/templates/"],
  defaultSources: [],
  otherSources: [],
  local: { enabled: false, defaultSources: [], otherSources: [], exclude: [] },
  study: { localPersistence: false }
};
export const LOCAL_FILE_VALUE = "__local_file__";
export const FOLDER_VALUE = "__folder__";
export const SUPPORTED_FILE_RE = /\.(md|txt|tsv|csv)$/i;
export const MANIFEST_FILE_NAME = "manifest.json";

export function migrateDocumentPath(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith("docs/content/imported/")) return value.replace("docs/content/imported/", "local-default/content/imported/");
  return value === "docs/templates/prompts/reformat-notes.md" ? "docs/templates/reformat-notes.md" : value;
}

// Keep existing browser and disk Study identities across the directory move.
export function stableLocalSourceKey(value) {
  return typeof value === "string" ? value.replace(/^local-default\/content\/imported\//, "docs/content/imported/") : value;
}

export function inferParseModeFromName(name) {
  const normalized = String(name || "").toLowerCase();
  if (/(vocab|vocabulary|word|words|wort|wörter|woerter|vokabel|vokabeln|词汇|單詞|单词|词语)/i.test(normalized)) return "vocabulary";
  if (/(sentence|sentences|sentense|sentenses|satz|sätze|saetze|句子|例句)/i.test(normalized)) return "paragraph";
  if (/(paragraph|paragraphs|article|text|note|lecture|absatz|artikel|notiz|vorlesung|文章|段落|笔记|講義|讲义)/i.test(normalized)) return "paragraph";
  if (/(table|sheet|excel|tsv|csv|tabelle|表格|表|清单)/i.test(normalized)) return "vocabulary";
  return "paragraph";
}

export function inferParagraphSplitFromName(name) {
  const normalized = String(name || "").toLowerCase();
  if (/(sentence|sentences|sentense|sentenses|satz|sätze|saetze|句子|例句)/i.test(normalized)) return "sentence";
  return "newline";
}
