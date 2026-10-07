export const GAP_SECONDS = Object.freeze([0.25, 0.5, 0.75, ...Array.from({ length: 30 }, (_, index) => index + 1)]);
export const DEFAULT_GAP_SECONDS = 0.75;

export function normalizeGapSeconds(value) {
  const number = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(number)) return DEFAULT_GAP_SECONDS;
  return number < 1
    ? Math.max(0.25, Math.round(number * 4) / 4)
    : Math.max(1, Math.min(30, Math.round(number)));
}

export function gapSliderIndex(seconds) {
  return GAP_SECONDS.indexOf(normalizeGapSeconds(seconds));
}

export function gapSecondsAtIndex(index) {
  return GAP_SECONDS[Math.max(0, Math.min(GAP_SECONDS.length - 1, Math.round(Number(index) || 0)))];
}
