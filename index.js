import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import fastifyServer from "@tridnguyen/fastify-server";
import * as sheets from "./sheets.js";

const config = parseToml(readFileSync("./config.toml", "utf8"));
const publicSheets = new Set(config.public.spreadsheets);
const tripsSheetName = config.flights.trips.sheetName;
const tripsColumnRange = config.flights.trips.columnRange;
const tripsRequiredColumns = config.flights.trips.requiredColumns;

const auth0Domain = "tridnguyen.auth0.com";

const server = fastifyServer({
  allowedOrigins: ["https://tridnguyen.com"],
  auth0Domain,
  audience: "https://sheets.cloud.tridnguyen.com",
  shouldPerformJwtCheck: (request) => {
    const id = request.params.spreadsheetId;
    return id != null && !publicSheets.has(id);
  },
});

server.setErrorHandler((err, request, reply) => {
  console.error(err);
  reply.send(err);
});

async function getUserEmail(bearerToken) {
  const res = await fetch(`https://${auth0Domain}/userinfo`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) {
    throw new Error(`userinfo failed: ${res.status}`);
  }
  const { email } = await res.json();
  return email;
}

async function checkPrivateAccess(request, reply, spreadsheetId) {
  const bearerToken = request.headers.authorization?.replace(/^Bearer /i, "");
  const email = await getUserEmail(bearerToken);
  if (!email || !(await sheets.hasReadAccess(spreadsheetId, email))) {
    return reply.code(403).send({ error: "Forbidden" });
  }
}

async function checkAccess(request, reply) {
  const { spreadsheetId } = request.params;
  if (publicSheets.has(spreadsheetId)) return;
  return checkPrivateAccess(request, reply, spreadsheetId);
}

server.get("/", async () => "OK");

server.get(
  "/spreadsheets/:spreadsheetId",
  { preHandler: checkAccess },
  async (request) => {
    const { spreadsheetId } = request.params;
    const response = await sheets.getSpreadsheet(spreadsheetId);
    return {
      title: response.properties.title,
      sheets: response.sheets.map(sheets.parseSheet),
    };
  },
);

server.get(
  "/spreadsheets/:spreadsheetId/sheets/:sheetId",
  { preHandler: checkAccess },
  async (request, reply) => {
    const { spreadsheetId, sheetId } = request.params;
    const response = await sheets.getSpreadsheet(spreadsheetId);
    const sheet = response.sheets.find(
      (s) => String(s.properties?.sheetId) === sheetId,
    );
    if (!sheet) {
      reply.code(404);
      return { error: "Sheet not found" };
    }
    return sheets.parseSheet(sheet);
  },
);

server.get(
  "/spreadsheets/:spreadsheetId/sheets/:sheetId/tables",
  { preHandler: checkAccess },
  async (request, reply) => {
    const { spreadsheetId, sheetId } = request.params;
    const response = await sheets.getSpreadsheet(spreadsheetId);
    const sheet = response.sheets.find(
      (s) => String(s.properties?.sheetId) === sheetId,
    );
    if (!sheet) {
      reply.code(404);
      return { error: "Sheet not found" };
    }
    return {
      tables: (sheet.tables ?? []).map((t) => ({
        name: t.name,
        columns: (t.columnProperties ?? []).map((c) => ({
          name: c.columnName,
          type: c.columnType,
        })),
      })),
    };
  },
);

server.get(
  "/spreadsheets/:spreadsheetId/sheets/:sheetId/tables/:tableName",
  { preHandler: checkAccess },
  async (request, reply) => {
    const { spreadsheetId, sheetId, tableName } = request.params;
    const response = await sheets.getSpreadsheet(spreadsheetId);
    const sheet = response.sheets.find(
      (s) => String(s.properties?.sheetId) === sheetId,
    );
    if (!sheet) {
      reply.code(404);
      return { error: "Sheet not found" };
    }
    const table = (sheet.tables ?? []).find((t) => t.name === tableName);
    if (!table) {
      reply.code(404);
      return { error: "Table not found" };
    }
    return sheets.parseTable(sheet, table);
  },
);

server.get(
  "/flights/completed",
  {
    preHandler: (request, reply) =>
      checkPrivateAccess(request, reply, config.flights.spreadsheetId),
  },
  async (request, reply) => {
    return (await getTrips()).filter((trip) => trip.Flown === "Y");
  },
);

server.get(
  "/flights/pending",
  {
    preHandler: (request, reply) =>
      checkPrivateAccess(request, reply, config.flights.spreadsheetId),
  },
  async (request, reply) => {
    return (await getTrips()).filter((trip) => trip.Flown !== "Y");
  },
);

function isNonEmpty(value) {
  return value != null && String(value).trim() !== "";
}

async function getTrips() {
  const rows = await sheets.getRangeValues(
    config.flights.spreadsheetId,
    `${tripsSheetName}!${tripsColumnRange}`,
  );
  if (rows.length === 0) {
    return [];
  }

  const [headers, ...dataRows] = rows;
  const requiredIndexes = tripsRequiredColumns.map((header) =>
    headers.indexOf(header),
  );
  const hasRequiredTripFields = (row) =>
    requiredIndexes.every((index) => index >= 0 && isNonEmpty(row[index]));

  return dataRows.filter(hasRequiredTripFields).map((row) => {
    const record = {};
    headers.forEach((header, i) => {
      record[header] = row[i] ?? null;
    });
    return record;
  });
}

async function start() {
  try {
    await server.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    console.log("Server started");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
