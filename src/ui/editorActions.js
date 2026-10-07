export const EDITOR_ACTION_PATHS = Object.freeze({
  new: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m14.5 4.5 5 5M4 20l1.2-5.2L16.8 3.2a1.8 1.8 0 0 1 2.5 0l1.5 1.5a1.8 1.8 0 0 1 0 2.5L9.2 18.8Z"/>',
  parse: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2"/>',
  raw: '<path d="m7 6-5 6 5 6m10-12 5 6-5 6M14 4l-4 16"/>',
  copied: '<path d="m5 12 4 4L19 6"/>',
  more: '<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>',
  delete: '<path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6"/>',
});

export function editorActionSvg(action) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EDITOR_ACTION_PATHS[action]}</svg>`;
}

export function setEditorActionButton(button, action, label) {
  button.classList.add("editor-action-button");
  if (button.dataset.editorAction !== action) {
    button.innerHTML = editorActionSvg(action);
    button.dataset.editorAction = action;
  }
  button.title = label;
  button.setAttribute("aria-label", label);
}
