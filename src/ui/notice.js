const NOTICE_DURATION_MS = 2000;

export function createNotice(root = document.body) {
  const node = document.createElement("div");
  node.className = "app-notice";
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-atomic", "true");
  root.append(node);

  let timeoutId = 0;

  return (message, anchor) => {
    window.clearTimeout(timeoutId);
    node.textContent = message;
    const rect = anchor?.getBoundingClientRect();
    const anchorVisible = rect && rect.bottom > 0 && rect.top < window.innerHeight;
    const x = anchorVisible ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const halfWidth = node.getBoundingClientRect().width / 2;
    node.style.left = `${Math.min(window.innerWidth - halfWidth - 12, Math.max(halfWidth + 12, x))}px`;
    const above = anchorVisible && rect.bottom + 72 > window.innerHeight;
    node.dataset.placement = above ? "above" : "below";
    node.style.top = `${anchorVisible ? above ? rect.top - 8 : rect.bottom + 8 : 16}px`;
    node.classList.add("visible");
    timeoutId = window.setTimeout(() => {
      node.classList.remove("visible");
      node.textContent = "";
    }, NOTICE_DURATION_MS);
  };
}
