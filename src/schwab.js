// @ts-check
import { config as appConfig } from "./config.js";
import * as sheets from "./sheets.js";

const config = appConfig.schwab;

/**
 * Get all rows from the Schwab sheet as key/value records.
 * @return {Promise<Record<string, any>[]>}
 */
export async function getSchwabData() {
  const rows = await sheets.getRangeValues(
    config.spreadsheetId,
    config.sheetName,
  );
  if (rows.length === 0) {
    return [];
  }

  const [headers, ...dataRows] = rows;
  const requiredIndexes = config.requiredColumns.map((header) =>
    headers.indexOf(header),
  );
  /** @param {any[]} row */
  const hasRequiredFields = (row) =>
    requiredIndexes.every((index) => index >= 0 && isNonEmpty(row[index]));

  return dataRows.filter(hasRequiredFields).map((/** @type {any[]} */ row) =>
    headers.reduce(
      (record, header, i) => ({ ...record, [header]: row[i] ?? null }),
      {},
    ),
  );
}

/**
 * Check if a value is non-empty.
 * @param {any} value
 * @return {boolean}
 */
function isNonEmpty(value) {
  return value != null && String(value).trim() !== "";
}
