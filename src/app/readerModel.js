export function createReaderModel({ getTargetLanguage, splitSentencesForDisplay }) {
  function assignReaderItems(blocks) {
    let itemIndex = 0;
    return blocks.map((block) => {
      if (block.type === "table") {
        return {
          ...block,
          rows: block.rows.map((row) => {
            const rowItemIndex = row.some(Boolean) ? itemIndex++ : -1;
            return row.map((text, columnIndex) => ({ text, itemIndex: rowItemIndex, columnIndex }));
          })
        };
      }
      if (block.type === "list") {
        return {
          ...block,
          items: block.items.map((text) => ({ text, itemIndex: text ? itemIndex++ : -1 }))
        };
      }
      if (isReaderPlayableBlock(block)) return { ...block, itemIndex: itemIndex++ };
      return { ...block, itemIndex: -1 };
    });
  }

  function createReaderPlaybackItems(blocks) {
    const readerItems = [];
    blocks.forEach((block) => {
      if (block.type === "table") {
        block.rows.forEach((row) => appendReaderRowItem(readerItems, row, `reader-table-${readerItems.length + 1}`));
        return;
      }
      if (block.type === "list") {
        block.items.forEach((item) => appendReaderItem(readerItems, item.text, `reader-list-${readerItems.length + 1}`));
        return;
      }
      if (isReaderPlayableBlock(block)) appendReaderItem(readerItems, block.text, `reader-${readerItems.length + 1}`);
    });
    return readerItems;
  }

  function appendReaderRowItem(target, cells, id) {
    const parts = cells.map((cell, columnIndex) => createReaderPart(cell.text, columnIndex));
    if (!parts.some((part) => part.text)) return;
    const text = parts.map((part) => part.text).filter(Boolean).join(" ");
    target.push({
      id,
      sourceType: "reader-table",
      raw: text,
      targetText: text,
      translationText: "",
      sentences: splitSentencesForDisplay(text),
      parts,
      playableParts: parts
    });
  }

  function appendReaderItem(target, text, id) {
    if (!text) return;
    const part = createReaderPart(text, 0);
    target.push({
      id,
      sourceType: "reader",
      raw: text,
      targetText: text,
      translationText: "",
      sentences: splitSentencesForDisplay(text),
      parts: [part],
      playableParts: [part]
    });
  }

  function createReaderPart(text, index) {
    return {
      index,
      text,
      raw: text,
      language: getTargetLanguage(),
      role: "sentence",
      label: "text"
    };
  }

  function isReaderPlayableBlock(block) {
    return ["heading", "paragraph"].includes(block.type) && Boolean(block.text);
  }


  return { assignReaderItems, createReaderPlaybackItems };
}

