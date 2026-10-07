import { APP_CONFIG_PATHS, DEFAULT_APP_CONFIG } from "../core/config.js";

export async function loadRuntimeConfig({
  baseUrl = window.location.href,
  fetchImpl = fetch,
  warn = (...args) => window.console.warn(...args),
  now = Date.now
} = {}) {
  for (const path of APP_CONFIG_PATHS) {
    try {
      const url = new URL(path, baseUrl);
      url.searchParams.set("t", String(now()));
      const response = await fetchImpl(url.href, { cache: "no-store" });
      if (!response.ok) continue;
      return normalizeRuntimeConfig(await response.json());
    } catch (error) {
      warn(`App config unavailable: ${path}`, error);
    }
  }
  return normalizeRuntimeConfig(DEFAULT_APP_CONFIG);
}

export function normalizeRuntimeConfig(config) {
  const source = config && typeof config === "object" ? config : {};
  return {
    defaults: { ...DEFAULT_APP_CONFIG.defaults, ...(source.defaults || {}) },
    documentSources: normalizeSourceList(source.documentSources, DEFAULT_APP_CONFIG.documentSources),
    defaultSources: normalizeSourceList(source.defaultSources, DEFAULT_APP_CONFIG.defaultSources),
    otherSources: normalizeSourceList(source.otherSources, DEFAULT_APP_CONFIG.otherSources),
    local: {
      enabled: source.local?.enabled === true,
      defaultSources: normalizeSourceList(source.local?.defaultSources),
      otherSources: normalizeSourceList(source.local?.otherSources),
      exclude: normalizeSourceList(source.local?.exclude)
    },
    study: { localPersistence: source.local?.enabled === true && source.study?.localPersistence === true }
  };
}

function normalizeSourceList(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source.map((entry) => typeof entry === "string" ? entry.trim() : entry).filter(Boolean);
}

export function normalizeConfigParseMode(value) {
  if (/^(reader|markdown|md|note|paragraph)$/i.test(String(value || ""))) return "paragraph";
  if (/^(vocab|vocabulary|words?)$/i.test(String(value || ""))) return "vocabulary";
  return "paragraph";
}
