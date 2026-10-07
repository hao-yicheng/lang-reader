export const ACTION_TOOLTIP_DELAY = 600;

export function actionTooltipLabel(element) {
  if (element.matches(".tree-row")) return "";
  if (element.matches(".source-heading") && !element.dataset.tooltip) return "";
  return element.dataset.tooltip || element.getAttribute("title")
    || (!element.textContent.trim() ? element.getAttribute("aria-label") : "") || "";
}

export function initActionTooltips() {
  const tooltip = document.createElement("div");
  tooltip.className = "action-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  let active = null, timer = 0, savedTitle = null, label = "";
  function hide() {
    clearTimeout(timer);
    tooltip.hidden = true;
    if (active && savedTitle !== null && !active.hasAttribute("title")) active.title = savedTitle;
    active = null;
    savedTitle = null;
  }
  function schedule(target) {
    const button = target.closest("button,a,.playback-mode-label");
    if (button === active) return;
    hide();
    if (!button || !(label = actionTooltipLabel(button))) return;
    active = button;
    savedTitle = button.getAttribute("title");
    button.removeAttribute("title");
    timer = setTimeout(() => {
      if (!active?.isConnected || !active.getClientRects().length) { hide(); return; }
      tooltip.textContent = active.dataset.tooltip || active.getAttribute("title") || label;
      tooltip.hidden = false;
      const rect = active.getBoundingClientRect();
      const box = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(6, Math.min(rect.left + (rect.width - box.width) / 2, innerWidth - box.width - 6))}px`;
      tooltip.style.top = `${Math.max(6, Math.min(rect.bottom + 6, innerHeight - box.height - 6))}px`;
    }, ACTION_TOOLTIP_DELAY);
  }
  document.addEventListener("pointerover", (event) => {
    if (event.pointerType === "mouse") schedule(event.target);
  });
  document.addEventListener("pointerout", (event) => {
    if (active && !active.contains(event.relatedTarget)) hide();
  });
  document.addEventListener("focusin", (event) => {
    if (event.target.matches(":focus-visible")) schedule(event.target);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", hide);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") hide(); });
  document.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  window.addEventListener("blur", hide);
}
