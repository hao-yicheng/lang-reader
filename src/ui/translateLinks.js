export const TRANSLATION_PROVIDERS = [
  { id: "google", name: "Google Translate", mark: "G" },
  { id: "deepl", name: "DeepL", mark: "D" },
  { id: "microsoft", name: "Microsoft Translator", mark: "M" },
  { id: "baidu", name: "Baidu Translate", mark: "百" }
];

export function buildTranslateUrl(provider, text, source = "de", target = "en") {
  const normalizedProvider = TRANSLATION_PROVIDERS.some(({ id }) => id === provider) ? provider : "google";
  if (normalizedProvider === "deepl") return buildDeepLUrl(text, source, target);
  if (normalizedProvider === "microsoft") return buildMicrosoftUrl(text, source, target);
  if (normalizedProvider === "baidu") return buildBaiduUrl(text, source, target);
  return buildGoogleTranslateUrl(text, source, target);
}

export function buildGoogleTranslateUrl(text, source = "de", target = "en") {
  const url = new URL("https://translate.google.com/");
  url.searchParams.set("sl", googleLanguage(source));
  url.searchParams.set("tl", googleLanguage(target));
  url.searchParams.set("text", text || "");
  url.searchParams.set("op", "translate");
  return url.toString();
}

export function buildGooglePageTranslateUrl(pageUrl, target = "en") {
  const url = new URL("https://translate.google.com/translate");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", googleLanguage(target));
  url.searchParams.set("u", pageUrl || "");
  return url.toString();
}

function buildDeepLUrl(text, source, target) {
  const url = new URL("https://www.deepl.com/translator");
  url.hash = `${baseLanguage(source)}/${baseLanguage(target)}/${encodeURIComponent(text || "")}`;
  return url.toString();
}

function buildMicrosoftUrl(text, source, target) {
  const url = new URL("https://www.bing.com/translator");
  url.searchParams.set("from", baseLanguage(source));
  url.searchParams.set("to", baseLanguage(target));
  url.searchParams.set("text", text || "");
  return url.toString();
}

function buildBaiduUrl(text, source, target) {
  const url = new URL("https://fanyi.baidu.com/mtpe-individual/transText");
  url.hash = `/${baiduLanguage(source)}/${baiduLanguage(target)}/${encodeURIComponent(text || "")}`;
  return url.toString();
}

function googleLanguage(language) {
  const value = String(language || "en");
  if (/^zh/i.test(value)) return /(?:TW|HK|MO|Hant)/i.test(value) ? "zh-TW" : "zh-CN";
  return baseLanguage(value);
}

function baiduLanguage(language) {
  const code = baseLanguage(language);
  if (code === "bg") return "bul";
  if (code === "zh") return "zh";
  return code;
}

function baseLanguage(language) {
  return String(language || "en").split("-")[0].toLowerCase();
}
