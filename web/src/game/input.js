import { createKeyState, onGlobal } from "/framework/index.js";
import { send } from "../net/socket.js";
import { recordInput } from "./prediction.js";
import { store } from "../store.js";
import { sendPauseAction } from "../views/PauseBar.js";

// Reads the held arrow keys once per frame and tells the server only when
// they change. Holding a key sends one `input`; letting go sends another.

// Each direction is one bit, so all four fit in one number and can be compared without creating anything new every frame.
const UP = 1;
const DOWN = 2;
const LEFT = 4;
const RIGHT = 8;

// Keys the page must not use for scrolling while the game is on screen.
const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  " ",
]);

let keys = null; // the held-key tracker, or null when the board is not shown
let stopKeydown = null; // removes the Space and scrolling handler
let lastHeld = 0; // the directions sent last time
let seq = 0; // numbers each input, so the server can drop old ones

/**
 * Space places a bomb (once per press, not while held) and the game keys
 * never scroll the page. Typing in the chat is ignored by onGlobal.
 *
 * @param {KeyboardEvent} event
 */
function onKeyDown(event) {
  if (event.key === "Escape") {
    if (!event.repeat) togglePause();
    return;
  }
  if (store.getState().paused) {
    onPausedKey(event);
    return;
  }
  if ((event.key === "e" || event.key === "E") && !event.repeat) {
    if (store.getState().detonator) send("detonate", {});
    return;
  }
  if (!GAME_KEYS.has(event.key)) return;
  event.preventDefault();
  if (event.key === " " && !event.repeat) send("bomb", {});
}

/**
 * Esc pauses the match, or continues it if it is paused. Players who are out
 * cannot pause.
 */
function togglePause() {
  const { paused, out } = store.getState();
  if (out) return;
  sendPauseAction(paused ? "continue" : "pause");
}

/**
 * While paused, R restarts the match. The game keys do nothing, and never
 * scroll the page.
 *
 * @param {KeyboardEvent} event
 */
function onPausedKey(event) {
  if (GAME_KEYS.has(event.key)) event.preventDefault();
  if (store.getState().out || event.repeat) return;
  if (event.key === "r" || event.key === "R") sendPauseAction("restart");
}

/**
 * Starts tracking keys. Called when the board is shown.
 */
export function startInput() {
  if (keys) return;
  keys = createKeyState();
  stopKeydown = onGlobal("keydown", onKeyDown);
  lastHeld = 0;
  // seq keeps counting for the whole visit: the server ignores any input
  // that is not newer than the last one it saw.
}

/**
 * Runs once per frame: sends `input` only when the held directions change.
 */
export function readInput() {
  if (!keys) return;

  const held =
    (keys.isDown("ArrowUp") ? UP : 0) |
    (keys.isDown("ArrowDown") ? DOWN : 0) |
    (keys.isDown("ArrowLeft") ? LEFT : 0) |
    (keys.isDown("ArrowRight") ? RIGHT : 0);

  if (held === lastHeld) return;
  lastHeld = held;
  seq += 1;

  const input = {
    up: (held & UP) !== 0,
    down: (held & DOWN) !== 0,
    left: (held & LEFT) !== 0,
    right: (held & RIGHT) !== 0,
    seq,
  };
  send("input", input);
  recordInput(input);
}

/**
 * Lets go of every direction, so nobody keeps walking after a pause. Runs
 * every frame while paused, but only sends when a key was held.
 */
export function releaseInput() {
  if (lastHeld === 0) return;
  lastHeld = 0;
  seq += 1;
  const input = { up: false, down: false, left: false, right: false, seq };
  send("input", input);
  recordInput(input);
}

/**
 * Stops tracking keys. Called when the board is removed.
 */
export function stopInput() {
  if (!keys) return;
  keys.destroy();
  stopKeydown();
  keys = null;
  stopKeydown = null;
}
