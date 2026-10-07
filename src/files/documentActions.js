export function documentActionState({ kind, parsed, study = false, changed = false }) {
  const guide = kind === "document";
  const deletable = kind === "draft" || kind === "imported";
  return {
    hidden: study,
    readOnly: guide,
    deletable: !study && deletable,
    toggle: parsed ? (guide ? "raw" : "edit") : "parse",
    toggleLabel: parsed ? (guide ? "showRaw" : "editAction") : (guide ? "returnToReading" : "parseAction"),
    restore: !study && !guide && kind !== "draft" && changed,
  };
}

export function exportFileName(name) {
  const base = String(name || "").split(/[\\/]/).at(-1) || "lang-reader-note.md";
  return /\.(md|txt|csv|tsv)$/i.test(base) ? base : `${base}.md`;
}

export function contentHasTranslations(items, { reader, readerSegments, roles = [] }) {
  return items.some(item => !["section", "instruction"].includes(item.sourceType)
    && (item.parts || []).some((part, index) => reader
      ? readerSegments(part.text || "").some(segment => segment.isTranslation)
      : Boolean(String(part.text || "").trim()) && (part.role === "translation" || roles[index] === "translation")));
}
