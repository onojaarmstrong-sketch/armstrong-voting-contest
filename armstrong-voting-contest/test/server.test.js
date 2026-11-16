const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createServer, NOMINEES } = require("../server");

let directory;
let dataFile;
let server;
let baseUrl;

before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "armstrong-vote-test-"));
  dataFile = path.join(directory, "votes.json");
  server = createServer({ dataFile });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(directory, { recursive: true, force: true });
});

test("records a vote once and returns aggregate totals", async () => {
  const voterId = crypto.randomUUID();
  const firstVote = await fetch(`${baseUrl}/api/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nomineeId: NOMINEES[0].id, voterId })
  });
  assert.equal(firstVote.status, 201);
  assert.deepEqual(await firstVote.json(), {
    message: "Your vote has been recorded.",
    totalVotes: 1,
    counts: { "entrant-1": 1, "entrant-2": 0, "entrant-3": 0 }
  });

  const duplicateVote = await fetch(`${baseUrl}/api/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nomineeId: NOMINEES[0].id, voterId })
  });
  assert.equal(duplicateVote.status, 409);

  const state = await fetch(`${baseUrl}/api/state`);
  const liveState = await state.json();
  assert.equal(liveState.totalVotes, 1);
  assert.deepEqual(liveState.nominees.map(({ name }) => name), ["Jessica", "Loveth", "Peace"]);
  assert.equal(JSON.parse(fs.readFileSync(dataFile, "utf8")).length, 1);
});

test("rejects unknown entrants and malformed voter IDs", async () => {
  const unknownEntrant = await fetch(`${baseUrl}/api/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nomineeId: "unknown", voterId: crypto.randomUUID() })
  });
  assert.equal(unknownEntrant.status, 400);

  const invalidVoter = await fetch(`${baseUrl}/api/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nomineeId: NOMINEES[1].id, voterId: "not-a-uuid" })
  });
  assert.equal(invalidVoter.status, 400);
});

test("serves all contestant portraits as SVG images", async () => {
  for (const name of ["jessica", "loveth", "peace"]) {
    const portrait = await fetch(`${baseUrl}/portraits/${name}.svg`);
    assert.equal(portrait.status, 200);
    assert.match(portrait.headers.get("content-type"), /^image\/svg\+xml/);
    assert.match(await portrait.text(), /<svg\b/);
  }
});
