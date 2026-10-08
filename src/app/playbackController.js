const PLAY_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const PAUSE_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
const AUTO_PLAY_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="4 19 13 12 4 5 4 19"></polygon></svg>`;

import { cursorFromUnit } from "../ui/navigationGrid.js";
import { setPosition } from "../playback/playlist.js";
import { speechLangFor } from "../i18n/languages.js";
import { REPEAT_INFINITY_VALUE } from "../core/config.js";

export function createPlaybackController({ state, units, elements, document, window, speech, t, setStatus, saveSettings, parseAndShow, renderParsedTable, updateActiveTableState, scrollActiveRowIntoView, updateTranslateLink, updateTranslateLinkForCursor, showSpeechFailureNotice, syncGapInputs, updateRangeLabels, updateTranslationVisibility }) {
  const { getValidClickMode, getClickUnitMode, getClickUnitModeForValue, getClickUnitLevel, getSelectionUnitMode, getRenderClickMode, getPlaybackUnitLevel, getValidPlaybackUnit, isFromHereClickMode, getEffectiveClickMode, findHorizontalKeyboardTarget, findVerticalKeyboardTarget, getKeyboardUnits, canUseKeyboardTarget, buildClickPlaybackRequest, buildButtonPlaybackRequest, buildPlaybackRequest, getAutoPlaybackRange, getPlaybackStartCursor, normalizePlaybackCursor, isRowPlayable, buildPlaybackUnits, applyPlaybackStart, getSentenceTailFromWord, getSingleUnit, getFromHereUnits, getColumnFromHereUnits, getRowUnits, getColumnUnits, getCellUnits, getReaderCellUnits, buildReaderSpeechSegments, isUnitAtOrAfterCursor, findUnitAtCursor, getSelectionCursor, getColumnCount, findFirstPlayableCell, findFirstPlayableColumn, range, forEachReaderDisplaySegment, splitDisplayWords, stripReaderTranslations, stripReaderNotes, stripReaderAnnotations, normalizeSpeechText, splitReaderSentences, splitDisplayWordTokens, splitSentenceRangesForDisplay, splitSentencesForDisplay, getSentenceIndexAtOffset } = units;
  function activateSelectionMode(mode) {
    const previousRenderMode = getRenderClickMode();
    state.activeSelectionMode = mode;
    if (getRenderClickMode() !== previousRenderMode) rerenderClickUnits();
    updateActiveTableState();
  }

  function activateSourceText(rowIndex, columnIndex, options) {
    if (state.isPlaying) stopPlayback({ silent: true });
    activateSelectionMode("click");
    const level = getClickUnitMode();
    const sentenceIndex = level === "cell" ? 0 : options.sentenceIndex || 0;
    const wordIndex = level === "word" ? options.wordIndex || 0 : 0;
    setActiveCursor(rowIndex, columnIndex, { sentenceIndex, wordIndex }, { translateUnitLevel: level });
    runPlayback(buildClickPlaybackRequest(level, level === "word" ? wordIndex : sentenceIndex));
  }

  function setActiveItem(index, columnIndex = state.activeColumnIndex, { syncTranslateLink = true } = {}) {
    state.activeItemIndex = index;
    state.activeColumnIndex = columnIndex;
    setPosition(state.playlist, index, 0);
    updatePositionText();
    if (syncTranslateLink) updateTranslateLink(state.items[index]?.targetText || "");
    updateActiveTableState();
    if (state.isPlaying) scrollActiveRowIntoView();
  }

  function setActiveCursor(rowIndex, columnIndex, cursor = {}, options = {}) {
    state.activeUnitCursor = {
      rowIndex,
      columnIndex,
      sentenceIndex: Math.max(0, cursor.sentenceIndex || 0),
      wordIndex: Math.max(0, cursor.wordIndex || 0)
    };
    setActiveItem(rowIndex, columnIndex, { syncTranslateLink: false });
    if (options.syncTranslateLink !== false) {
      updateTranslateLinkForCursor(state.activeUnitCursor, options.translateUnitLevel || getSelectionUnitMode());
    }
  }

  function setKeyboardClickMode(mode) {
    if (state.activeClickMode === mode) return;
    elements.modeSelect.value = mode;
    elements.modeSelect.dispatchEvent(new Event("change"));
    setStatus(mode === "word" ? t("keyboardWordMode") : t("keyboardSentenceMode"));
  }

  function applyClickModeChange(nextMode) {
    const normalizedMode = getValidClickMode(nextMode);
    if (normalizedMode === state.activeClickMode) return false;
    state.activeClickMode = normalizedMode;
    updateTranslateLinkForCursor(state.activeUnitCursor, getSelectionUnitMode());
    return true;
  }

  function getSentenceLocalWordCursor(cursor) {
    if (state.rememberedWordCursor
      && state.rememberedWordCursor.rowIndex === cursor.rowIndex
      && state.rememberedWordCursor.columnIndex === cursor.columnIndex
      && state.rememberedWordCursor.sentenceIndex === cursor.sentenceIndex) {
      return { ...state.rememberedWordCursor };
    }
    const firstWord = getCellUnits(cursor.rowIndex, cursor.columnIndex, "word")
      .find((unit) => unit.sentenceIndex === cursor.sentenceIndex);
    return firstWord ? cursorFromUnit(firstWord) : { ...cursor, wordIndex: 0 };
  }

  async function moveKeyboardSelection(direction, axis) {
    if (!state.items.length) parseAndShow();
    if (!state.items.length) return;
    const next = axis === "vertical"
      ? findVerticalKeyboardTarget(direction)
      : findHorizontalKeyboardTarget(direction);
    if (!next) return;
    const autoRequest = state.isPlaying && state.activeSelectionMode === "play" && state.activePlaybackButton === "auto" && state.playbackSession.request
      ? { ...state.playbackSession.request }
      : null;
    stopPlayback({ silent: true });
    activateSelectionMode("play");
    setActiveCursor(next.rowIndex, next.columnIndex, next.cursor);
    if (autoRequest) {
      await runPlayback(buildPlaybackRequest({
        ...autoRequest,
        kind: "auto",
        unitLevel: getPlaybackUnitLevel(),
        startUnitLevel: getPlaybackUnitLevel(),
        start: next.cursor
      }));
      return;
    }
    await speakSelectedUnit();
  }

  async function speakSelectedUnit() {
    const mode = getPlaybackUnitLevel();
    const units = getCellUnits(state.activeItemIndex, state.activeColumnIndex, mode);
    const unit = findUnitAtCursor(units, getSelectionCursor(mode)) || units[0];
    if (!unit) return;
    await runPlayback(buildPlaybackRequest({ kind: "play", unitLevel: mode, range: "single", start: cursorFromUnit(unit) }));
  }

  function cycleRepeatValue(reset) {
    const values = [1, 6, 11, 16, REPEAT_INFINITY_VALUE];
    const current = Number(elements.repeatInput.value);
    const next = reset ? 1 : values[(Math.max(0, values.indexOf(current)) + 1) % values.length];
    elements.repeatInput.value = String(next);
    syncGapInputs();
    updateRangeLabels();
    saveSettings();
  }

  function pauseForModeChange() {
    if (!state.isPlaying) return;
    speech.stop();
    state.playbackRunId += 1;
    state.isPlaying = false;
    state.isPaused = false;
    state.activePlaybackButton = "";
    resetPlaybackProgress();
    updatePlaybackButtons();
    setStatus(t("paused"));
  }

  function handlePlaybackButton(autoPlay, { source = "button" } = {}) {
    const requestedKind = autoPlay ? "auto" : "play";
    if (state.isPlaying && (source === "keyboard" || state.activePlaybackButton === requestedKind)) {
      if (state.isPaused) resumePlayback();
      else pausePlayback();
      return;
    }
    if (state.isPlaying) stopPlayback({ silent: true });
    activateSelectionMode("play");
    runPlayback(buildButtonPlaybackRequest(autoPlay));
  }

  async function runPlayback(request) {
    if (!state.items.length) parseAndShow();
    if (!state.items.length) return;
    if (state.isPlaying) stopPlayback({ silent: true });
    const playbackRequest = buildPlaybackRequest(request);
    const units = buildPlaybackUnits(playbackRequest);
    if (!units.length) return;
    let completedUnits = 0;
    const remainingCounts = [false, true].map(readTranslations => {
      const counts = Array(units.length + 1).fill(0);
      for (let index = units.length - 1; index >= 0; index--) {
        const unit = units[index];
        const audible = (readTranslations || !unit.skipWhenTranslationsDisabled)
          && Boolean(normalizeSpeechText(unit.text, unit.language));
        counts[index] = counts[index + 1] + Number(audible);
      }
      return counts;
    });
    const requestProgress = (index, fraction = 0) => (completedUnits + fraction)
      / Math.max(1, completedUnits + remainingCounts[Number(elements.readTranslationsInput.checked)][index]);
    state.playbackRunId += 1;
    const runId = state.playbackRunId;
    const selectionLevel = state.activeSelectionMode === "play" ? getPlaybackUnitLevel() : getClickUnitMode();
    state.isPlaying = true;
    state.isPaused = false;
    state.activePlaybackButton = playbackRequest.kind;
    state.playbackSession = { kind: playbackRequest.kind, request: playbackRequest, units, unitIndex: 0, selectionLevel, utteranceId: 0 };
    setPlaybackProgressImmediate(0);
    updatePlaybackButtons();
    syncSpeechSettings();
    saveSettings();
    for (let unitIndex = 0; unitIndex < units.length && state.isPlaying && runId === state.playbackRunId; unitIndex += 1) {
      const unit = units[unitIndex];

      if (unit.skipWhenTranslationsDisabled && !elements.readTranslationsInput.checked) {
        continue;
      }

      state.playbackSession.unitIndex = unitIndex;
      setActiveCursorFromUnit(unit);
      const speechText = normalizeSpeechText(unit.text, unit.language);
      if (!speechText) {
        continue;
      }
      const locateSpeechCursor = createSpeechCursorResolver(unit, speechText);
      for (let repeatIndex = 0; shouldContinueRepeat(repeatIndex, runId); repeatIndex += 1) {
        state.playbackSession.anchor = locateSpeechCursor(0);
        state.playbackSession.startAnchor ||= state.playbackSession.anchor;
        const utteranceId = ++state.playbackSession.utteranceId;
        setStatus(t("playing", unit.text));
        try {
          syncSpeechSettings();
          await speech.speak(speechText, {
            ...getSpeechOptions(unit.language),
            progressGranularity: playbackRequest.unitLevel === "word" ? "character" : "word",
            onBoundary: charIndex => {
              if (!state.isPlaying || state.isPaused || runId !== state.playbackRunId
                || utteranceId !== state.playbackSession.utteranceId
                || !Number.isInteger(charIndex) || charIndex < 0 || charIndex >= speechText.length) return;
              state.playbackSession.anchor = locateSpeechCursor(charIndex);
            },
            onProgress: fraction => {
              if (!state.isPlaying || state.isPaused || runId !== state.playbackRunId) return;
              const repeats = getRepeatCount();
              const unitProgress = Number.isFinite(repeats) ? (repeatIndex + fraction) / repeats : fraction;
              const progress = requestProgress(unitIndex, unitProgress);
              setPlaybackProgress(Math.max(state.playbackProgress.target, progress));
            }
          });
        } catch {
          if (runId === state.playbackRunId) {
            setStatus(t("speechFailed"));
            showSpeechFailureNotice();
            state.isPlaying = false;
          }
          break;
        }
        if (shouldContinueRepeat(repeatIndex + 1, runId)) await waitForPlayback(getUnitGap(), runId);
      }
      if (!state.isPlaying || runId !== state.playbackRunId) break;
      completedUnits++;
      setPlaybackProgress(Math.max(state.playbackProgress.target, requestProgress(unitIndex + 1)));
      if (unitIndex + 1 < units.length) await waitForPlayback(getBoundaryGap(unit, units[unitIndex + 1]), runId);
    }
    if (runId === state.playbackRunId) {
      const completedNaturally = state.isPlaying;
      if (completedNaturally) {
        setPlaybackProgress(1);
        await waitForProgressSettle(runId, 420);
      }
      if (runId === state.playbackRunId) {
        state.isPlaying = false;
        state.isPaused = false;
        state.activePlaybackButton = "";
        resetCursorAfterPlayback(playbackRequest);
        state.playbackSession = { kind: "", request: null, units: [], unitIndex: 0 };
        updatePlaybackButtons();
        resetPlaybackProgress();
        setStatus(completedNaturally ? t("ended") : t("speechFailed"));
      }
    }
  }

  function resetCursorAfterPlayback(request) {
    const startCursor = request.kind === "play"
      ? state.playbackSession.startAnchor || request.start
      : state.playbackSession.anchor || state.activeUnitCursor;
    state.activeItemIndex = startCursor.rowIndex;
    state.activeColumnIndex = startCursor.columnIndex;
    state.activeUnitCursor = { ...startCursor };
    setPosition(state.playlist, state.activeItemIndex, 0);
    updatePositionText();
    updateActiveTableState();
  }

  function createSpeechCursorResolver(unit, speechText) {
    const annotated = state.parsedViewMode === "reader" || state.items[unit.rowIndex]?.sourceType === "section";
    let words = getCellUnits(unit.rowIndex, unit.columnIndex, "word");
    if (unit.unitLevel === "word") words = words.filter(word => word.wordIndex === unit.wordIndex);
    else if (unit.unitLevel === "sentence") words = words.filter(word => word.sentenceIndex === unit.sentenceIndex);
    if (unit.anchorWordIndex !== undefined) words = words.filter(word => word.wordIndex >= unit.anchorWordIndex);
    else if (annotated && unit.unitLevel !== "word") {
      const segments = getCellUnits(unit.rowIndex, unit.columnIndex, unit.unitLevel)
        .filter(segment => unit.unitLevel !== "sentence" || segment.sentenceIndex === unit.sentenceIndex);
      const offset = segments.filter(segment => segment.wordIndex < unit.wordIndex && !segment.isTranslation)
        .reduce((count, segment) => count + splitDisplayWords(segment.text, unit.language).length, 0);
      words = words.slice(offset);
    }
    const fallback = cursorFromUnit(words[0] || unit);
    // Inline translations have no source-word correspondence.
    if (annotated && unit.isTranslation) return () => fallback;
    let offset = 0;
    const anchors = [];
    const normalizedText = speechText.toLowerCase();
    for (const word of words) {
      const text = normalizeSpeechText(word.text, unit.language);
      if (!text) continue;
      const start = normalizedText.indexOf(text.toLowerCase(), offset);
      if (start < 0) continue;
      anchors.push({ start, cursor: cursorFromUnit(word) });
      offset = start + text.length;
    }
    return charIndex => {
      for (let index = anchors.length - 1; index >= 0; index -= 1) {
        if (anchors[index].start <= charIndex) return anchors[index].cursor;
      }
      return fallback;
    };
  }

  function shouldContinueRepeat(repeatIndex, runId) {
    return repeatIndex < getRepeatCount() && state.isPlaying && runId === state.playbackRunId;
  }

  function syncSpeechSettings() {
    speech.setVoice(elements.voiceSelect.value);
    speech.setVoicesByLanguage(state.voiceNamesByLanguage);
  }

  function getSpeechOptions(language = state.targetLanguage) {
    return {
      rate: elements.rateInput.value,
      volume: elements.volumeInput.value,
      lang: speechLangFor(language)
    };
  }

  async function playReaderTranslation(text, cursor) {
    const translationText = String(text || "").trim();
    if (!translationText) return;
    activateSelectionMode("click");
    updateTranslateLink(translationText, state.translationLanguage);
    const start = cursor?.itemIndex >= 0 ? {
      rowIndex: cursor.itemIndex,
      columnIndex: cursor.columnIndex || 0,
      sentenceIndex: cursor.sentenceIndex || 0,
      wordIndex: cursor.wordIndex || 0
    } : state.activeUnitCursor;

    await runPlayback({
      kind: "play",
      unitLevel: "sentence",
      range: "singleText",
      text: translationText,
      start
    });
  }

  function setActiveCursorFromUnit(unit) {
    setActiveCursor(unit.rowIndex, unit.columnIndex, cursorFromUnit(unit), { syncTranslateLink: false });
  }

  function getRepeatCount() {
    const value = Number(elements.repeatInput.value);
    return value >= REPEAT_INFINITY_VALUE ? Number.POSITIVE_INFINITY : value;
  }

  function getUnitGap() {
    return Number(elements.gapInput.value) * 1000;
  }

  function getRangeGap() {
    return Number(elements.partGapInput.value) * 1000;
  }

  function getBoundaryGap(previousUnit, nextUnit) {
    return previousUnit.partIndex !== nextUnit.partIndex ? getRangeGap() : getUnitGap();
  }

  function pausePlayback() {
    if (!state.isPlaying || state.isPaused) return;
    state.isPaused = true;
    speech.pause();
    if (state.playbackProgress.frame) {
      window.cancelAnimationFrame(state.playbackProgress.frame);
      state.playbackProgress.frame = 0;
    }
    updatePlaybackButtons();
    setStatus(t("paused"));
  }

  function resumePlayback() {
    if (!state.isPlaying || !state.isPaused) return;
    state.isPaused = false;
    speech.resume();
    if (!state.playbackProgress.frame) animatePlaybackProgress();
    updatePlaybackButtons();
    setStatus(t("resumed"));
  }

  function restartPlayback() {
    stopPlayback({ silent: true });
    const first = findFirstPlayableCell();
    setActiveCursor(first.rowIndex, first.columnIndex, { sentenceIndex: 0, wordIndex: 0 });
    setPlaybackProgress(0);
    setStatus(t("restart"));
  }

  function stopPlayback({ silent = false, keepCursor = true } = {}) {
    if (keepCursor && state.playbackSession.anchor) state.activeUnitCursor = { ...state.playbackSession.anchor };
    state.playbackRunId += 1;
    state.isPlaying = false;
    state.isPaused = false;
    state.activePlaybackButton = "";
    state.playbackSession = { kind: "", request: null, units: [], unitIndex: 0 };
    if (!keepCursor) state.activeUnitCursor = { rowIndex: state.activeItemIndex, columnIndex: state.activeColumnIndex, sentenceIndex: 0, wordIndex: 0 };
    resetPlaybackProgress();
    updatePlaybackButtons();
    speech.stop();
    if (!silent) setStatus(t("stopped"));
  }

  function updatePositionText() {
    elements.positionText.textContent = t("position", state.activeItemIndex, state.items.length);
  }

  function updatePlaybackButtons() {
    const playActive = state.isPlaying && state.activePlaybackButton === "play";
    const autoActive = state.isPlaying && state.activePlaybackButton === "auto";
    elements.playButton.classList.toggle("is-playing", playActive);
    elements.autoPlayButton.classList.toggle("is-playing", autoActive);
    elements.playButton.classList.toggle("is-paused", playActive && state.isPaused);
    elements.autoPlayButton.classList.toggle("is-paused", autoActive && state.isPaused);
    elements.playButton.classList.toggle("has-progress", playActive);
    elements.autoPlayButton.classList.toggle("has-progress", autoActive);
    elements.playButton.innerHTML = playActive && !state.isPaused ? PAUSE_SVG : PLAY_SVG;
    elements.autoPlayButton.innerHTML = autoActive && !state.isPaused ? PAUSE_SVG : AUTO_PLAY_SVG;
    elements.playButton.ariaLabel = playActive && !state.isPaused ? t("pause") : t("play");
    elements.autoPlayButton.ariaLabel = autoActive && !state.isPaused ? t("pause") : t("autoPlay");
    elements.playButton.title = elements.playButton.ariaLabel;
    elements.autoPlayButton.title = elements.autoPlayButton.ariaLabel;
    elements.prevButton.ariaLabel = t("previous");
    elements.nextButton.ariaLabel = t("next");
    elements.restartButton.ariaLabel = t("restart");
    elements.prevButton.title = elements.prevButton.ariaLabel;
    elements.nextButton.title = elements.nextButton.ariaLabel;
    elements.restartButton.title = elements.restartButton.ariaLabel;
  }

  function setPlaybackProgress(value) {
    state.playbackProgress.target = Math.max(0, Math.min(1, value));
    if (!state.playbackProgress.frame) animatePlaybackProgress();
  }

  function setPlaybackProgressImmediate(value) {
    state.playbackProgress.target = Math.max(0, Math.min(1, value));
    state.playbackProgress.current = state.playbackProgress.target;
    if (state.playbackProgress.frame) {
      window.cancelAnimationFrame(state.playbackProgress.frame);
      state.playbackProgress.frame = 0;
    }
    applyPlaybackProgress(state.playbackProgress.current);
  }

  function resetPlaybackProgress() {
    state.playbackProgress.target = 0;
    state.playbackProgress.current = 0;
    if (state.playbackProgress.frame) {
      window.cancelAnimationFrame(state.playbackProgress.frame);
      state.playbackProgress.frame = 0;
    }
    applyPlaybackProgress(0);
  }

  function animatePlaybackProgress() {
    state.playbackProgress.current += (state.playbackProgress.target - state.playbackProgress.current) * 0.16;
    if (Math.abs(state.playbackProgress.target - state.playbackProgress.current) < 0.003) {
      state.playbackProgress.current = state.playbackProgress.target;
    }
    applyPlaybackProgress(state.playbackProgress.current);
    if (state.playbackProgress.current !== state.playbackProgress.target && state.isPlaying && !state.isPaused) {
      state.playbackProgress.frame = window.requestAnimationFrame(animatePlaybackProgress);
    } else {
      state.playbackProgress.frame = 0;
    }
  }

  function applyPlaybackProgress(value) {
    const activeButton = state.activePlaybackButton === "auto" ? elements.autoPlayButton : elements.playButton;
    [elements.playButton, elements.autoPlayButton].forEach((button) => {
      const progress = button === activeButton ? value : 0;
      button.style.setProperty("--progress-percent", `${(progress * 100).toFixed(2)}%`);
      button.style.setProperty("--progress-turn", `${progress.toFixed(4)}turn`);
    });
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForPlayback(ms, runId) {
    let remaining = ms;
    while (remaining > 0 && state.isPlaying && runId === state.playbackRunId) {
      if (state.isPaused) {
        await wait(80);
        continue;
      }
      const chunk = Math.min(remaining, 80);
      await wait(chunk);
      remaining -= chunk;
    }
  }

  async function waitForProgressSettle(runId, timeoutMs) {
    const start = performance.now();
    while (runId === state.playbackRunId && performance.now() - start < timeoutMs) {
      if (Math.abs(state.playbackProgress.target - state.playbackProgress.current) < 0.01) break;
      await wait(40);
    }
  }

  function beginTemporaryWordMode() {
    if (state.temporaryWordMode) return;
    state.temporaryWordMode = true;
    document.body.classList.add("temporary-word-mode");
    rerenderClickUnits();
    setStatus(t("temporaryWordMode"));
  }

  function endTemporaryWordMode() {
    if (!state.temporaryWordMode) return;
    state.temporaryWordMode = false;
    document.body.classList.remove("temporary-word-mode");
    rerenderClickUnits();
  }

  function rerenderClickUnits() {
    if (!state.isParsedView || !state.items.length) return;
    const { scrollLeft, scrollTop } = elements.parsedTableWrap;
    renderParsedTable();
    elements.parsedTableWrap.scrollLeft = scrollLeft;
    elements.parsedTableWrap.scrollTop = scrollTop;
  }

  function bindEvents() {
    elements.playButton.addEventListener("click", () => handlePlaybackButton(false, { source: "button" }));
    elements.autoPlayButton.addEventListener("click", () => handlePlaybackButton(true, { source: "button" }));
    elements.restartButton.addEventListener("click", restartPlayback);
    elements.prevButton.addEventListener("click", () => moveKeyboardSelection(-1, "horizontal"));
    elements.nextButton.addEventListener("click", () => moveKeyboardSelection(1, "horizontal"));
  }

  return { activateSelectionMode, activateSourceText, setActiveItem, setActiveCursor, setKeyboardClickMode, applyClickModeChange, getSentenceLocalWordCursor, moveKeyboardSelection, speakSelectedUnit, cycleRepeatValue, pauseForModeChange, handlePlaybackButton, runPlayback, resetCursorAfterPlayback, shouldContinueRepeat, syncSpeechSettings, getSpeechOptions, playReaderTranslation, setActiveCursorFromUnit, getRepeatCount, getUnitGap, getRangeGap, getBoundaryGap, pausePlayback, resumePlayback, restartPlayback, stopPlayback, updatePositionText, updatePlaybackButtons, setPlaybackProgress, setPlaybackProgressImmediate, resetPlaybackProgress, animatePlaybackProgress, applyPlaybackProgress, wait, waitForPlayback, waitForProgressSettle, beginTemporaryWordMode, endTemporaryWordMode, rerenderClickUnits, bindEvents };
}
