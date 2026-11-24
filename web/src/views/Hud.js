import { h } from '/framework/index.js';
import { store } from '../store.js';

// The scoreboard above the map: how long the match has run, and every
// player's score and lives, each in that player's colour. The timer measures
// real time but skips pauses, and starts again from 0 on a restart.

const TIMER_STEP = 250; // ms between checks; Chrome may slow this in hidden windows

let timer = null;
let playedMs = 0; // time played in this match, without pauses
let lastCheck = 0;
let lastShown = 0;

/**
 * @param {number} seconds
 * @returns {string} The time as mm:ss.
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

/**
 * Adds the real time since the last check, unless paused. It measures time
 * rather than counting checks, so a window whose timer Chrome slowed down
 * catches up as soon as it runs again.
 */
function checkTimer() {
  const now = performance.now();
  const { paused, time } = store.getState();
  if (time < lastShown) playedMs = 0; // a restart set the time back to 0
  if (!paused) playedMs += now - lastCheck;
  lastCheck = now;

  const seconds = Math.floor(playedMs / 1000);
  lastShown = seconds;
  if (seconds !== time) store.setState({ time: seconds });
}

function startTimer() {
  stopTimer();
  playedMs = 0;
  lastShown = 0;
  lastCheck = performance.now();
  timer = setInterval(checkTimer, TIMER_STEP);
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * @param {{ page: string, players: Array<{ id: number, nickname: string }>, score: Object, lives: Object, time: number }} state
 * @returns {Object|Array} A virtual node, or nothing outside a match.
 */
export function Hud(state) {
  if (state.page !== 'game') return [];

  const players = state.players.map((player) =>
    h('div', { class: `hud-player hud-player-${player.colour}`, key: player.id }, [
      h('span', { class: 'hud-player-name' }, player.nickname),
      h('span', {}, `Score: ${state.score[player.id] ?? 0}`),
      h('span', {}, `Lives: ${state.lives[player.id] ?? 0}`),
    ]),
  );

  return h('section', {
    class: 'hud',
    onMount: startTimer,
    onUnmount: stopTimer,
  }, [
    h('div', { class: 'hud-time' }, `Time: ${formatTime(state.time)}`),
    h('div', { class: 'hud-players' }, players),
  ]);
}
