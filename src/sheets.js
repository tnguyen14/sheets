// @ts-check

/**
 * @typedef {import("googleapis").sheets_v4.Schema$Spreadsheet} Spreadsheet
 * @typedef {import("googleapis").sheets_v4.Schema$Sheet} Sheet
 * @typedef {import("googleapis").sheets_v4.Schema$Table} Table
 * @typedef {import("googleapis").sheets_v4.Schema$RowData} RowData
 * @typedef {import("googleapis").sheets_v4.Schema$GridRange} GridRange
 */
import { google } from "googleapis";

const sheets = google.sheets("v4");
const drive = google.drive("v3");

const auth = new google.auth.GoogleAuth({
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
});

const READ_ROLES = new Set([
  "owner",
  "organizer",
  "fileOrganizer",
  "writer",
  "commenter",
  "reader",
]);

/**
 * @param {string} fileId
 * @param {string} email
 * @return {Promise<boolean>}
 */
export async function hasReadAccess(fileId, email) {
  const { data } = await drive.permissions.list({
    auth,
    fileId,
    fields: "permissions(emailAddress,type,role)",
  });
  const normalizedEmail = email.toLowerCase();
  return (
    data.permissions?.some(
      (permission) =>
        permission.type === "user" &&
        permission.emailAddress?.toLowerCase() === normalizedEmail &&
        !!permission.role &&
        READ_ROLES.has(permission.role),
    ) ?? false
  );
}

/**
 * @param {string} [spreadsheetId] - ID of the spreadsheet to get (optional)
 * @return {Promise<Spreadsheet>}
 */
export async function getSpreadsheet(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error(`'spreadsheetId' is a required parameter`);
  }
  const spreadsheet = (
    await sheets.spreadsheets.get({
      auth,
      spreadsheetId,
      includeGridData: true,
    })
  ).data;

  return spreadsheet;
}

/**
 * Fetch values from a specific A1 range in a spreadsheet.
 * @param {string} spreadsheetId
 * @param {string} range
 * @return {Promise<any[][]>}
 */
export async function getRangeValues(spreadsheetId, range) {
  if (!spreadsheetId) {
    throw new Error(`'spreadsheetId' is a required parameter`);
  }
  if (!range) {
    throw new Error(`'range' is a required parameter`);
  }

  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range,
  });
  return response.data.values ?? [];
}

/**
 * Extract positional cell values from row data.
 * @param {RowData[]} rowData
 * @return {Array<{cells: any[]}>}
 */
function parseRowData(rowData) {
  return rowData.map((row) => ({
    cells: (row.values ?? []).map((cell) => {
      const v = cell.effectiveValue;
      return v?.stringValue ?? v?.numberValue ?? v?.boolValue ?? null;
    }),
  }));
}

/**
 * @param {Sheet} sheet
 */
export function parseSheet(sheet) {
  const _s = {};
  if (!sheet) {
    return _s;
  }
  if (sheet.properties) {
    _s.title = sheet.properties.title;
  }
  const rowData = sheet.data?.[0]?.rowData;
  if (!rowData) {
    return _s;
  }
  _s.rows = parseRowData(rowData);
  return _s;
}

/**
 * Convert positional rows ({cells: [...]}) into records keyed by column name.
 * @param {Array<{cells: any[]}>} rows
 * @param {string[]} columnNames
 */
export function toRecords(rows, columnNames) {
  return rows.map((row) => {
    const record = {};
    columnNames.forEach((name, i) => {
      record[name] = row.cells[i] ?? null;
    });
    return record;
  });
}

/**
 * @param {Sheet} sheet
 * @param {Table} table
 */
export function parseTable(sheet, table) {
  const columnProps = table.columnProperties ?? [];
  const range = table.range ?? {};
  const rowData = sheet?.data?.[0]?.rowData ?? [];
  // Slice rowData to the table's data rows (skip header) and table columns.
  const slicedRowData = rowData
    .slice((range.startRowIndex ?? 0) + 1, range.endRowIndex)
    .map((row) => ({
      values: (row.values ?? []).slice(
        range.startColumnIndex ?? 0,
        range.endColumnIndex,
      ),
    }));
  const tableRows = parseRowData(slicedRowData);
  const records = toRecords(
    tableRows,
    columnProps.map((c) => c.columnName),
  );
  return {
    name: table.name,
    records: records,
  };
}
