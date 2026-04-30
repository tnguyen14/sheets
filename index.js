import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import fastifyServer from "@tridnguyen/fastify-server";
import * as sheets from "./sheets.js";

const config = parseToml(readFileSync("./config.toml", "utf8"));
const publicSheets = new Set(config.public.sheets);

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

async function checkAccess(request, reply) {
  const { spreadsheetId } = request.params;
  if (publicSheets.has(spreadsheetId)) return;
  const bearerToken = request.headers.authorization?.replace(/^Bearer /i, "");
  const email = await getUserEmail(bearerToken);
  if (!email || !(await sheets.hasReadAccess(spreadsheetId, email))) {
    return reply.code(403).send({ error: "Forbidden" });
  }
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
