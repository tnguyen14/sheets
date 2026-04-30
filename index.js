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
  shouldPerformJwtCheck: (request) => request.url.startsWith("/private/"),
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

server.get("/", async () => "OK");

server.get("/public/:spreadsheetId", async (request, reply) => {
  const { spreadsheetId } = request.params;
  if (!publicSheets.has(spreadsheetId)) {
    reply.code(404);
    return { error: "Not found" };
  }
  const response = await sheets.getSpreadsheet(spreadsheetId);
  return {
    title: response.properties.title,
    sheets: response.sheets.map(sheets.parseSheet),
  };
});

server.get("/private/:spreadsheetId", async (request, reply) => {
  const { spreadsheetId } = request.params;
  const bearerToken = request.headers.authorization?.replace(/^Bearer /i, "");
  const email = await getUserEmail(bearerToken);
  if (!email || !(await sheets.hasReadAccess(spreadsheetId, email))) {
    reply.code(403);
    return { error: "Forbidden" };
  }
  const response = await sheets.getSpreadsheet(spreadsheetId);
  return {
    title: response.properties.title,
    sheets: response.sheets.map(sheets.parseSheet),
  };
});

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
