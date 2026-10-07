const CJK_PATTERN = /[\u3400-\u9fff]/;
const LETTER_PATTERN = /[A-Za-zÄÖÜäöüß]/;

export function shouldSkipLine(line) {
  const value = line.trim();
  if (!value) return true;
  if (/^[-*_|\s:]+$/.test(value)) return true;
  if (/^\d+[\s.)-]*$/.test(value)) return true;
  if (/^source\s*:/i.test(value)) return true;
  return false;
}

export function isLikelyExplanation(text) {
  const value = text.trim();
  if (!value) return true;
  if (CJK_PATTERN.test(value)) return true;
  if (!LETTER_PATTERN.test(value)) return true;
  return false;
}

export function cleanBullet(line) {
  return line.trim().replace(/^[-*+]\s+/, "").trim();
}
