import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import fastifyServer from "@tridnguyen/fastify-server";
import * as api from "./api.js";

const config = parseToml(readFileSync("./config.toml", "utf8"));
const publicSheets = new Set(config.public.sheets);

const server = fastifyServer({
  allowedOrigins: ["https://lab.tridnguyen.com", "https://tridnguyen.com"],
  shouldPerformJwtCheck: false,
});

server.setErrorHandler((err, request, reply) => {
  console.error(err);
  reply.send(err);
});

let auth;

function parseSheet(sheet) {
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

server.get("/", async () => "OK");

server.get("/public/:spreadsheetId", async (request, reply) => {
  const { spreadsheetId } = request.params;
  if (!publicSheets.has(spreadsheetId)) {
    reply.code(404);
    return { error: "Not found" };
  }
  const response = await api.getSpreadsheet(auth, spreadsheetId);
  return {
    title: response.properties.title,
    sheets: response.sheets.map(parseSheet),
  };
});

async function start() {
  try {
    auth = await api.authorize();
    await server.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    console.log("Server started");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
