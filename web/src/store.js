// The app's shared state, and the actions that change it.

import { createStore } from "/framework/index.js";

// The one store shared by every page.
export const store = createStore({
  page: "home",
  nickname: "",
  players: [],
  lives: {},
  score: {},
  time: 0,
  countdown: null, // { phase, seconds } while the server counts, otherwise null
  messages: [],
  chatLength: 0,
  error: null,
  connection: "connecting",
  map: null,
  out: false, // true once this player has lost all their lives
  result: null, // { winner, scores } after the match ends, otherwise null
  paused: null, // { by } while the match is paused, otherwise null
});

// Actions: every change to the state goes through setState.

export function setPage(page) {
  store.setState({ page });
}

export function setNickname(nickname) {
  store.setState({ nickname });
}

export function setPlayers(players) {
  store.setState({ players });
}

export function setCountdown(phase, seconds) {
  store.setState({ countdown: { phase, seconds } });
}

export function addMessage(message) {
  store.setState((state) => ({
    messages: [...state.messages, message],
  }));
}

export function setMessages(messages) {
  store.setState({ messages });
}

export function setChatLength(chatLength) {
  store.setState({ chatLength });
}

export function setError(error) {
  store.setState({ error });
}

export function setConnection(connection) {
  store.setState({ connection });
}

export function startGame(data) {
  store.setState({
    page: "game",
    players: data.players,
    lives: Object.fromEntries(data.players.map((player) => [player.id, player.lives])),
    score: Object.fromEntries(data.players.map((player) => [player.id, player.score])),
    time: 0,
    map: data.map,
    countdown: null,
    error: null,
    out: false,
    result: null,
    paused: null,
  });
}

export function setOut() {
  store.setState({ out: true });
}

export function endGame(data) {
  store.setState({
    page: "over",
    result: { winner: data.winner, scores: data.scores || [] },
    out: false,
    paused: null,
  });
}

// Forgets the finished match and the nickname, so the player can join again.
export function backToStart() {
  store.setState({
    page: "nickname",
    nickname: "",
    players: [],
    countdown: null,
    error: null,
    map: null,
    out: false,
    result: null,
    paused: null,
  });
}

// Pauses or continues the match on this page, with who did it.
export function setPaused(data) {
  store.setState({ paused: data.paused ? { by: data.by } : null });
}

// Turns destroyed blocks into floor in one update, so the board redraws once
// per message however many blocks a chain explosion breaks.
export function destroyBlocks(cells) {
  store.setState((state) => {
    if (!state.map || cells.length === 0) return;

    const { columns, rows } = state.map;
    const tiles = state.map.tiles.slice();
    let changed = false;

    for (const { col, row } of cells) {
      if (col < 0 || row < 0 || col >= columns || row >= rows) continue;
      const index = row * columns + col;
      if (tiles[index] !== "empty") {
        tiles[index] = "empty";
        changed = true;
      }
    }

    if (!changed) return;
    return { map: { ...state.map, tiles } };
  });
}
