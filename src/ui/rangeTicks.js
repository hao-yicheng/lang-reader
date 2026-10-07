export function buildAdaptiveRangeTicks({
  min = 1,
  max,
  denseMax = 10,
  baseStep = 5,
  maxTicks = 11
} = {}) {
  const start = normalizeInteger(min, 1);
  const end = Math.max(start, normalizeInteger(max, start));
  const limit = Math.max(2, normalizeInteger(maxTicks, 11));

  let values;
  if (end <= denseMax) {
    values = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  } else {
    const stepBase = Math.max(1, normalizeInteger(baseStep, 5));
    let step = stepBase;
    while (countTickValues(start, end, step) > limit) step += stepBase;
    values = collectTickValues(start, end, step);
  }

  const span = end - start;
  return values.map((value) => ({
    value,
    position: span ? ((value - start) / span) * 100 : 0,
    endpoint: value === start || value === end
  }));
}

function countTickValues(min, max, step) {
  return collectTickValues(min, max, step).length;
}

function collectTickValues(min, max, step) {
  const values = step < 5 ? [min] : [];
  const first = Math.ceil(min / step) * step;
  for (let value = first; value <= max; value += step) {
    if (value > min) values.push(value);
  }
  if (values.at(-1) !== max) values.push(max);
  if (values.length > 1 && max - values.at(-2) < step / 3) {
    values.splice(-2, 1);
  }
  return values;
}

function normalizeInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}
