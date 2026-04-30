// @ts-check

/**
 * @typedef {import("googleapis").sheets_v4.Schema$Spreadsheet} Spreadsheet
 * @typedef {import("googleapis").sheets_v4.Schema$Sheet} Sheet
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
 * @param {Sheet} sheet
 */
export function parseSheet(sheet) {
  let _s = {};
  if (!sheet) {
    return _s;
  }
  if (sheet.properties) {
    _s.title = sheet.properties.title;
  }

  if (!sheet.data || !sheet.data[0] || !sheet.data[0].rowData) {
    return _s;
  }
  _s.rows = sheet.data[0].rowData.map((row) => {
    const cells = row.values.map((cell) => {
      return cell.effectiveValue.stringValue || cell.effectiveValue.numberValue;
    });
    return { cells };
  });
  return _s;
}
