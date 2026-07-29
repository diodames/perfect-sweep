/** In-memory integration test for api/room/* against a tiny Upstash mock. */
import http from "node:http";
import { isValidRoomId } from "../daily.js";

const store = new Map();
const kvServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const run = ([cmd, ...args]) => {
      switch (String(cmd).toLowerCase()) {
        case "set": store.set(args[0], args[1]); return "OK";
        case "get": return store.has(args[0]) ? store.get(args[0]) : null;
        case "del": return store.delete(args[0]) ? 1 : 0;
        case "incr": {
          const n = (Number(store.get(args[0])) || 0) + 1;
          store.set(args[0], String(n));
          return n;
        }
        case "expire": return 1;
        default: return null;
      }
    };
    let out = { result: null };
    try {
      const parsed = JSON.parse(body || "[]");
      out = req.url.includes("pipeline")
        ? parsed.map((c) => ({ result: run(c) }))
        : { result: run(parsed) };
    } catch { /* ignore */ }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out));
  });
});

await new Promise((ok) => kvServer.listen(0, "127.0.0.1", ok));
process.env.KV_REST_API_URL = `http://127.0.0.1:${kvServer.address().port}`;
process.env.KV_REST_API_TOKEN = "local-test-token";

const createHandler = (await import("../api/room/create.js")).default;
const roomHandler = (await import("../api/room/[roomId].js")).default;

function mockRes() {
  const out = { statusCode: 200, body: null, headers: {} };
  return {
    out,
    setHeader(k, v) { out.headers[k] = v; },
    status(c) { out.statusCode = c; return this; },
    json(o) { out.body = o; return this; },
    end() { return this; },
  };
}

async function call(handler, method, query, body) {
  const res = mockRes();
  await handler(
    { method, headers: {}, query: query || {}, body: body || {}, socket: { remoteAddress: "127.0.0.1" } },
    res,
  );
  return res.out;
}

const lineup = {
  PG: { pos: "PG", name: "A", n: 1, rt: 90, team: "USA", season: "1992" },
  SG: { pos: "SG", name: "B", n: 2, rt: 88, team: "USA", season: "1992" },
  SF: { pos: "SF", name: "C", n: 3, rt: 87, team: "USA", season: "1992" },
  PF: { pos: "PF", name: "D", n: 4, rt: 86, team: "USA", season: "1992" },
  C: { pos: "C", name: "E", n: 5, rt: 92, team: "USA", season: "1992" },
};

const created = await call(createHandler, "POST", {}, { nick: "Ace", country: "US" });
if (created.statusCode !== 201) throw new Error(`create failed ${created.statusCode} ${JSON.stringify(created.body)}`);
const roomId = created.body.room.id;
if (!isValidRoomId(roomId)) throw new Error("bad room id");
if (created.body.room.phase !== "lobby") throw new Error("expected lobby");

const joined = await call(roomHandler, "POST", { roomId }, {
  action: "join", nick: "Bo", country: "CZ",
});
if (joined.statusCode !== 200) throw new Error(`join failed ${JSON.stringify(joined.body)}`);
if (!joined.body.room.players[1]) throw new Error("slot 1 empty");

let version = joined.body.room.version;
const readyA = await call(roomHandler, "POST", { roomId }, {
  action: "ready", expectedVersion: version, nick: "Ace", country: "US",
});
version = readyA.body.room.version;
const readyB = await call(roomHandler, "POST", { roomId }, {
  action: "ready", expectedVersion: version, nick: "Bo", country: "CZ",
});
if (readyB.body.room.phase !== "draft") throw new Error("expected draft phase");
version = readyB.body.room.version;

const draftA = await call(roomHandler, "POST", { roomId }, {
  action: "submitDraft", expectedVersion: version, nick: "Ace", country: "US", lineup, styleId: "bal",
});
version = draftA.body.room.version;
const draftB = await call(roomHandler, "POST", { roomId }, {
  action: "submitDraft", expectedVersion: version, nick: "Bo", country: "CZ", lineup, styleId: "run",
});
if (draftB.body.room.phase !== "sim") throw new Error(`expected sim, got ${draftB.body.room.phase}`);
if (!draftB.body.room.players[0].lineup || !draftB.body.room.players[1].lineup) {
  throw new Error("lineups missing");
}

const conflict = await call(roomHandler, "POST", { roomId }, {
  action: "ready", expectedVersion: 1, nick: "Ace", country: "US",
});
if (conflict.statusCode !== 409) throw new Error("expected 409 on stale version");

const got = await call(roomHandler, "GET", { roomId }, null);
if (got.statusCode !== 200 || got.body.room.id !== roomId) throw new Error("GET failed");

console.log("verify-room-api ok", { roomId, phase: draftB.body.room.phase, seed: draftB.body.room.seed });
kvServer.close();
