import fastifyServer from "@tridnguyen/fastify-server";
import * as sheets from "./sheets.js";
import { getCompletedTrips, getPendingTrips } from "./flights.js";
import { config } from "./config.js";

const publicSheets = new Set(config.public.spreadsheets);
const machineEmails = config.auth?.machines ?? {};

const auth0Domain = "tridnguyen.auth0.com";

const server = fastifyServer({
  allowedOrigins: ["https://tridnguyen.com"],
  auth0Domain,
  audience: "https://sheets.cloud.tridnguyen.com",
  shouldPerformJwtCheck: (request) => {
    const path = request.url.split("?")[0];
    // Routes that are readable without a token.
    const isHealthcheck = path === "/";
    const isPublicSpreadsheet = publicSheets.has(request.params.spreadsheetId);
    // Everything else (private spreadsheets, flights) requires a verified token.
    return !(isHealthcheck || isPublicSpreadsheet);
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

// Get email address associated with JWT token
//
// A machine-to-machine (client-credentials) token has no user, so
// /userinfo can't supply an email. Example payload:
//
//   {
//     iss: "https://tridnguyen.auth0.com/",
//     sub: "z3IK464A6PogdpKe0LY0vTaKr6izei2a@clients", // <client_id>@clients
//     aud: "https://sheets.cloud.tridnguyen.com",       // API audience only
//     azp: "z3IK464A6PogdpKe0LY0vTaKr6izei2a",          // the client_id
//     gty: "client-credentials",
//     iat: 1681053925,
//     exp: 1681140325
//   }
//
// A user token carries a real `sub`, a `scope` that includes "email",
// and the .../userinfo audience; for those we fall back to the Auth0 /userinfo
// profile. Example payload:
//
//   {
//     iss: "https://tridnguyen.auth0.com/",
//     sub: "google-oauth2|102956012089794272878", // the user identity
//     aud: [
//       "https://sheets.cloud.tridnguyen.com",
//       "https://tridnguyen.auth0.com/userinfo"   // userinfo audience
//     ],
//     azp: "z3IK464A6PogdpKe0LY0vTaKr6izei2a",
//     scope: "openid profile email offline_access",
//     iat: 1681053925,
//     exp: 1681140325
//   }
async function getRequestEmail(request) {
  const payload = request.user;
  console.log(payload);
  const isMachineToken =
    payload?.gty === "client-credentials" ||
    (typeof payload?.sub === "string" && payload.sub.endsWith("@clients"));
  if (isMachineToken) {
    const clientId = payload.azp ?? payload.sub?.replace(/@clients$/, "");
    return machineEmails[clientId];
  }
  const bearerToken = request.headers.authorization?.replace(/^Bearer /i, "");
  return getUserEmail(bearerToken);
}

async function checkPrivateAccess(request, reply, spreadsheetId) {
  const email = await getRequestEmail(request);
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
    return getCompletedTrips();
  },
);

server.get(
  "/flights/completed/:year",
  {
    preHandler: (request, reply) =>
      checkPrivateAccess(request, reply, config.flights.spreadsheetId),
  },
  async (request, reply) => {
    const { year } = request.params;
    if (!/^\d{4}$/.test(year)) {
      reply.code(400);
      return { error: "Invalid year" };
    }

    const completedByYear = await getCompletedTrips();
    return completedByYear[year] ?? [];
  },
);

server.get(
  "/flights/pending",
  {
    preHandler: (request, reply) =>
      checkPrivateAccess(request, reply, config.flights.spreadsheetId),
  },
  async (request, reply) => {
    return getPendingTrips();
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
