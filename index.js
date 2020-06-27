require("dotenv").config();

const api = require("./api");

const fastify = require("fastify")({
  // logger: true,
  ignoreTrailingSlash: true,
});

let auth;

fastify.register(require("fastify-sensible"));

fastify.setErrorHandler((err, req, reply) => {
  console.log("Default error handler", err);
  reply.send(err);
});

async function handleRequest(request, reply, fn) {
  try {
    const response = await fn(request.params, request.body);
    reply.send(response);
  } catch (e) {
    console.error(e);
    reply.send(e);
  }
}

fastify.get("/", async (request, reply) => {
  reply.send("OK");
});

function parseSheet(sheet) {
  const rowData = sheet.data[0].rowData.map((row) => {
    const cells = row.values.map((cell) => {
      return cell.effectiveValue.stringValue || cell.effectiveValue.numberValue;
    });
    return { cells };
  });
  return {
    title: sheet.properties.title,
    rowData,
  };
}

fastify.get("/:spreadsheetId", async (request, reply) => {
  const { spreadsheetId } = request.params;
  handleRequest(request, reply, async ({ spreadsheetId }) => {
    const response = await api.getSpreadsheet(auth, spreadsheetId);
    return {
      title: response.properties.title,
      sheets: response.sheets.map(parseSheet),
    };
  });
});

async function start() {
  try {
    auth = await api.authorize();
    await fastify.listen(process.env.PORT || 3000, "0.0.0.0");
    console.log("Server started", {
      env: process.env,
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
