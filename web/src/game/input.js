import { recordInput } from "./prediction.js";
import { createKeyState, onGlobal } from "/framework/index.js";
import { send } from "../net/socket.js";

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
  if (!GAME_KEYS.has(event.key)) return;
  event.preventDefault();
  if (event.key === " " && !event.repeat) send("bomb", {});
}

/**
 * Starts tracking keys. Called when the board is shown.
 */
export function startInput() {
  if (keys) return;
  keys = createKeyState();
  stopKeydown = onGlobal("keydown", onKeyDown);
  lastHeld = 0;
  seq = 0;
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
}

const input = {
  up: (held & UP) !== 0,
  down: (held & DOWN) !== 0,
  left: (held & LEFT) !== 0,
  right: (held & RIGHT) !== 0,
  seq,
};

recordInput(input);
send("input", input);
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
