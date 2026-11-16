// Keeps the players of the running match and draws them smoothly.
//
// The server sends a `state` about 20 times a second and lists only the
// players that changed. For every player this module remembers the last two
// positions it received. Each frame it draws the player somewhere between
// them (interpolation), so the movement looks smooth at 60 FPS.

import { store } from "../store.js";

import {
  startPrediction,
  applyMapChanges,
  reconcile,
  setSpeed,
  getPredictedPosition,
  stopPrediction,
} from "./prediction.js";

import {
  acquireEntity,
  releaseEntity,
  setEntityPosition,
  isEntityActive,
} from "./entities.js";

// Time between two server updates, in milliseconds (the server sends 20 a second).
const TICK_MS = 50;

const players = new Map(); // player id -> { nickname, number, entity, from, to, arrivedAt }
let localId = null; // id of the player on this screen, drawn from prediction
let spriteOffset = 0; // centres a one-tile sprite on the player's smaller box

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// Where a player should be drawn right now, in tiles.
function positionAt(player, now) {
  const t = clamp01((now - player.arrivedAt) / TICK_MS);
  return {
    x: lerp(player.from.x, player.to.x, t) - spriteOffset,
    y: lerp(player.from.y, player.to.y, t) - spriteOffset,
  };
}

/**
 * Removes every player from the board and forgets them.
 */
export function clearPlayers() {
  for (const player of players.values()) {
    releaseEntity(player.entity);
  }
  stopPrediction();
  players.clear();
  localId = null;
}

/**
 * Starts tracking the players of a new match.
 *
 * @param {{ playerSize: number, players: Array<{ id: number, nickname: string, position: { x: number, y: number } }> }} data - The `start` message data.
 */
export function startMatch(data) {
  clearPlayers();
  spriteOffset = (1 - data.playerSize) / 2;
  const now = performance.now();

  const nickname = store.getState().nickname;
  const localPlayer = data.players.find(
    (player) => player.nickname === nickname,
  );
  if (localPlayer) {
    localId = localPlayer.id;
    startPrediction(data, localPlayer.position);
  }

  data.players.forEach((player, index) => {
    players.set(player.id, {
      nickname: player.nickname,
      number: index + 1, // join order: the 1st player is red, the 2nd blue, and so on
      entity: null,
      from: { x: player.position.x, y: player.position.y },
      to: { x: player.position.x, y: player.position.y },
      arrivedAt: now,
    });
  });
}

/**
 * Records a `state` update. Only the players the server lists have moved.
 *
 * @param {{ players?: Array<{ id: number, position: { x: number, y: number } }> }} data - The `state` message data.
 */
export function updatePlayers(data) {
  if (!data) return;
  applyMapChanges(data);
  if (!Array.isArray(data.players)) return;
  const now = performance.now();

  for (const update of data.players) {
    const player = players.get(update.id);
    if (!player) continue;
    if (update.id === localId) {
      if (update.lives === 0) { 
        stopPrediction();
      } else {
        setSpeed(update.speed);
        reconcile(update.position, update.lastInput);
      }
    }
    if (update.lives === 0) {
      removePlayer(update.id);
      continue;
    }
    player.from = player.to;
    player.to = { x: update.position.x, y: update.position.y };
    player.arrivedAt = now;
  }
}

/**
 * Takes a player off the board, for example when they leave the match.
 *
 * @param {number} id
 */
export function removePlayer(id) {
  const player = players.get(id);
  if (!player) return;
  releaseEntity(player.entity);
  players.delete(id);
}

/**
 * Runs once per frame: places every player between their last two positions.
 *
 * @param {number} now - performance.now() of this frame.
 */
export function drawPlayers(now) {
  for (const [id, player] of players) {
    let { x, y } = positionAt(player, now);

    if (id === localId) {
      const predicted = getPredictedPosition();
      x = predicted.x - spriteOffset;
      y = predicted.y - spriteOffset;
    }

    // Takes an element from the pool the first time, and again if the board
    // was rebuilt and the old element is gone.
    if (!player.entity || !isEntityActive(player.entity)) {
      player.entity = acquireEntity("players", {
        x,
        y,
        playerNumber: player.number,
        nickname: player.nickname,
      });
      if (!player.entity) continue;
    }

    setEntityPosition(player.entity, x, y);
  }
}
