/** Parse records before splitting fields so quoted newlines survive a round trip. */
export function parseCsvRecords(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  const finishRow = () => {
    row.push(field);
    if (row.some((value) => value !== "")) records.push(row);
    row = [];
    field = "";
    closedQuote = false;
  };
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') { field += '"'; index += 1; }
        else { quoted = false; closedQuote = true; }
      } else field += char;
    } else if (char === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (char === "\r" || char === "\n") {
      finishRow();
      if (char === "\r" && input[index + 1] === "\n") index += 1;
    } else if (char === '"' && !field && !closedQuote) {
      quoted = true;
    } else {
      if (closedQuote || char === '"') throw new Error("CSVの引用符を確認してください。");
      field += char;
    }
  }
  if (quoted) throw new Error("CSVの引用符が閉じられていません。");
  finishRow();
  return records;
}
