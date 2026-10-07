export function cursorFromUnit(unit) {
  return {
    rowIndex: unit.rowIndex,
    columnIndex: unit.columnIndex,
    sentenceIndex: unit.sentenceIndex || 0,
    wordIndex: unit.wordIndex || 0
  };
}

export function sameCursor(left, right) {
  return left.rowIndex === right.rowIndex
    && left.columnIndex === right.columnIndex
    && (left.sentenceIndex || 0) === (right.sentenceIndex || 0)
    && (left.wordIndex || 0) === (right.wordIndex || 0);
}

export function getCellNavigationTargets(units, unitLevel) {
  if (!units.length) return [];
  if (unitLevel === "word") return units.map(toNavigationTarget);
  if (unitLevel === "cell") return [toNavigationTarget(units.find((unit) => !unit.isTranslation) || units[0])];

  const targets = new Map();
  units.forEach((unit) => {
    const key = String(unit.sentenceIndex || 0);
    const current = targets.get(key);
    if (!current || (current.isTranslation && !unit.isTranslation)) {
      targets.set(key, toNavigationTarget(unit));
    }
  });
  return [...targets.values()];
}

export function flattenNavigationTargets(items, getCellUnits, unitLevel) {
  return items.flatMap((item, rowIndex) => (
    item.parts.flatMap((part, columnIndex) => (
      getCellNavigationTargets(getCellUnits(rowIndex, columnIndex, unitLevel), unitLevel)
    ))
  ));
}

export function findHorizontalTarget(targets, cursor, direction, canUseTarget = () => true) {
  if (!targets.length) return null;
  const currentIndex = targets.findIndex((target) => sameCursor(target.cursor, cursor));
  let index = currentIndex >= 0 ? currentIndex : (direction > 0 ? -1 : targets.length);
  while (true) {
    index += direction;
    if (index < 0 || index >= targets.length) return null;
    if (canUseTarget(targets[index])) return targets[index];
  }
}

export function findVerticalTarget({
  items,
  cursor,
  direction,
  unitLevel,
  getCellUnits,
  canUseTarget = () => true
}) {
  const currentTargets = getCellNavigationTargets(
    getCellUnits(cursor.rowIndex, cursor.columnIndex, unitLevel),
    unitLevel
  ).filter(canUseTarget);
  const currentIndex = currentTargets.findIndex((target) => sameCursor(target.cursor, cursor));
  if (currentIndex >= 0) {
    const nextInCell = currentTargets[currentIndex + direction];
    if (nextInCell) return nextInCell;
  }

  for (
    let rowIndex = cursor.rowIndex + direction;
    rowIndex >= 0 && rowIndex < items.length;
    rowIndex += direction
  ) {
    const columnIndex = findNearestPlayableColumn(
      items[rowIndex],
      cursor.columnIndex,
      unitLevel,
      rowIndex,
      getCellUnits,
      canUseTarget
    );
    if (columnIndex < 0) continue;
    const targets = getCellNavigationTargets(
      getCellUnits(rowIndex, columnIndex, unitLevel),
      unitLevel
    ).filter(canUseTarget);
    if (!targets.length) continue;
    return direction < 0 ? targets[targets.length - 1] : targets[0];
  }
  return null;
}

function findNearestPlayableColumn(item, preferredColumnIndex, unitLevel, rowIndex, getCellUnits, canUseTarget) {
  const columns = item.parts
    .map((part, columnIndex) => columnIndex)
    .filter((columnIndex) => (
      getCellNavigationTargets(getCellUnits(rowIndex, columnIndex, unitLevel), unitLevel)
        .some(canUseTarget)
    ));
  if (!columns.length) return -1;
  if (columns.includes(preferredColumnIndex)) return preferredColumnIndex;
  return columns.reduce((nearest, columnIndex) => (
    Math.abs(columnIndex - preferredColumnIndex) < Math.abs(nearest - preferredColumnIndex)
      ? columnIndex
      : nearest
  ), columns[0]);
}

function toNavigationTarget(unit) {
  return {
    rowIndex: unit.rowIndex,
    columnIndex: unit.columnIndex,
    cursor: cursorFromUnit(unit),
    isTranslation: Boolean(unit.isTranslation),
    skipWhenTranslationsDisabled: Boolean(unit.skipWhenTranslationsDisabled)
  };
}
