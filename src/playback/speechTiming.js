const STORAGE_KEY = "lang-reader.speech-timing.v1";
const MAX_PROFILES = 16;
const MAX_SAMPLES = 36;
const MAX_CACHE = 48;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function textKey(text) {
  let hash = 2166136261;
  let second = 5381;
  for (const character of text) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
    second = Math.imul(second, 33) ^ character.codePointAt(0);
  }
  return `${text.length}:${hash >>> 0}:${second >>> 0}`;
}

export function speechTimingFeatures(text, lang = "en", rate = 1) {
  const language = lang.split("-")[0].toLowerCase();
  const words = String(text).match(/\p{L}+/gu) || [];
  const han = [...String(text).matchAll(/\p{Script=Han}/gu)].length;
  const kana = [...String(text).matchAll(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)].length;
  const otherScript = [...String(text).matchAll(/\p{L}/gu)].filter(match =>
    !/[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(match[0])).length;
  const latinWords = words.filter(word => /[\p{Script=Latin}\p{Script=Cyrillic}]/u.test(word));
  const syllables = latinWords.reduce((sum, word) => {
    let value = word.toLowerCase();
    if (language === "en" && value.length > 3 && !/le$/.test(value)) value = value.replace(/e$/, "");
    return sum + Math.max(1, (value.match(/[aeiouyäöü]+/g) || []).length);
  }, 0);
  const commas = (String(text).match(/[,;:，；：、،؛—–]/g) || []).length;
  const terminals = (String(text).match(/[.!?。！？؟।॥]+/g) || []).length;
  const digits = (String(text).match(/\p{Nd}/gu) || []).length;
  const speed = Math.max(0.5, Math.min(3, Number(rate) || 1));
  // Features are seconds at the selected rate, not phoneme timestamps.
  return [0.12, han * 0.18 + kana * 0.11 + otherScript * 0.12 + syllables * (language === "de" ? 0.15 : 0.14),
    latinWords.length * 0.11, commas * 0.18, terminals * 0.22, digits * 0.18]
    .map(value => value / speed);
}

function fit(samples) {
  const size = 6;
  const ridge = 0.8;
  const matrix = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size + 1 }, (_, column) => column === size ? ridge : row === column ? ridge : 0));
  for (const { features, durationMs } of samples) {
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) matrix[row][column] += features[row] * features[column];
      matrix[row][size] += features[row] * durationMs / 1000;
    }
  }
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    for (let index = column; index <= size; index++) matrix[column][index] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const scale = matrix[row][column];
      for (let index = column; index <= size; index++) matrix[row][index] -= scale * matrix[column][index];
    }
  }
  return matrix.map(row => Math.max(0.25, Math.min(4, row[size])));
}

export function createSpeechTiming({ storage = null, now = () => Date.now() } = {}) {
  let profiles = {};
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    if (saved?.version === 1 && Array.isArray(saved.profiles)) {
      for (const [key, profile] of saved.profiles.slice(-MAX_PROFILES)) {
        if (typeof key !== "string" || !profile || !Number.isFinite(profile.updatedAt)
          || now() - profile.updatedAt > MAX_AGE) continue;
        const samples = Array.isArray(profile.samples) ? profile.samples.filter(sample =>
          Array.isArray(sample.features) && sample.features.length === 6
          && sample.features.every(value => Number.isFinite(value) && value >= 0 && value < 1000)
          && Number.isFinite(sample.durationMs) && sample.durationMs >= 150 && sample.durationMs <= 180000).slice(-MAX_SAMPLES) : [];
        const cache = Array.isArray(profile.cache) ? profile.cache.filter(entry =>
          Array.isArray(entry) && typeof entry[0] === "string" && Number.isFinite(entry[1])
          && entry[1] >= 150 && entry[1] <= 180000).slice(-MAX_CACHE) : [];
        profiles[key] = { samples, cache, updatedAt: profile.updatedAt };
      }
    }
  } catch { /* Storage is optional. */ }

  function profileKey({ voice, lang = "en", rate = 1, rateModel, engineRate }) {
    const key = [voice?.voiceURI || "", voice?.name || "default", voice?.localService ?? null,
      lang.toLowerCase(), Math.round((Number(rate) || 1) * 100) / 100];
    if (rateModel) key.push(rateModel, engineRate);
    return JSON.stringify(key);
  }

  function estimate(text, options = {}) {
    const features = speechTimingFeatures(text, options.lang, options.rate);
    const baselineMs = Math.max(180, features.reduce((sum, value) => sum + value, 0) * 1000);
    const profile = profiles[profileKey(options)];
    const cached = profile?.cache.find(entry => entry[0] === textKey(text));
    const weights = profile?.samples.length ? fit(profile.samples) : features.map(() => 1);
    return { estimatedMs: cached?.[1] ?? Math.max(180, features.reduce((sum, value, index) => sum + value * weights[index], 0) * 1000),
      baselineMs, method: cached ? "cached" : profile?.samples.length ? "calibrated" : "baseline",
      samples: profile?.samples.length || 0 };
  }

  function observe(text, options, durationMs) {
    if (!text || text.length > 4000 || !Number.isFinite(durationMs) || durationMs < 150 || durationMs > 180000) return false;
    const features = speechTimingFeatures(text, options.lang, options.rate);
    const baselineMs = Math.max(180, features.reduce((sum, value) => sum + value, 0) * 1000);
    if (durationMs / baselineMs < 0.15 || durationMs / baselineMs > 6) return false;
    const key = profileKey(options);
    const profile = profiles[key] ||= { samples: [], cache: [], updatedAt: now() };
    const hash = textKey(text);
    const previous = profile.cache.find(entry => entry[0] === hash);
    // Replays update the cache without overwhelming the sentence model.
    if (!previous) profile.samples.push({ features, durationMs });
    profile.samples = profile.samples.slice(-MAX_SAMPLES);
    profile.cache = profile.cache.filter(entry => entry[0] !== hash);
    profile.cache.push([hash, previous ? previous[1] * 0.5 + durationMs * 0.5 : durationMs]);
    profile.cache = profile.cache.slice(-MAX_CACHE);
    profile.updatedAt = now();
    profiles = Object.fromEntries(Object.entries(profiles).sort((a, b) => a[1].updatedAt - b[1].updatedAt).slice(-MAX_PROFILES));
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, profiles: Object.entries(profiles) })); } catch { /* Keep in-memory calibration. */ }
    return true;
  }

  return { estimate, observe };
}
