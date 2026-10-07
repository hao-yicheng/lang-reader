export function createSourceWarnings() {
  const failures = new Map();
  let shown = false;
  return {
    report({ path, reason = "UNAVAILABLE" }) {
      if (typeof path === "string" && path) failures.set(path, { path, reason });
    },
    show({ title, message, close, root = document.body }) {
      if (shown || !failures.size) return false;
      shown = true;
      const dialog = document.createElement("dialog");
      dialog.className = "source-warning-dialog";
      dialog.setAttribute("aria-labelledby", "sourceWarningTitle");
      const heading = document.createElement("h2");
      heading.id = "sourceWarningTitle";
      heading.textContent = title;
      const description = document.createElement("p");
      description.textContent = message;
      const list = document.createElement("ul");
      for (const failure of failures.values()) {
        const item = document.createElement("li");
        item.textContent = `${failure.path} (${failure.reason})`;
        list.append(item);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = close;
      button.addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => dialog.remove(), { once: true });
      dialog.append(heading, description, list, button);
      root.append(dialog);
      dialog.showModal();
      return true;
    }
  };
}
