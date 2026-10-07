import { SUPPORTED_FILE_RE } from '../core/config.js';

export function uploadEntries(files, folder = false) {
  return [...files].filter(file => SUPPORTED_FILE_RE.test(file.name)).map(file => {
    const path = folder ? file.webkitRelativePath || file.name : file.name;
    return { file, name: path, treePath: path, fromFolder: folder,
      key: folder ? `folder:${path}` : `local-file:${file.name}:${file.size}:${file.lastModified}` };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function droppedEntries(items) {
  const roots = [...items].filter(item => item.kind === 'file').map(item => ({ entry: (item.getAsEntry || item.webkitGetAsEntry)?.call(item), file: item.getAsFile() }));
  const result = [];
  async function visit(entry, prefix, fromFolder) {
    const path = prefix + entry.name;
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      if (SUPPORTED_FILE_RE.test(file.name)) result.push({ file, name: path, treePath: path, fromFolder,
        key: fromFolder ? `folder:${path}` : `local-file:${file.name}:${file.size}:${file.lastModified}` });
      return;
    }
    const reader = entry.createReader();
    while (true) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await visit(child, `${path}/`, true);
    }
  }
  for (const { entry, file } of roots) {
    if (entry) await visit(entry, '', entry.isDirectory);
    else if (file) result.push(...uploadEntries([file]));
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
