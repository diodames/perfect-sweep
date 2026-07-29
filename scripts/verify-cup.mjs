/** Smoke: room helpers + deterministic Cup Final sim pipeline via roomRng. */
import {
  roomSeed, roomRng, generateRoomCode, isValidRoomId, shuffleWith,
} from "../daily.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const code = generateRoomCode();
assert(isValidRoomId(code), "generated code invalid");
assert(!isValidRoomId("AB01OI"), "ambiguous alphabet should fail");

const seed = roomSeed(code, 1);
assert(seed === `${code}|1`, "roomSeed shape");

const a = roomRng(seed, "roll", 1);
const b = roomRng(seed, "roll", 1);
const seq = (r) => [r(), r(), r()].map((x) => x.toFixed(6)).join(",");
assert(seq(a) === seq(b), "same lane must match");

const teams = ["A", "B", "C", "D", "E", "F"];
const t1 = shuffleWith(teams, roomRng(seed, "roll", 2));
const t2 = shuffleWith(teams, roomRng(seed, "roll", 2));
assert(JSON.stringify(t1) === JSON.stringify(t2), "shuffleWith seeded must match");

const simA = [];
const simB = [];
{
  const r = roomRng(seed, "sim");
  for (let i = 0; i < 40; i++) simA.push(r());
}
{
  const r = roomRng(seed, "sim");
  for (let i = 0; i < 40; i++) simB.push(r());
}
assert(JSON.stringify(simA) === JSON.stringify(simB), "sim lane must be deterministic");

console.log("verify-cup ok", { code, seed });
