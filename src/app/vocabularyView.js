import { groupSourceSelection } from "./readerView.js";
import { columnTone } from "../ui/columnAppearance.js";

export function createVocabularyView({ document, container, getItems, getActiveItemIndex, getColumnRoles,
  getColumnLanguage, getColumnTags = () => [], getRenderUnitLevel, getPointerUnitMode, getEffectivePartRole, getColumnWidth,
  getRenderedColumnWidths, getTableWidth, renderColumnControls, renderHiddenColumnButton,
  renderResizeHandle, isLastResizableColumn, createInteractiveTextUnit, splitDisplayWordTokens,
  splitSentenceRangesForDisplay, getSentenceIndexAtOffset, isFromHereClickMode,
  onSourceActivate, onSectionActivate, onRendered }) {
  function renderVocabularyView(columnCount) {
    const table = document.createElement("table");
    table.className = "parsed-table";
    table.style.setProperty("--column-count", String(columnCount));
    const columnLayout = getRenderedColumnWidths(columnCount);
    table.style.width = getTableWidth(columnLayout);
    table.append(renderColumnGroup(columnCount, columnLayout));
    table.append(renderTableHead(columnCount, columnLayout));
    const tbody = document.createElement("tbody");
    getItems().forEach((item, rowIndex) => {
      const row = document.createElement("tr");
      row.className = rowIndex === getActiveItemIndex() ? "active-row" : "";
      row.dataset.index = String(rowIndex);
      row.append(renderIndexCell(rowIndex));
      if (isSpanningTableItem(item)) {
        row.classList.add(`span-row-${item.sourceType}`);
        row.append(renderSpanningTableCell(item, columnCount));
        tbody.append(row);
        return;
      }
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        row.append(renderPartCell(item.parts[columnIndex], rowIndex, columnIndex));
      }
      tbody.append(row);
    });
    table.append(tbody);
    container.append(table);

    onRendered();
  }

  function isSpanningTableItem(item) {
    return item?.sourceType === "section" || item?.sourceType === "instruction";
  }

  function renderSpanningTableCell(item, columnCount) {
    const cell = document.createElement("td");
    cell.colSpan = columnCount;
    cell.className = `spanning-table-cell ${item.sourceType === "instruction" ? "instruction-cell" : "section-cell"}`;
    const text = item.parts[0]?.text || "";
    if (item.sourceType === "instruction") {
      const pre = document.createElement("pre");
      pre.textContent = text;
      cell.append(pre);
    } else {
      const unit = createInteractiveTextUnit(text, {
        className: "spanning-title-button table-text-unit",
        groupId: `table-section-${getItems().indexOf(item)}`,
        onActivate: () => {
          onSectionActivate(getItems().indexOf(item));
        }
      });
      cell.append(unit);
    }
    return cell;
  }

  function renderTableHead(columnCount, columnLayout = getRenderedColumnWidths(columnCount)) {
    const thead = document.createElement("thead");
    const row = document.createElement("tr");
    const indexHeader = document.createElement("th");
    indexHeader.textContent = "#";
    row.append(indexHeader);
    for (let index = 0; index < columnCount; index += 1) {
      const th = document.createElement("th");
      th.style.width = `${columnLayout[index]}px`;
      if (getColumnRoles()[index] === "hide") {
        th.className = "hidden-column-header";
        th.append(renderHiddenColumnButton(index));
      } else {
        th.append(renderColumnControls(index));
        if (!isLastResizableColumn(index, columnCount)) th.append(renderResizeHandle(index));
      }
      row.append(th);
    }
    thead.append(row);
    return thead;
  }

  function renderColumnGroup(columnCount, columnLayout = getRenderedColumnWidths(columnCount)) {
    const colgroup = document.createElement("colgroup");
    const indexCol = document.createElement("col");
    indexCol.className = "index-col";
    indexCol.style.width = "44px";
    colgroup.append(indexCol);
    for (let index = 0; index < columnCount; index += 1) {
      const col = document.createElement("col");
      col.style.width = `${columnLayout[index]}px`;
      colgroup.append(col);
    }
    return colgroup;
  }

  function renderIndexCell(rowIndex) {
    const cell = document.createElement("td");
    cell.className = "index-cell";
    cell.textContent = String(rowIndex + 1);
    return cell;
  }

  function renderPartCell(part, rowIndex, columnIndex) {
    const cell = document.createElement("td");
    const role = getEffectivePartRole(part, columnIndex);
    const language = getColumnLanguage(part, columnIndex);
    const clickUnitLevel = getRenderUnitLevel();
    cell.className = `part-cell role-${role} lang-${language}`;
    cell.dataset.tone = columnTone(getColumnTags()[columnIndex], part?.role, columnIndex);
    if (part?.warning) cell.classList.add("format-warning");
    cell.style.width = getColumnWidth(columnIndex);
    if (role === "hide") {
      cell.classList.add("hidden-column-cell");
      return cell;
    }
    if (!part?.text) return cell;
    if (role === "section") {
      cell.textContent = part.text;
      return cell;
    }

    if (!["mute", "section"].includes(role)) {
      cell.addEventListener("click", (event) => {
        event.stopPropagation();
        if (getPointerUnitMode() === "word") return;
        onSourceActivate(rowIndex, columnIndex, { sentenceIndex: 0, wordIndex: 0 });
      });
    } else {
      cell.addEventListener("click", (event) => event.stopPropagation());
    }

    if (role === "mute" || role === "section") {
      cell.textContent = part.text;
      return cell;
    }

    const wrap = document.createElement("div");
    wrap.className = "interactive-text-flow";
    if (clickUnitLevel === "word") {
      appendTableWordUnits(wrap, part.text, language, rowIndex, columnIndex);
    } else if (clickUnitLevel === "sentence") {
      appendTableSentenceUnits(wrap, part.text, rowIndex, columnIndex);
    } else {
      wrap.append(createTableTextUnit(part.text, rowIndex, columnIndex, {
        unitLevel: "cell",
        sentenceIndex: 0,
        wordIndex: 0,
        unitIndex: 0,
        groupId: `table-${rowIndex}-${columnIndex}-cell-0`
      }));
    }
    groupSourceSelection(document, wrap);
    cell.append(wrap);
    return cell;
  }

  function appendTableWordUnits(parent, text, language, rowIndex, columnIndex) {
    const tokens = splitDisplayWordTokens(text, language);
    let wordIndex = 0;
    let textOffset = 0;
    tokens.forEach((token) => {
      if (!token.clickable) {
        const fragment = document.createElement("span");
        fragment.className = "selection-fragment";
        fragment.textContent = token.text;
        fragment.dataset.itemIndex = String(rowIndex);
        fragment.dataset.columnIndex = String(columnIndex);
        fragment.dataset.sentenceIndex = String(getSentenceIndexAtOffset(text, textOffset));
        fragment.addEventListener("click", (event) => {
          event.stopPropagation();
          if (getPointerUnitMode() !== "word") onSourceActivate(rowIndex, columnIndex, { sentenceIndex: Number(fragment.dataset.sentenceIndex), wordIndex: 0 });
        });
        parent.append(fragment);
        textOffset += token.text.length;
        return;
      }
      const currentWordIndex = wordIndex;
      const sentenceIndex = getSentenceIndexAtOffset(text, textOffset);
      wordIndex += 1;
      parent.append(createTableTextUnit(token.text, rowIndex, columnIndex, {
        unitLevel: "word",
        sentenceIndex,
        wordIndex: currentWordIndex,
        unitIndex: currentWordIndex,
        groupId: `table-${rowIndex}-${columnIndex}-${isFromHereClickMode() ? "from-word" : "word"}-${currentWordIndex}`
      }));
      textOffset += token.text.length;
    });
  }

  function appendTableSentenceUnits(parent, text, rowIndex, columnIndex) {
    const ranges = splitSentenceRangesForDisplay(text);
    const sentenceRanges = ranges.length ? ranges : [{ text, start: 0, end: text.length }];
    let cursor = 0;
    sentenceRanges.forEach((range, sentenceIndex) => {
      if (range.start > cursor) parent.append(document.createTextNode(text.slice(cursor, range.start)));
      parent.append(createTableTextUnit(text.slice(range.start, range.end), rowIndex, columnIndex, {
        unitLevel: "sentence",
        sentenceIndex,
        wordIndex: 0,
        unitIndex: sentenceIndex,
        groupId: `table-${rowIndex}-${columnIndex}-${isFromHereClickMode() ? "from-sentence" : "sentence"}-${sentenceIndex}`
      }));
      cursor = range.end;
    });
    if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
  }

  function createTableTextUnit(text, rowIndex, columnIndex, options) {
    const unit = createInteractiveTextUnit(text, {
      className: "table-text-unit",
      groupId: options.groupId,
      onActivate: () => {
        onSourceActivate(rowIndex, columnIndex, options);
      }
    });
    unit.dataset.itemIndex = String(rowIndex);
    unit.dataset.columnIndex = String(columnIndex);
    unit.dataset.sentenceIndex = String(options.sentenceIndex || 0);
    unit.dataset.wordIndex = String(options.wordIndex || 0);
    return unit;
  }

  return { renderVocabularyView };
}
