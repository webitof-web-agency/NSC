import * as XLSX from "xlsx";

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const readExcelHeader = async (
  file: File,
  sheetName?: string
): Promise<string[] | null> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const targetSheetName = sheetName || workbook.SheetNames[0];
  if (!targetSheetName) return null;
  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) return null;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as Array<
    Array<unknown>
  >;
  if (!rows || rows.length === 0) return null;
  return rows[0].map((cell) => String(cell ?? "").trim());
};

export const validateExcelTemplate = async (
  file: File,
  expectedHeaders: string[],
  sheetName?: string
): Promise<{ ok: boolean; message: string; details?: string[] }> => {
  const headerRow = await readExcelHeader(file, sheetName);
  if (!headerRow || headerRow.length === 0) {
    return {
      ok: false,
      message: "No header row found in the file.",
      details: ["The file appears to be empty or missing header row."],
    };
  }

  const actual = headerRow.map(normalizeHeader);
  const expected = expectedHeaders.map(normalizeHeader);

  if (actual.length !== expected.length) {
    const missing = expectedHeaders.filter(
      (h) => !actual.includes(normalizeHeader(h))
    );
    const extra = headerRow.filter(
      (h) => !expected.includes(normalizeHeader(h))
    );

    return {
      ok: false,
      message: `Invalid template. Expected ${expectedHeaders.length} columns, found ${actual.length}.`,
      details: [
        `Expected ${expectedHeaders.length} columns, found ${actual.length}.`,
        `Expected headers: ${expectedHeaders.join(", ")}`,
        `Found headers: ${headerRow.join(", ") || "-"}`,
        ...(missing.length > 0
          ? [`Missing headers: ${missing.join(", ")}`]
          : []),
        ...(extra.length > 0 ? [`Extra headers: ${extra.join(", ")}`] : []),
      ],
    };
  }

  const mismatches: string[] = [];
  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) {
      mismatches.push(
        `Column ${i + 1}: expected "${expectedHeaders[i]}", found "${headerRow[i] || ""}".`
      );
    }
  }

  if (mismatches.length > 0) {
    return {
      ok: false,
      message: `Invalid template. ${mismatches.length} column(s) do not match.`,
      details: mismatches,
    };
  }

  return { ok: true, message: "" };
};
