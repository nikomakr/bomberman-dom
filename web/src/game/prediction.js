const SPEED = 4;
const TICK_SECONDS = 0.05;
const PLAYER_SIZE = 0.8;
const MOVE_STEP = 0.05;
const CORNER_TOLERANCE = 0.4;
const EPSILON = 1e-9;
const SNAP_DISTANCE = 0.5;

let gameMap = null;
let inputs = [];
let position = { x: 0, y: 0 };
let correction = { x: 0, y: 0 };
let lastAcknowledged = 0;
let active = false;

function canOccupy(x, y) {
  if (!gameMap) return false;

  const left = Math.floor(x + EPSILON);
  const top = Math.floor(y + EPSILON);
  const right = Math.floor(x + PLAYER_SIZE - EPSILON);
  const bottom = Math.floor(y + PLAYER_SIZE - EPSILON);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (
        col < 0 ||
        row < 0 ||
        col >= gameMap.columns ||
        row >= gameMap.rows ||
        gameMap.tiles[row * gameMap.columns + col] !== "empty"
      ) {
        return false;
      }
    }
  }

  return true;
}

function approach(from, to, maxStep) {
  if (Math.abs(to - from) <= maxStep) return to;
  return from + Math.sign(to - from) * maxStep;
}

function nudge(x, y, horizontal) {
  if (horizontal) {
    const center = y + PLAYER_SIZE / 2;
    const target = Math.round(center - 0.5) + 0.5 - PLAYER_SIZE / 2;
    if (Math.abs(target - y) <= CORNER_TOLERANCE && canOccupy(x, target))
      return { x, y: target };
  } else {
    const center = x + PLAYER_SIZE / 2;
    const target = Math.round(center - 0.5) + 0.5 - PLAYER_SIZE / 2;
    if (Math.abs(target - x) <= CORNER_TOLERANCE && canOccupy(target, y))
      return { x: target, y };
  }

  return { x, y };
}

function moveAxis(horizontal, direction, distance) {
  let moved = false;

  for (let remaining = distance; remaining > 0; remaining -= MOVE_STEP) {
    const step = Math.min(MOVE_STEP, remaining) * direction;
    const x = position.x + (horizontal ? step : 0);
    const y = position.y + (horizontal ? 0 : step);

    if (!canOccupy(x, y)) break;

    position = { x, y };
    moved = true;
  }

  if (moved) return;

  const target = nudge(position.x, position.y, horizontal);

  position = {
    x: approach(position.x, target.x, distance),
    y: approach(position.y, target.y, distance),
  };
}

function simulate(input, seconds) {
  let dx = Number(input.left) * -1 + Number(input.right);
  let dy = Number(input.up) * -1 + Number(input.down);

  let distance = SPEED * seconds;

  if (dx !== 0 && dy !== 0) {
    distance *= Math.SQRT1_2;
  }

  if (dx !== 0) moveAxis(true, dx, distance);
  if (dy !== 0) moveAxis(false, dy, distance);
}

export function startPrediction(map, startPosition) {
  gameMap = map;
  position = { ...startPosition };
  inputs = [];
  correction = { x: 0, y: 0 };
  lastAcknowledged = 0;
  active = true;
}

export function recordInput(input) {
  if (!active) return;

  inputs.push({
    ...input,
    seq: input.seq,
  });
}

export function reconcile(serverPosition, lastInput) {
  if (!active) return;

  inputs = inputs.filter((input) => input.seq > lastInput);
  lastAcknowledged = Math.max(lastAcknowledged, lastInput);

  const previous = { ...position };

  position = {
    x: serverPosition.x,
    y: serverPosition.y,
  };

  for (const input of inputs) {
    simulate(input, TICK_SECONDS);
  }

  const dx = previous.x - position.x;
  const dy = previous.y - position.y;
  const distance = Math.hypot(dx, dy);

  if (distance > SNAP_DISTANCE) {
    correction = { x: 0, y: 0 };
  } else {
    correction = { x: dx, y: dy };
  }
}

export function updatePrediction(delta) {
  if (!active) return;

  const seconds = Math.min(delta, 50) / 1000;

  // The latest held input determines movement between server updates.
  if (inputs.length > 0) {
    simulate(inputs[inputs.length - 1], seconds);
  }

  correction.x *= 0.75;
  correction.y *= 0.75;

  if (Math.abs(correction.x) < 0.001) correction.x = 0;
  if (Math.abs(correction.y) < 0.001) correction.y = 0;
}

export function getPredictedPosition() {
  return {
    x: position.x + correction.x,
    y: position.y + correction.y,
  };
}

export function stopPrediction() {
  active = false;
  inputs = [];
  gameMap = null;
}
