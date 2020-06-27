// @ts-check

/**
 * @typedef { import("googleapis").sheets_v4 } sheets_v4
 */
const { google } = require("googleapis");
const sheets = google.sheets("v4");

async function authorize() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const creds = await auth.getCredentials();
  return client;
}

module.exports.authorize = authorize;

/**
 * @param auth
 * @param {string} [ssId] - ID of the spreadsheet to get (optional)
 * @return {Promise<sheets_v4.Schema$Spreadsheet>}
 */
async function getSpreadsheet(auth, spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error(`'spreadsheetId' is a required parameter`);
  }
  const fs = require("fs").promises;
  const spreadsheet = (
    await sheets.spreadsheets.get({
      auth,
      spreadsheetId,
      includeGridData: true,
    })
  ).data;

  return spreadsheet;
}

module.exports.getSpreadsheet = getSpreadsheet;

async function clearSheet(auth, spreadsheetId, sheetId) {
  const response = await sheets.spreadsheets.batchUpdate({
    auth,
    spreadsheetId,
    resource: {
      requests: [
        {
          updateCells: {
            range: {
              sheetId,
            },
            fields: "*",
          },
        },
      ],
    },
  });
  return response.data;
}

module.exports.clearSheet = clearSheet;

async function createReportSheet(auth, spreadsheetId, sheetName) {
  const response = await sheets.spreadsheets.batchUpdate({
    auth,
    spreadsheetId,
    resource: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
              index: 0,
              gridProperties: {
                frozenColumnCount: 1, // freeze first column of report
              },
            },
          },
        },
      ],
    },
  });
  /*
   * response.data is
   * { spreadsheetId: '',
   *   replies: [{
   *     addSheet: {
   *       properties: {
   *         sheetId: '', title: '', index: 0, sheetType: 'GRID',
   *         gridProperties: {}
   *       }
   *     }
   *   }]
   * }
   */
  return response.data.replies[0].addSheet;
}

module.exports.createReportSheet = createReportSheet;

async function writeDataToSpreadsheet(auth, spreadsheetId, data) {
  const response = await sheets.spreadsheets.values.batchUpdate({
    auth,
    spreadsheetId,
    resource: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
  /*
   * response.data is
   * { spreadsheetId: '1A2-t-zSs0l0oIEgkActV_KgQpicmjxW4kJ0YgXLccG0',
   * totalUpdatedRows: 1,
   * totalUpdatedColumns: 14,
   * totalUpdatedCells: 14,
   * totalUpdatedSheets: 1,
   * responses:
   * [ { spreadsheetId: '1A2-t-zSs0l0oIEgkActV_KgQpicmjxW4kJ0YgXLccG0',
   *     updatedRange: '\'Square Checking - Out\'!A1:A14',
   *     updatedRows: 1,
   *     updatedColumns: 14,
   *     updatedCells: 14 } ] }
   */
  return response.data;
}

module.exports.writeDataToSpreadsheet = writeDataToSpreadsheet;

async function formatCells(auth, spreadsheetId, formats) {
  const response = await sheets.spreadsheets.batchUpdate({
    auth,
    spreadsheetId,
    resource: {
      requests: formats.map(({ range, format }) => ({
        repeatCell: {
          range,
          cell: {
            userEnteredFormat: format,
          },
          // only fields listed in "fields" are updated
          fields: `userEnteredFormat(${Object.keys(format).join(",")})`,
        },
      })),
    },
  });
  return response.data;
}

module.exports.formatCells = formatCells;

// https://developers.google.com/sheets/api/samples/rowcolumn#adjust_column_width_or_row_height
async function updateDimensions(auth, spreadsheetId, dimensions) {
  const response = await sheets.spreadsheets.batchUpdate({
    auth,
    spreadsheetId,
    resource: {
      requests: dimensions.map(({ range, pixelSize }) => ({
        updateDimensionProperties: {
          range,
          properties: {
            pixelSize,
          },
          fields: "pixelSize",
        },
      })),
    },
  });
}

module.exports.updateDimensions = updateDimensions;
