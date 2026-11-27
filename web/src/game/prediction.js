// Client-side prediction for the local player.
//
// The local player moves on this screen straight away, using the same speed
// and collision rules as the server (server/game.go and server/collision.go).
// Every input is kept until the server confirms it with `lastInput`.
//
// The server applies each input a little later than this screen does (the
// network, plus up to one 50 ms tick). We measure that delay: it is the time
// from sending an input to the first `state` that confirms it. When a `state`
// arrives, the player is put back at the server's position and the last
// "delay" worth of key presses is replayed, so the result lines up with what
// the player sees. Small differences are smoothed; large ones snap.

// Copied from the server; if these differ, the player rubber-bands.
const START_SPEED = 4; // tiles per second, until a Speed power-up
const MOVE_STEP = 0.05; // largest distance checked for collisions at once
const CORNER_TOLERANCE = 0.65; // how far off a corridor a player still slides into it
const EPSILON = 1e-9;

const SNAP_DISTANCE = 1; // tiles; a bigger difference snaps at once
const SMOOTHING = 0.85; // share of the difference kept each frame
const MAX_FRAME_SECONDS = 0.05; // a slow frame never moves more than one tick
const HISTORY_SECONDS = 1; // how far back key presses are remembered

let active = false;
let size = 0.8; // player box width and height, from `start`
let speed = START_SPEED; // tiles per second, from `state` (Speed power-ups)
let columns = 0;
let rows = 0;
let tiles = null; // this module's own copy of the map tiles
const bombs = new Set(); // cells with a bomb, as row * columns + col

// One object each, changed in place, so nothing new is made every frame.
const position = { x: 0, y: 0 }; // where the simulation has the player
const correction = { x: 0, y: 0 }; // shrinking offset after a reconcile
const drawn = { x: 0, y: 0 }; // returned by getPredictedPosition
const held = { up: false, down: false, left: false, right: false };

// Sent inputs, oldest first: { seq, sentAt, up, down, left, right }. Old
// ones are dropped once they fall out of HISTORY_SECONDS.
let history = [];
let lastConfirmed = 0; // highest seq the server has confirmed
let delay = 0; // measured seconds between sending an input and its confirmation
let onSnap = null; // optional: told about every snap, for the ?fps reports

/**
 * Sets a function to call whenever the player snaps to the server's position.
 *
 * @param {Function|null} listener
 */
export function setSnapListener(listener) {
  onSnap = listener;
}

function isBlocked(col, row) {
  if (col < 0 || row < 0 || col >= columns || row >= rows) return true;
  return tiles[row * columns + col] !== "empty";
}

function covers(x, y, col, row) {
  return (
    col >= Math.floor(x + EPSILON) &&
    col <= Math.floor(x + size - EPSILON) &&
    row >= Math.floor(y + EPSILON) &&
    row <= Math.floor(y + size - EPSILON)
  );
}

// Same as canMoveTo on the server: walls and blocks always stop the player;
// a bomb stops them unless they are already standing on it.
function canMoveTo(x, y) {
  const left = Math.floor(x + EPSILON);
  const top = Math.floor(y + EPSILON);
  const right = Math.floor(x + size - EPSILON);
  const bottom = Math.floor(y + size - EPSILON);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (isBlocked(col, row)) return false;
      if (
        bombs.has(row * columns + col) &&
        !covers(position.x, position.y, col, row)
      ) {
        return false;
      }
    }
  }
  return true;
}

// Same as CanOccupy on the server, used by the corner nudge.
function canOccupy(x, y) {
  const left = Math.floor(x + EPSILON);
  const top = Math.floor(y + EPSILON);
  const right = Math.floor(x + size - EPSILON);
  const bottom = Math.floor(y + size - EPSILON);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (isBlocked(col, row) || bombs.has(row * columns + col)) return false;
    }
  }
  return true;
}

function approach(from, to, maxStep) {
  if (Math.abs(to - from) <= maxStep) return to;
  return from + Math.sign(to - from) * maxStep;
}

function isFree(col, row) {
  return !isBlocked(col, row) && !bombs.has(row * columns + col);
}

// Same as NudgeToCorridor on the server: of the lanes the box overlaps, the
// centre of the nearer one whose next cell in the direction of travel is
// free; the current position if neither is.
function nudgeTarget(horizontal, direction) {
  const along = horizontal ? position.x : position.y;
  const across = horizontal ? position.y : position.x;
  const offset = (1 - size) / 2;
  const first = Math.floor(across + EPSILON);
  const last = Math.floor(across + size - EPSILON);
  const lanes =
    Math.abs(last + offset - across) < Math.abs(first + offset - across)
      ? [last, first]
      : [first, last];
  const ahead =
    direction < 0
      ? Math.floor(along + EPSILON) - 1
      : Math.floor(along + size - EPSILON) + 1;

  for (const lane of lanes) {
    const target = lane + offset;
    if (Math.abs(target - across) > CORNER_TOLERANCE + EPSILON) continue;
    if (horizontal) {
      if (canOccupy(position.x, target) && isFree(ahead, lane)) return target;
    } else if (canOccupy(target, position.y) && isFree(lane, ahead)) {
      return target;
    }
  }
  return across;
}

// Same as moveAxis on the server.
function moveAxis(horizontal, direction, distance) {
  let moved = false;
  for (let remaining = distance; remaining > 0; remaining -= MOVE_STEP) {
    const step = Math.min(MOVE_STEP, remaining) * direction;
    const x = horizontal ? position.x + step : position.x;
    const y = horizontal ? position.y : position.y + step;
    if (!canMoveTo(x, y)) break;
    position.x = x;
    position.y = y;
    moved = true;
  }
  if (moved) return;

  if (horizontal) {
    position.y = approach(position.y, nudgeTarget(true, direction), distance);
  } else {
    position.x = approach(position.x, nudgeTarget(false, direction), distance);
  }
}

// Same as move on the server: x first, then y; diagonals are slower.
function simulate(directions, seconds) {
  const dx = Number(directions.right) - Number(directions.left);
  const dy = Number(directions.down) - Number(directions.up);
  if (dx === 0 && dy === 0) return;

  let distance = speed * seconds;
  if (dx !== 0 && dy !== 0) distance *= Math.SQRT1_2;

  if (dx !== 0) moveAxis(true, dx, distance);
  if (dy !== 0) moveAxis(false, dy, distance);
}

/**
 * Starts predicting the local player for a new match.
 *
 * @param {{ map: { columns: number, rows: number, tiles: string[] }, playerSize: number }} data - The `start` message data.
 * @param {{ x: number, y: number }} startPosition
 */
export function startPrediction(data, startPosition) {
  size = data.playerSize;
  speed = START_SPEED;
  columns = data.map.columns;
  rows = data.map.rows;
  tiles = data.map.tiles.slice(); // a copy: the store keeps its own map
  bombs.clear();
  position.x = startPosition.x;
  position.y = startPosition.y;
  correction.x = 0;
  correction.y = 0;
  held.up = held.down = held.left = held.right = false;
  history = [];
  lastConfirmed = 0;
  delay = 0;
  active = true;
}

/**
 * Called by input.js right after an input is sent.
 *
 * @param {{ up: boolean, down: boolean, left: boolean, right: boolean, seq: number }} input
 */
export function recordInput(input) {
  if (!active) return;
  held.up = input.up;
  held.down = input.down;
  held.left = input.left;
  held.right = input.right;
  history.push({ ...input, sentAt: performance.now() / 1000 });
}

// Replays the keys held between `from` and `to` (seconds), segment by segment.
function replay(from, to) {
  const idle = { up: false, down: false, left: false, right: false };
  for (let i = -1; i < history.length; i++) {
    const keys = i < 0 ? idle : history[i];
    const start = i < 0 ? -Infinity : history[i].sentAt;
    const end = i + 1 < history.length ? history[i + 1].sentAt : Infinity;
    const seconds = Math.min(end, to) - Math.max(start, from);
    if (seconds > 0) simulate(keys, seconds);
  }
}

/**
 * Applies the map changes in a `state`: new bombs, exploded bombs and
 * destroyed blocks. Called before the local player is reconciled.
 *
 * @param {{ bombs?: Array<{ col: number, row: number }>, explosions?: Array<{ cells: Array<{ col: number, row: number }> }>, destroyed?: Array<{ col: number, row: number }> }} data
 */
export function applyMapChanges(data) {
  if (!active) return;
  for (const bomb of data.bombs || []) {
    bombs.add(bomb.row * columns + bomb.col);
  }
  for (const explosion of data.explosions || []) {
    const cell = explosion.cells[0]; // the first cell is the bomb's own
    bombs.delete(cell.row * columns + cell.col);
  }
  for (const cell of data.destroyed || []) {
    tiles[cell.row * columns + cell.col] = "empty";
  }
}

/**
 * Uses the speed the server reports, so a Speed power-up is predicted too.
 *
 * @param {number} tilesPerSecond
 */
export function setSpeed(tilesPerSecond) {
  if (tilesPerSecond > 0) speed = tilesPerSecond;
}

/**
 * Puts the player at the server's position and replays the key presses the
 * server has not caught up with yet.
 *
 * @param {{ x: number, y: number }} serverPosition
 * @param {number} lastInput - The highest input seq the server has applied.
 */
export function reconcile(serverPosition, lastInput) {
  if (!active) return;
  const now = performance.now() / 1000;

  // The first confirmation of an input tells us how far behind the server is.
  if (lastInput > lastConfirmed) {
    const input = history.find((entry) => entry.seq === lastInput);
    if (input) {
      const sample = Math.min(now - input.sentAt, HISTORY_SECONDS);
      delay = delay === 0 ? sample : delay * 0.8 + sample * 0.2;
    }
    lastConfirmed = lastInput;
  }

  const shownX = position.x + correction.x;
  const shownY = position.y + correction.y;

  position.x = serverPosition.x;
  position.y = serverPosition.y;
  replay(now - delay, now);

  correction.x = shownX - position.x;
  correction.y = shownY - position.y;
  if (Math.hypot(correction.x, correction.y) > SNAP_DISTANCE) {
    if (onSnap) {
      onSnap({
        shown: { x: shownX, y: shownY },
        server: { x: serverPosition.x, y: serverPosition.y },
        replayed: { x: position.x, y: position.y },
        lastInput,
        delay,
        held: { ...held },
        bombs: [...bombs].map((cell) => [cell % columns, Math.floor(cell / columns)]),
      });
    }
    correction.x = 0;
    correction.y = 0;
  }
}

/**
 * Runs once per frame: moves the player with the keys held now.
 *
 * @param {number} delta - Milliseconds since the previous frame.
 */
export function updatePrediction(delta) {
  if (!active) return;

  const seconds = Math.min(delta / 1000, MAX_FRAME_SECONDS);
  simulate(held, seconds);

  // Forget inputs older than HISTORY_SECONDS, but keep the newest one: it
  // says which keys are held now.
  const cutoff = performance.now() / 1000 - HISTORY_SECONDS;
  while (history.length > 1 && history[1].sentAt < cutoff) history.shift();

  correction.x *= SMOOTHING;
  correction.y *= SMOOTHING;
  if (Math.abs(correction.x) < 0.001) correction.x = 0;
  if (Math.abs(correction.y) < 0.001) correction.y = 0;
}

/**
 * Where to draw the local player this frame, in tiles.
 *
 * @returns {{ x: number, y: number }} The same object every frame.
 */
export function getPredictedPosition() {
  drawn.x = position.x + correction.x;
  drawn.y = position.y + correction.y;
  return drawn;
}

/**
 * Stops predicting: the match is over, the board is gone or the player is out.
 */
export function stopPrediction() {
  active = false;
  history = [];
  tiles = null;
  bombs.clear();
}
