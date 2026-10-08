import { TRANSLATION_PROVIDERS, buildTranslateUrl } from "../ui/translateLinks.js";
import { LANGUAGES } from "../i18n/languages.js";
import { contentHasTranslations } from "../files/documentActions.js";
import { SPEAKER_ON_SVG, SPEAKER_MUTE_SVG } from "../ui/uiIcons.js";
import { repositionAllSegmentedControls as repositionAll } from "../ui/customControls.js";

export function createTranslationUi({ state, services, elements, document, window, saveSettings, refreshVoices, updateParagraphOptionsVisibility, getSingleUnit, normalizePlaybackCursor, getValidLanguageCode, buildReaderSpeechSegments, getStudyColumnRoles }) {
  function renderTranslatorPicker() {
    elements.translatorPicker.innerHTML = "";
    const indicator = document.createElement("div");
    indicator.className = "segment-indicator";
    indicator.setAttribute("aria-hidden", "true");
    elements.translatorPicker.append(indicator);
    elements.translatorLinks = TRANSLATION_PROVIDERS.map((provider) => {
      const link = document.createElement("a");
      link.className = "translator-option segment-btn";
      link.dataset.translationProvider = provider.id;
      link.href = buildTranslateUrl(provider.id, "", state.targetLanguage, state.uiLanguage);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.title = provider.name;
      link.setAttribute("aria-label", provider.name);
      link.textContent = provider.mark;
      elements.translatorPicker.append(link);
      return link;
    });
  }

  function syncTranslationButtons() {
    const hideTrans = elements.showTranslationsInput.checked;
    const readTrans = elements.readTranslationsInput.checked;
    const readerTranslationControls = state.isParsedView && state.parsedViewMode === "reader" && docHasTranslations() && !services.studyController.isActive();

    elements.toggleTranslationButton.classList.toggle("active", !hideTrans);
    elements.toggleTranslationButton.setAttribute("aria-pressed", String(!hideTrans));
    elements.toggleReadTranslationButton.classList.toggle("active", readTrans);

    // Dynamically set the SVG to reflect active or mute state
    elements.toggleReadTranslationButton.innerHTML = readTrans ? SPEAKER_ON_SVG : SPEAKER_MUTE_SVG;

    elements.toggleTranslationButton.hidden = !readerTranslationControls;

    elements.toggleReadTranslationButton.hidden = !readerTranslationControls;
    elements.toggleReadTranslationButton.classList.toggle("collapsed", !readerTranslationControls || hideTrans);
  }

  function updateTranslateLink(text, sourceLanguage = state.targetLanguage) {
    const selectedText = text || state.activeTranslateSelection.text || state.items[state.activeItemIndex]?.targetText || "";
    const selectedSource = sourceLanguage || state.activeTranslateSelection.sourceLanguage || state.targetLanguage;
    state.activeTranslateSelection = { text: selectedText, sourceLanguage: selectedSource };
    const target = getTranslationTargetLanguage(selectedSource);
    elements.translatorLinks.forEach((link) => {
      const provider = getValidTranslationProvider(link.dataset.translationProvider);
      link.href = buildTranslateUrl(provider, selectedText, selectedSource, target);
    });
    updateTranslatorPickerState();
  }

  function updateTranslateLinkForCursor(cursor, unitLevel) {
    const units = getSingleUnit(normalizePlaybackCursor(cursor), unitLevel)
      .filter((unit) => !unit.skipWhenTranslationsDisabled || elements.readTranslationsInput.checked);
    const selectedText = units.map((unit) => unit.text).join(" ").trim();
    updateTranslateLink(selectedText, units[0]?.language || state.targetLanguage);
  }

  function updateTranslatorPickerState() {
    elements.translatorLinks.forEach((link) => {
      const active = link.dataset.translationProvider === state.translationProvider;
      link.classList.toggle("active", active);
      link.setAttribute("aria-current", String(active));
    });
    window.requestAnimationFrame(() => repositionAll());
  }

  function openCurrentTranslation() {
    const link = elements.translatorLinks.find(
      (candidate) => candidate.dataset.translationProvider === state.translationProvider
    );
    if (!link?.href) return;
    window.open(link.href, "_blank", "noopener,noreferrer");
  }

  function getTranslationTargetLanguage(sourceLanguage) {
    const source = getValidLanguageCode(sourceLanguage, state.targetLanguage);
    if (source !== state.uiLanguage) return state.uiLanguage;
    if (state.targetLanguage !== source) return state.targetLanguage;
    if (state.translationLanguage !== source) return state.translationLanguage;
    return source === "en" ? "de" : "en";
  }

  function getValidTranslationProvider(provider) {
    return TRANSLATION_PROVIDERS.some(({ id }) => id === provider) ? provider : "google";
  }

  function updateTranslationVisibility() {
    document.body.classList.toggle("hide-translations", elements.showTranslationsInput.checked);
  }

  function docHasTranslations() {
    return contentHasTranslations(state.items, {
      reader: state.parsedViewMode === "reader",
      readerSegments: buildReaderSpeechSegments,
      roles: getStudyColumnRoles(state.items),
    });
  }

  function initTranslateWidget() {
    const showTranslate = state.sourceMode === "document";
    elements.embedTranslateWrap.hidden = !showTranslate;

    if (!showTranslate) return;

    const consentGranted = state.saved.translateConsentGranted === true;
    elements.translateConsentBanner.hidden = consentGranted;

    const target = document.querySelector("#google_translate_element");
    if (target) {
      target.hidden = !consentGranted;
    }

    if (consentGranted) {
      lazyLoadGoogleTranslate();
    }
  }

  function enableTranslate() {
    state.saved.translateConsentGranted = true;
    saveSettings();
    elements.translateConsentBanner.hidden = true;
    const target = document.querySelector("#google_translate_element");
    if (target) {
      target.hidden = false;
    }
    lazyLoadGoogleTranslate();
  }

  function googleTranslateLanguages() {
    return LANGUAGES.map(lang => {
      const code = lang.code;
      if (code === "zh") return "zh-CN";
      return code;
    }).join(",");
  }

  function lazyLoadGoogleTranslate() {
    if (window.googleTranslateElementInitLoaded) return;
    window.googleTranslateElementInitLoaded = true;

    window.googleTranslateElementInit = function() {
      new window.google.translate.TranslateElement({
        pageLanguage: 'auto',
        includedLanguages: googleTranslateLanguages(),
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
      }, 'google_translate_element');
    };

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.body.appendChild(script);
  }

  function bindEvents() {
    elements.readTranslationsInput.addEventListener("change", () => {
      saveSettings();
      syncTranslationButtons();
      refreshVoices();
    });

    elements.showTranslationsInput.addEventListener("change", () => {
      saveSettings();
      updateTranslationVisibility();
      updateParagraphOptionsVisibility();
      syncTranslationButtons();
      refreshVoices();
    });

    elements.toggleTranslationButton.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") event.stopPropagation();
    });
    elements.toggleTranslationButton.addEventListener("click", () => {
      elements.showTranslationsInput.checked = !elements.showTranslationsInput.checked;
      elements.showTranslationsInput.dispatchEvent(new Event("change"));
    });

    elements.toggleReadTranslationButton.addEventListener("click", () => {
      elements.readTranslationsInput.checked = !elements.readTranslationsInput.checked;
      elements.readTranslationsInput.dispatchEvent(new Event("change"));
    });

    elements.enableEmbedTranslateButton.addEventListener("click", enableTranslate);

    elements.translatorLinks.forEach((link) => {
      link.addEventListener("click", () => {
        state.translationProvider = getValidTranslationProvider(link.dataset.translationProvider);
        updateTranslatorPickerState();
        saveSettings();
      });
    });
  }

  return { renderTranslatorPicker, syncTranslationButtons, updateTranslateLink, updateTranslateLinkForCursor, updateTranslatorPickerState, openCurrentTranslation, getTranslationTargetLanguage, getValidTranslationProvider, updateTranslationVisibility, docHasTranslations, initTranslateWidget, enableTranslate, googleTranslateLanguages, lazyLoadGoogleTranslate, bindEvents };
}
