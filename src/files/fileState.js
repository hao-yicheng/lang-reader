export function fileNeedsExport({ kind, name, content, original, exported }) {
  if (kind === "document" || typeof content !== "string") return false;
  if (exported?.name === name && exported.content === content) return false;
  if (kind === "draft") return Boolean(content.trim());
  return typeof original === "string" && content !== original;
}

export function recoverableDrafts(drafts) {
  return Object.fromEntries(Object.entries(drafts).filter(([, draft]) => !draft.provisional || Boolean(draft.content.trim())));
}
