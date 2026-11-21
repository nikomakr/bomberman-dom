
import { h } from '/framework/index.js';
import { store } from '../store.js';

let timer = null;
let startedAt = 0;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function startTimer() {
  startedAt = Date.now() - store.getState().time * 1000;

  timer = setInterval(() => {
    const time = Math.floor((Date.now() - startedAt) / 1000);
    store.setState({ time });
  }, 1000);
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export function Hud(state) {
  if (state.page !== 'game') return [];

  const players = state.players.map((player) =>
    h('div', { class: 'hud-player', key: player.id }, [
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
