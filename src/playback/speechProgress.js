// Track utterance progress without changing its speech text or queue.
export function createSpeechProgress({ text, rate = 1, granularity = "word", onProgress,
  isSpeaking = () => false, now = () => performance.now(),
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  const length = Math.max(1, String(text).length);
  const characterMs = (/\p{Script=Han}/u.test(text) ? 180 : 75) / Math.max(0.1, Number(rate) || 1);
  const duration = Math.max(180, length * characterMs);
  let elapsed = 0;
  let startedAt = null;
  let paused = false;
  let stopped = false;
  let nativeBoundary = false;
  let progress = 0;
  let timer = 0;

  function report(value) {
    if (stopped || paused || !Number.isFinite(value)) return;
    const next = Math.max(progress, Math.min(0.97, Math.max(0, value)));
    if (next <= progress) return;
    progress = next;
    onProgress(next);
  }

  function start() {
    if (stopped || paused || startedAt !== null) return;
    startedAt = now();
  }

  function tick() {
    timer = 0;
    if (stopped || paused) return;
    if (startedAt === null && isSpeaking()) start();
    if (startedAt !== null && (!nativeBoundary || granularity === "character")) {
      report((elapsed + now() - startedAt) / duration);
    }
    if (!nativeBoundary || granularity === "character") timer = setTimer(tick, 80);
  }

  function boundary(charIndex) {
    if (stopped || paused || !Number.isFinite(charIndex) || charIndex < 0 || charIndex >= length) return;
    start();
    // An initial zero boundary alone is not evidence of continued callbacks.
    if (charIndex > 0) {
      nativeBoundary = true;
      if (granularity !== "character" && timer) {
        clearTimer(timer);
        timer = 0;
      }
      report(charIndex / length);
    }
  }

  function pause() {
    if (stopped || paused) return;
    if (startedAt !== null) elapsed += now() - startedAt;
    startedAt = null;
    paused = true;
    if (timer) clearTimer(timer);
    timer = 0;
  }

  function resume() {
    if (stopped || !paused) return;
    paused = false;
    if (elapsed > 0 || isSpeaking()) start();
    tick();
  }

  function stop() {
    if (timer) clearTimer(timer);
    timer = 0;
    stopped = true;
  }

  function finish() {
    if (stopped) return;
    stop();
    onProgress(1);
  }

  timer = setTimer(tick, 80);
  return { start, boundary, pause, resume, finish, stop };
}
