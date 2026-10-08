export const GOOGLE_RATE_MODEL = "google-network-duration-v1";

// Chinese knots are measured. Other languages use endpoint-adjusted estimates.
const CHINESE_CURVE = [[0.507778, 0.5], [0.714710, 0.75], [1, 1], [1.397897, 1.25],
  [1.945793, 1.5], [2.704686, 1.75], [3.695299, 2]];
function endpointAdjustedCurve(endpoint) {
  const exponent = Math.log(endpoint) / Math.log(CHINESE_CURVE.at(-1)[0]);
  return CHINESE_CURVE.map(([speed, rate]) => [speed > 1 ? speed ** exponent : speed, rate]);
}
const GOOGLE_CURVES = {
  zh: CHINESE_CURVE,
  de: endpointAdjustedCurve(3.579655),
  en: endpointAdjustedCurve(3.577167)
};

export function isGoogleNetworkVoice(voice) {
  return voice?.localService === false && /^Google\s/i.test(voice.name || "");
}

export function speechRateForVoice(rate, voice, lang = "en") {
  const value = Number(rate);
  const requested = Number.isFinite(value) && value > 0 ? value : 1;
  if (!isGoogleNetworkVoice(voice)) return requested;
  const multiplier = Math.max(0.5, Math.min(3, requested));
  const curve = GOOGLE_CURVES[lang.split("-")[0].toLowerCase()] || GOOGLE_CURVES.en;
  const upper = Math.max(1, curve.findIndex(point => point[0] >= multiplier));
  const [lowSpeed, lowRate] = curve[upper - 1];
  const [highSpeed, highRate] = curve[upper];
  // Log interpolation preserves the approximately exponential native curve.
  const fraction = Math.log(multiplier / lowSpeed) / Math.log(highSpeed / lowSpeed);
  return lowRate + fraction * (highRate - lowRate);
}
