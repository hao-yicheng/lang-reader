export function createTextUnits({ document, focusContent }) {
  function setInteractiveGroupState(groupId, active) {
    document.querySelectorAll("[data-interaction-id]").forEach(unit => {
      if (unit.dataset.interactionId === groupId) unit.classList.toggle("hovered-unit", active);
    });
  }

  function createInteractiveTextUnit(text, options = {}) {
    const unit = document.createElement("span");
    unit.className = `interactive-text-unit ${options.className || ""}`.trim();
    unit.textContent = text;
    if (options.groupId) unit.dataset.interactionId = options.groupId;
    unit.addEventListener("click", event => {
      event.stopPropagation();
      focusContent();
      options.onActivate?.();
    });
    if (options.groupId) {
      unit.addEventListener("pointerenter", () => setInteractiveGroupState(options.groupId, true));
      unit.addEventListener("pointerleave", () => setInteractiveGroupState(options.groupId, false));
      unit.addEventListener("focus", () => setInteractiveGroupState(options.groupId, true));
      unit.addEventListener("blur", () => setInteractiveGroupState(options.groupId, false));
    }
    return unit;
  }

  return { createInteractiveTextUnit };
}
