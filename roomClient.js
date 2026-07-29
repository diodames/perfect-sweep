/** Client helpers for Cup Final rooms — API + localStorage session. */

const LS_KEY = "ps:room:session";
export const ROOM_POLL_MS = 1800;

export function saveRoomSession(session) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(session));
  } catch { /* quota */ }
}

export function loadRoomSession() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.roomId || typeof data.slot !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

export function clearRoomSession() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY);
  } catch { /* ignore */ }
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function createRoom(nick, country) {
  const res = await fetch("/api/room/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nick, country }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Could not create room.");
  return data;
}

export async function fetchRoom(roomId) {
  const res = await fetch(`/api/room/${encodeURIComponent(roomId)}`, {
    headers: { Accept: "application/json" },
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Room not found.");
  return data.room;
}

/**
 * POST an action. On 409, throws with `.conflict` and `.room` for retry.
 */
export async function roomAction(roomId, body) {
  const res = await fetch(`/api/room/${encodeURIComponent(roomId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (res.status === 409) {
    const err = new Error(data.error || "Room changed.");
    err.conflict = true;
    err.room = data.room;
    throw err;
  }
  if (!res.ok) throw new Error(data.error || "Action failed.");
  return data;
}

/** Retry once on version conflict using the fresh room from the 409. */
export async function roomActionWithRetry(roomId, buildBody) {
  try {
    return await roomAction(roomId, buildBody());
  } catch (err) {
    if (!err.conflict || !err.room) throw err;
    return roomAction(roomId, buildBody(err.room));
  }
}
