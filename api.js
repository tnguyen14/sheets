// @ts-check

/**
 * @typedef { import("googleapis").sheets_v4 } sheets_v4
 */
import { google } from "googleapis";

const sheets = google.sheets("v4");

export async function authorize() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth.getClient();
}

/**
 * @param auth
 * @param {string} [spreadsheetId] - ID of the spreadsheet to get (optional)
 * @return {Promise<sheets_v4.Schema$Spreadsheet>}
 */
export async function getSpreadsheet(auth, spreadsheetId) {
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
