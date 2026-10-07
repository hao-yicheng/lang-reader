import {
  isStudyDocument,
  mergeStudyProgressDeltas,
  normalizeStudySource
} from "./model.js";

const STORAGE_PREFIX = "lang-reader-study:v1:";
const API_PATH = "./api/study";
const CAPABILITIES_PATH = "./api/study/capabilities";
const TOKEN_KEY = "lang-reader-study-write-token";

export function createStudyRepository({ onStatus = () => {}, debounceMs = 600, isLocalPersistenceEnabled = () => false } = {}) {
  const records = new Map();
  let capabilityPromise = null;
  let lastCapabilityTime = 0;

  async function load(source) {
    const normalizedSource = normalizeStudySource(source);
    const existing = records.get(normalizedSource);
    if (existing?.timer) clearTimeout(existing.timer);

    const local = loadLocalRecord(normalizedSource);
    const record = {
      source: normalizedSource,
      document: local?.document || null,
      baseDocument: local?.baseDocument || local?.document || null,
      etag: local?.etag || "",
      dirty: Boolean(local?.dirty),
      revision: 0,
      timer: 0,
      syncing: false,
      remoteKnown: false
    };
    records.set(normalizedSource, record);

    if (!await hasLocalServer()) return record.document;
    let remote;
    try {
      remote = await readRemote(normalizedSource);
    } catch (error) {
      record.remoteKnown = false;
      onStatus({ type: "error", source: normalizedSource, error });
      return record.document;
    }
    record.remoteKnown = true;
    if (!remote.found) {
      if (record.dirty && record.document) scheduleSync(record);
      return record.document;
    }

    record.etag = remote.etag;
    if (record.dirty && record.document) {
      record.document = mergeStudyProgressDeltas(
        record.baseDocument || remote.document,
        record.document,
        remote.document
      );
      record.baseDocument = remote.document;
      writeLocalRecord(record);
      scheduleSync(record);
      return record.document;
    }

    record.document = remote.document;
    record.baseDocument = remote.document;
    record.dirty = false;
    writeLocalRecord(record);
    return record.document;
  }

  function save(source, document) {
    if (!isStudyDocument(document)) {
      onStatus({
        type: "error",
        source: normalizeStudySource(source),
        error: new Error("Invalid Study document")
      });
      return false;
    }
    const normalizedSource = normalizeStudySource(source);
    const existing = records.get(normalizedSource);
    const record = existing || {
      source: normalizedSource,
      document: null,
      baseDocument: null,
      etag: "",
      dirty: false,
      revision: 0,
      timer: 0,
      syncing: false,
      remoteKnown: false
    };
    record.document = clone(document);
    record.dirty = true;
    record.revision = (record.revision || 0) + 1;
    records.set(normalizedSource, record);
    const persistedLocally = writeLocalRecord(record);
    scheduleSync(record);
    return persistedLocally;
  }

  async function syncNow(source) {
    const record = records.get(normalizeStudySource(source));
    if (!record?.dirty || record.syncing || !record.document || !await hasLocalServer()) return false;
    record.syncing = true;
    clearTimeout(record.timer);
    record.timer = 0;

    try {
      if (!record.remoteKnown) {
        const remote = await readRemote(record.source);
        if (remote.found) {
          record.document = mergeStudyProgressDeltas(
            record.baseDocument || remote.document,
            record.document,
            remote.document
          );
          record.baseDocument = clone(remote.document);
          record.etag = remote.etag;
        } else {
          record.baseDocument = null;
          record.etag = "";
        }
        record.remoteKnown = true;
      }
      const targetRevision = record.revision;
      let sentDocument = clone(record.document);
      let sentBaseDocument = clone(record.baseDocument);
      let sentEtag = record.etag;
      let response = await writeRemoteWithDoc(record.source, sentDocument, sentEtag);
      if (response?.conflict) {
        const remote = await readRemote(record.source);
        if (!remote.found) throw new Error("Study progress conflict could not be reloaded");
        sentDocument = mergeStudyProgressDeltas(
          sentBaseDocument || remote.document,
          sentDocument,
          remote.document
        );
        sentBaseDocument = clone(remote.document);
        sentEtag = remote.etag;
        response = await writeRemoteWithDoc(record.source, sentDocument, sentEtag);
      }
      if (!response?.ok) throw new Error(response?.message || "Study progress sync failed");
      record.etag = response.etag || record.etag;
      record.baseDocument = clone(sentDocument);
      if (record.revision === targetRevision) {
        record.document = clone(sentDocument);
        record.dirty = false;
      }
      writeLocalRecord(record);
      onStatus({
        type: record.dirty ? "pending" : "synced",
        source: record.source
      });
      return true;
    } catch (error) {
      record.remoteKnown = false;
      record.dirty = true;
      writeLocalRecord(record);
      onStatus({ type: "error", source: record.source, error });
      return false;
    } finally {
      record.syncing = false;
      if (record.dirty) scheduleSync(record);
    }
  }

  async function hasLocalServer() {
    if (isLocalPersistenceEnabled() !== true) return false;
    const now = Date.now();
    if (!capabilityPromise || (now - lastCapabilityTime > 30000)) {
      lastCapabilityTime = now;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      capabilityPromise = fetch(CAPABILITIES_PATH, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal
      })
        .then((response) => {
          clearTimeout(timer);
          return response.ok ? response.json() : null;
        })
        .then((value) => Boolean(value?.studyPersistence))
        .catch(() => {
          clearTimeout(timer);
          capabilityPromise = null;
          return false;
        });
    }
    return capabilityPromise;
  }

  function scheduleSync(record) {
    clearTimeout(record.timer);
    if (isLocalPersistenceEnabled() !== true) return;
    record.timer = window.setTimeout(() => syncNow(record.source), debounceMs);
  }

  function writeLocalRecord(record) {
    try {
      localStorage.setItem(getStorageKey(record.source), JSON.stringify({
        document: record.document,
        baseDocument: record.baseDocument,
        etag: record.etag,
        dirty: record.dirty
      }));
      return true;
    } catch (error) {
      window.console.warn("Study progress save failed:", error);
      onStatus({ type: "error", source: record.source, error });
      return false;
    }
  }

  return { load, save, syncNow, hasLocalServer };
}

export function exportStudyDocument(document, fileName = "study-progress.study.json") {
  if (!isStudyDocument(document)) return;
  const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = documentElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importStudyDocument(file) {
  const value = JSON.parse(await file.text());
  if (!isStudyDocument(value)) throw new Error("Unsupported Study JSON");
  return value;
}

export function getStudyExportName(source) {
  const name = normalizeStudySource(source).split("/").pop() || "study";
  return `${name.replace(/\.(md|txt|csv|tsv)$/i, "")}.study.json`;
}

function loadLocalRecord(source) {
  try {
    const value = JSON.parse(localStorage.getItem(getStorageKey(source)) || "null");
    if (!isStudyDocument(value?.document)) return null;
    return {
      ...value,
      baseDocument: isStudyDocument(value.baseDocument) ? value.baseDocument : value.document
    };
  } catch {
    return null;
  }
}

async function readRemote(source) {
  const url = new URL(API_PATH, window.location.href);
  url.searchParams.set("source", source);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  let response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 404) return { found: false };
  if (!response.ok) throw new Error(`Study progress read failed: HTTP ${response.status}`);
  const document = await response.json();
  if (!isStudyDocument(document)) throw new Error("Invalid Study JSON from local server");
  return { found: true, document, etag: response.headers.get("ETag") || "" };
}

async function writeRemoteWithDoc(source, document, etag = "") {
  const url = new URL(API_PATH, window.location.href);
  url.searchParams.set("source", source);
  const headers = { "Content-Type": "application/json" };
  if (etag) headers["If-Match"] = etag;
  const token = getWriteToken();
  if (token) headers["X-Study-Token"] = token;
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(document)
  });
  if (response.status === 409 || response.status === 412) return { conflict: true };
  if (!response.ok) return { ok: false, message: `HTTP ${response.status}` };
  return { ok: true, etag: response.headers.get("ETag") || "" };
}

function getWriteToken() {
  try {
    const url = new URL(window.location.href);
    const queryToken = url.searchParams.get("studyToken");
    if (queryToken) {
      sessionStorage.setItem(TOKEN_KEY, queryToken);
      url.searchParams.delete("studyToken");
      window.history.replaceState(null, "", url);
      return queryToken;
    }
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function getStorageKey(source) {
  return `${STORAGE_PREFIX}${encodeURIComponent(source)}`;
}

function documentElement(tagName) {
  return window.document.createElement(tagName);
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
