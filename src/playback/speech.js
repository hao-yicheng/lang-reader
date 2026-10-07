import { getVoiceBaseName } from "../i18n/languages.js";
import { createSpeechProgress } from "./speechProgress.js";

export function createSpeech() {
  const synth = window.speechSynthesis;
  let voices = [];
  let selectedVoiceName = "";
  let selectedVoiceNamesByLanguage = {};
  let activeSpeech = null;

  function loadVoices() {
    voices = synth ? synth.getVoices() : [];
    return voices;
  }

  function getVoices() {
    return voices.length ? voices : loadVoices();
  }

  function setVoice(name) {
    selectedVoiceName = name || "";
  }

  function setVoicesByLanguage(value) {
    selectedVoiceNamesByLanguage = value && typeof value === "object" ? { ...value } : {};
  }

  function getSelectedVoice(lang = "de-DE") {
    const available = getVoices();
    const language = lang.slice(0, 2).toLowerCase();
    const languageVoiceName = selectedVoiceNamesByLanguage[language] || selectedVoiceName;
    return available.find((voice) => getVoiceBaseName(voice.name) === languageVoiceName && voice.lang.toLowerCase().startsWith(language))
      || available.find((voice) => voice.name === languageVoiceName && voice.lang.toLowerCase().startsWith(language))
      || available.find((voice) => voice.lang.toLowerCase().startsWith(language) && voice.default)
      || available.find((voice) => voice.lang.toLowerCase().startsWith(language))
      || available.find((voice) => getVoiceBaseName(voice.name) === languageVoiceName)
      || available.find((voice) => voice.name === languageVoiceName)
      || available.find((voice) => /german|deutsch/i.test(voice.name))
      || null;
  }

  function speak(text, options = {}) {
    if (!synth || !text) return Promise.resolve();
    cancelActiveSpeech("Speech replaced");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || "de-DE";
    utterance.rate = Number(options.rate || 1);
    utterance.pitch = 1;
    utterance.volume = Number(options.volume ?? 1);
    const voice = getSelectedVoice(utterance.lang);
    if (voice) utterance.voice = voice;

    return new Promise((resolve, reject) => {
      const session = {
        utterance,
        resolve,
        reject,
        timeoutId: 0,
        timeoutMs: getSpeechTimeout(text, utterance.rate),
        settled: false,
        progress: null
      };
      activeSpeech = session;

      if (typeof options.onProgress === "function") {
        session.progress = createSpeechProgress({
          text, rate: utterance.rate, granularity: options.progressGranularity,
          isSpeaking: () => activeSpeech === session && synth.speaking && !synth.paused,
          onProgress: value => {
            if (activeSpeech === session && !session.settled) options.onProgress(value);
          }
        });
        utterance.onstart = () => session.progress.start();
        utterance.onpause = () => session.progress.pause();
        utterance.onresume = () => session.progress.resume();
      }
      if (session.progress || typeof options.onBoundary === "function") utterance.onboundary = event => {
        if (activeSpeech !== session || session.settled || synth.paused) return;
        session.progress?.boundary(event.charIndex);
        if (Number.isInteger(event.charIndex) && event.charIndex >= 0 && event.charIndex < text.length) {
          options.onBoundary?.(event.charIndex);
        }
      };

      utterance.onend = () => {
        settleSpeech(session);
      };
      utterance.onerror = (event) => {
        settleSpeech(session, event.error || event);
      };
      scheduleSpeechTimeout(session);
      synth.speak(utterance);
    });
  }

  function stop() {
    cancelActiveSpeech("Speech stopped");
  }

  function pause() {
    if (!synth) return;
    activeSpeech?.progress?.pause();
    if (activeSpeech?.timeoutId) {
      clearTimeout(activeSpeech.timeoutId);
      activeSpeech.timeoutId = 0;
    }
    synth.pause();
  }

  function resume() {
    if (!synth) return;
    synth.resume();
    activeSpeech?.progress?.resume();
    if (activeSpeech && !activeSpeech.settled) scheduleSpeechTimeout(activeSpeech);
  }

  function scheduleSpeechTimeout(session) {
    if (!session || session.settled || activeSpeech !== session) return;
    if (session.timeoutId) clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(() => {
      if (activeSpeech !== session || session.settled) return;
      window.console.warn("Speech Synthesis hung. Timeout triggered.");
      settleSpeech(session, new Error("Timeout"));
      synth.cancel();
    }, session.timeoutMs);
  }

  function settleSpeech(session, error = null) {
    if (!session || session.settled) return;
    if (error) session.progress?.stop();
    else session.progress?.finish();
    session.settled = true;
    if (session.timeoutId) clearTimeout(session.timeoutId);
    session.utterance.onend = null;
    session.utterance.onerror = null;
    session.utterance.onstart = null;
    session.utterance.onboundary = null;
    session.utterance.onpause = null;
    session.utterance.onresume = null;
    if (activeSpeech === session) activeSpeech = null;
    if (error) session.reject(error);
    else session.resolve();
  }

  function cancelActiveSpeech(reason) {
    const session = activeSpeech;
    if (session) settleSpeech(session, new Error(reason));
    if (synth) synth.cancel();
  }

  function getSpeechTimeout(text, rate) {
    const normalizedRate = Math.max(0.5, Number(rate) || 1);
    const estimatedMs = String(text).length * 650 / normalizedRate;
    return Math.min(180000, Math.max(30000, Math.ceil(estimatedMs)));
  }

  if (synth) {
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  return { getVoices, loadVoices, setVoice, setVoicesByLanguage, getSelectedVoice, speak, stop, pause, resume };
}
