import { send } from "../net/socket.js";
import { store } from "../store.js";

// Optional reports for testing. With ?fps in the address (for example
// http://localhost:65500/?fps#/), this tab sends its frame rate to the server
// every 2 seconds during a match, and every time the player snaps to the
// server's position, and the server prints both in the terminal. Without
// ?fps nothing is measured or sent.

const enabled = new URLSearchParams(window.location.search).has("fps");
const REPORT_MS = 2000;
const DROPPED_MS = 20; // a frame slower than this missed a 60 FPS refresh
const HIDDEN_MS = 1000; // a gap this long means the tab was hidden, not slow

let total = 0;
let frames = 0;
let slowest = 0;
let dropped = 0;
let focused = null; // whether this window had the focus on the last frame
let switched = false; // the focus moved to or from this window since the last report

function browserName() {
  const agent = navigator.userAgent;
  if (agent.includes("Firefox/")) return "Firefox";
  if (agent.includes("Edg/")) return "Edge";
  if (agent.includes("Chrome/")) return "Chrome";
  if (agent.includes("Safari/")) return "Safari";
  return "Other";
}

/**
 * Sends one snap: where this screen showed the player, where the server had
 * them, and what this screen knew at that moment.
 *
 * @param {Object} snap - From prediction.js.
 */
export function recordSnap(snap) {
  if (!enabled) return;
  send("snap", { nickname: store.getState().nickname, ...snap });
}

/**
 * Called by the game loop once per frame.
 *
 * @param {number} delta - Milliseconds since the previous frame.
 */
export function recordFrame(delta) {
  if (!enabled || delta <= 0 || delta > HIDDEN_MS) return;
  // Clicking into another window to play another player can slow a frame,
  // so each report says whether that happened.
  const hasFocus = document.hasFocus();
  if (focused !== null && hasFocus !== focused) switched = true;
  focused = hasFocus;
  total += delta;
  frames += 1;
  if (delta > slowest) slowest = delta;
  if (delta > DROPPED_MS) dropped += 1;
  if (total < REPORT_MS) return;

  send("fps", {
    nickname: store.getState().nickname,
    browser: browserName(),
    average: (frames * 1000) / total,
    slowest,
    dropped,
    window: switched ? "switched" : focused ? "front" : "behind",
  });
  total = 0;
  frames = 0;
  slowest = 0;
  dropped = 0;
  switched = false;
}
