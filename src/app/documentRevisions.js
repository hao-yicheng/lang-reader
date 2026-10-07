import { fileNeedsExport } from "../files/fileState.js";

export function createDocumentRevisions({ saved, getSourceMode, getActiveKey, getContent, getDrafts, getEntry }) {
  const originalSourceTexts = new Map();
  const sourceEdits = new Map(Object.entries(saved.sourceEdits || {}).filter(([, edit]) =>
    edit && typeof edit.original === "string" && typeof edit.content === "string"));
  const exportedFiles = new Map(Object.entries(saved.exportedFiles || {}).filter(([, snapshot]) =>
    snapshot && typeof snapshot.name === "string" && typeof snapshot.content === "string"));
  const unsavedSourceKeys = new Set(Array.isArray(saved.unsavedSourceKeys)
    ? saved.unsavedSourceKeys.filter(key => typeof key === "string" && key) : []);

  function sourceTextForEditing(key, original) {
    originalSourceTexts.set(key, original);
    if (getSourceMode() === "document") return original;
    const edit = sourceEdits.get(key);
    if (edit?.original === original) return edit.content;
    sourceEdits.delete(key);
    return original;
  }

  function currentSourceChanged() {
    const original = originalSourceTexts.get(getActiveKey());
    return typeof original === "string" && getContent() !== original;
  }

  function saveWorkingCopy(draftId) {
    const key = getActiveKey();
    if (getSourceMode() === "document" || draftId || !originalSourceTexts.has(key)) return;
    const original = originalSourceTexts.get(key);
    if (getContent() !== original) sourceEdits.set(key, { original, content: getContent() });
    else sourceEdits.delete(key);
  }

  function isFileUnexported(key) {
    const entry = getEntry(key);
    if (!entry) return false;
    const draft = key.startsWith("draft:") ? getDrafts()[key.slice(6)] : null;
    const edit = sourceEdits.get(key);
    const original = originalSourceTexts.get(key) ?? edit?.original;
    const content = key === getActiveKey() ? getContent() : draft?.content ?? edit?.content ?? original;
    return fileNeedsExport({ kind: entry.kind, name: entry.name, content, original, exported: exportedFiles.get(key) });
  }

  function hasUnsavedSources() {
    return [...unsavedSourceKeys].some(key => key === getActiveKey()
      ? Boolean(getContent().trim())
      : key.startsWith("draft:") ? Boolean(getDrafts()[key.slice(6)]?.content.trim()) : sourceEdits.has(key));
  }

  return { originalSourceTexts, sourceEdits, exportedFiles, unsavedSourceKeys,
    sourceTextForEditing, currentSourceChanged, saveWorkingCopy, isFileUnexported, hasUnsavedSources };
}
