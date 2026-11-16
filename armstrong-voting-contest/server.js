const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, "data", "votes.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 4096;

const NOMINEES = [
  { id: "entrant-1", name: "Entrant 1", note: "Replace with a confirmed entrant" },
  { id: "entrant-2", name: "Entrant 2", note: "Replace with a confirmed entrant" },
  { id: "entrant-3", name: "Entrant 3", note: "Replace with a confirmed entrant" }
];

function readVotes(dataFile) {
  if (!fs.existsSync(dataFile)) return [];
  const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Vote data must be an array.");
  return parsed;
}

function writeVotes(dataFile, votes) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(votes, null, 2));
  fs.renameSync(temporaryFile, dataFile);
}

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Send a valid JSON request.");
    error.statusCode = 400;
    throw error;
  }
}

function summarize(votes) {
  const counts = Object.fromEntries(NOMINEES.map(({ id }) => [id, 0]));
  for (const vote of votes) {
    if (Object.hasOwn(counts, vote.nomineeId)) counts[vote.nomineeId] += 1;
  }
  return { totalVotes: votes.length, counts };
}

function createServer({ dataFile = DATA_FILE } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    try {
      if (request.method === "GET" && url.pathname === "/api/state") {
        const votes = readVotes(dataFile);
        jsonResponse(response, 200, {
          nominees: NOMINEES,
          ...summarize(votes),
          recentVotes: votes.slice(-8).reverse().map(({ id, nomineeId, createdAt }) => ({
            id,
            nomineeId,
            createdAt
          }))
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/votes") {
        const body = await readJsonBody(request);
        const nominee = NOMINEES.find(({ id }) => id === body.nomineeId);
        if (!nominee) {
          jsonResponse(response, 400, { error: "Choose a valid entrant." });
          return;
        }
        if (typeof body.voterId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.voterId)) {
          jsonResponse(response, 400, { error: "A valid voter ID is required." });
          return;
        }

        const votes = readVotes(dataFile);
        const voterHash = crypto.createHash("sha256").update(body.voterId).digest("hex");
        if (votes.some((vote) => vote.voterHash === voterHash)) {
          jsonResponse(response, 409, { error: "A vote has already been recorded from this browser." });
          return;
        }

        votes.push({
          id: crypto.randomUUID(),
          nomineeId: nominee.id,
          voterHash,
          createdAt: new Date().toISOString()
        });
        writeVotes(dataFile, votes);
        jsonResponse(response, 201, { message: "Your vote has been recorded.", ...summarize(votes) });
        return;
      }

      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(302, { Location: "/index.html" });
        response.end();
        return;
      }

      if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
        const relativePath = decodeURIComponent(url.pathname.slice(1));
        const filePath = path.resolve(PUBLIC_DIR, relativePath);
        if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          jsonResponse(response, 404, { error: "Page not found." });
          return;
        }
        const contentTypes = {
          ".css": "text/css; charset=utf-8",
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8"
        };
        response.writeHead(200, {
          "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff"
        });
        fs.createReadStream(filePath).pipe(response);
        return;
      }

      jsonResponse(response, 404, { error: "Route not found." });
    } catch (error) {
      if (error.statusCode) {
        jsonResponse(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Request failed:", error);
      jsonResponse(response, 500, { error: "The server could not complete this request." });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Voting prototype running at http://127.0.0.1:${PORT}`);
  });
}

module.exports = { createServer, NOMINEES };
