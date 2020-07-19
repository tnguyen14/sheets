require("dotenv").config();

const server = require("@tridnguyen/fastify-server")({
  auth0Domain: process.env.AUTH0_DOMAIN,
  auth0ClientId: process.env.AUTH0_CLIENT_ID,
  allowedOrigins: ["https://lab.tridnguyen.com", "https://tridnguyen.com"],
  shouldPerformJwtCheck: false,
});

server.setErrorHandler((err, request, reply) => {
  console.error(err);
  reply.send(err);
});

const api = require("./api");

let auth;

async function handleRequest(request, reply, fn) {
  try {
    const response = await fn(request.params, request.body);
    reply.send(response);
  } catch (e) {
    console.error(e);
    reply.send(e);
  }
}

server.get("/", async (request, reply) => {
  reply.send("OK");
});

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

server.get("/:spreadsheetId", async (request, reply) => {
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
    await server.listen(process.env.PORT || 3000, "0.0.0.0");
    console.log("Server started");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
