import { migrateDocumentPath } from "./config.js";

const KEY = "lang-reader-state";
const FILE_GROUP_ORDER_KEY = "lang-reader-file-group-order";

export function loadFileGroupOrder() {
  try {
    const order = JSON.parse(localStorage.getItem(FILE_GROUP_ORDER_KEY) || "[]");
    return Array.isArray(order) ? [...new Set(order.filter(item => typeof item === "string"))] : [];
  } catch { return []; }
}

export function saveFileGroupOrder(order) {
  try { localStorage.setItem(FILE_GROUP_ORDER_KEY, JSON.stringify(order)); }
  catch (error) { console.warn("File group order save failed:", error); }
}

export function loadState() {
  try {
    return migrateSavedSourcePaths(JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    return {};
  }
}

export function migrateSavedSourcePaths(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return saved;
  const next = { ...saved };
  for (const key of ["samplePath", "documentPath", "lastDocumentPath", "lastImportSourceKey", "activeSourceKey"]) {
    if (key in next) next[key] = migrateDocumentPath(next[key]);
  }
  for (const key of ["recentSourceKeys", "unsavedSourceKeys"]) {
    if (Array.isArray(next[key])) next[key] = next[key].map(migrateDocumentPath);
  }
  for (const key of ["articleSettings", "sourceEdits", "exportedFiles"]) {
    const entries = next[key];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue;
    next[key] = Object.fromEntries(Object.entries(entries).map(([path, value]) => {
      const migrated = migrateDocumentPath(path);
      return [migrated, Object.hasOwn(entries, migrated) ? entries[migrated] : value];
    }));
  }
  if (next.userDrafts && typeof next.userDrafts === "object") {
    next.userDrafts = Object.fromEntries(Object.entries(next.userDrafts).map(([id, draft]) => [id,
      draft?.returnSource ? { ...draft, returnSource: { ...draft.returnSource, key: migrateDocumentPath(draft.returnSource.key) } } : draft]));
  }
  return next;
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    window.console.warn("localStorage save failed:", error);
    return false;
  }
}
