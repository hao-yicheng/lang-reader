export const INDEX_COLUMN_WIDTH = 44;
export const HIDDEN_COLUMN_WIDTH = 14;
export const MIN_VISIBLE_COLUMN_WIDTH = 260;

export function getTableWidth(widths) {
  const total = INDEX_COLUMN_WIDTH + widths.reduce((sum, width) => sum + width, 0);
  return `${total}px`;
}

export function getRenderedColumnWidths({
  columnCount,
  columnRoles,
  columnWidths,
  availableWidth,
  minVisibleWidth = MIN_VISIBLE_COLUMN_WIDTH
}) {
  const widths = Array.from({ length: columnCount }, (_, index) => getBaseColumnWidth(index, columnRoles, columnWidths, minVisibleWidth));
  const visibleIndexes = getVisibleIndexes(widths, columnRoles);
  if (!visibleIndexes.length) return widths;

  const total = INDEX_COLUMN_WIDTH + sum(widths);
  const hiddenTotal = widths.reduce((value, width, index) => columnRoles[index] === "hide" ? value + width : value, 0);
  const minTotal = INDEX_COLUMN_WIDTH + hiddenTotal + visibleIndexes.reduce((value, index) => value + getMinColumnWidth(index, columnRoles, minVisibleWidth), 0);
  const targetTotal = Math.max(Math.floor(availableWidth || 0), minTotal);
  if (total > targetTotal) return shrinkWidthsToTotal(widths, targetTotal - INDEX_COLUMN_WIDTH, columnRoles, minVisibleWidth);

  const surplus = targetTotal - total;
  if (surplus <= 0) return widths;
  const extra = Math.floor(surplus / visibleIndexes.length);
  let remainder = surplus - extra * visibleIndexes.length;
  visibleIndexes.forEach((index) => {
    widths[index] += extra + (remainder > 0 ? 1 : 0);
    remainder -= 1;
  });
  return widths;
}

export function redistributeColumnWidths({ startWidths, index, nextWidth, columnRoles, minVisibleWidth = MIN_VISIBLE_COLUMN_WIDTH }) {
  const widths = [...startWidths];
  const delta = nextWidth - startWidths[index];
  widths[index] = nextWidth;

  if (delta <= 0) {
    const target = getResizableTargetsAfter(index, widths.length, columnRoles)[0];
    if (Number.isInteger(target)) widths[target] -= delta;
    return widths;
  }

  let remaining = delta;
  for (const target of getResizableTargetsAfter(index, widths.length, columnRoles)) {
    const shrink = Math.min(remaining, Math.max(0, widths[target] - getMinColumnWidth(target, columnRoles, minVisibleWidth)));
    widths[target] -= shrink;
    remaining -= shrink;
    if (remaining <= 0) break;
  }
  return widths;
}

export function getShrinkCapacity(widths, index, columnRoles, minVisibleWidth = MIN_VISIBLE_COLUMN_WIDTH) {
  return getResizableTargetsAfter(index, widths.length, columnRoles)
    .reduce((value, target) => value + Math.max(0, widths[target] - getMinColumnWidth(target, columnRoles, minVisibleWidth)), 0);
}

export function isLastResizableColumn(index, columnCount, columnRoles) {
  return !getResizableTargetsAfter(index, columnCount, columnRoles).length;
}

export function getMinColumnWidth(index, columnRoles, minVisibleWidth = MIN_VISIBLE_COLUMN_WIDTH) {
  if (columnRoles[index] === "hide") return HIDDEN_COLUMN_WIDTH;
  return minVisibleWidth;
}

export function getBaseColumnWidth(index, columnRoles, columnWidths, minVisibleWidth = MIN_VISIBLE_COLUMN_WIDTH) {
  if (columnRoles[index] === "hide") return HIDDEN_COLUMN_WIDTH;
  return Number(columnWidths[index]) || minVisibleWidth;
}

function shrinkWidthsToTotal(widths, targetContentWidth, columnRoles, minVisibleWidth) {
  const next = [...widths];
  let overflow = sum(next) - targetContentWidth;
  const shrinkable = getVisibleIndexes(next, columnRoles);
  while (overflow > 0) {
    const targets = shrinkable.filter((index) => next[index] > getMinColumnWidth(index, columnRoles, minVisibleWidth));
    if (!targets.length) break;
    const step = Math.max(1, Math.ceil(overflow / targets.length));
    for (const index of targets) {
      const shrink = Math.min(step, next[index] - getMinColumnWidth(index, columnRoles, minVisibleWidth), overflow);
      next[index] -= shrink;
      overflow -= shrink;
      if (overflow <= 0) break;
    }
  }
  return next;
}

function getResizableTargetsAfter(index, columnCount, columnRoles) {
  return Array.from({ length: columnCount - index - 1 }, (_, offset) => index + offset + 1)
    .filter((target) => columnRoles[target] !== "hide");
}

function getVisibleIndexes(widths, columnRoles) {
  return widths.map((_, index) => index).filter((index) => columnRoles[index] !== "hide");
}

function sum(values) {
  return values.reduce((value, width) => value + width, 0);
}
