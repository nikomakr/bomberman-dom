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
  nicknameLength: 0, // characters typed in the nickname box, for its counter
  error: null,
  connection: "connecting",
  map: null,
  out: false, // true once this player has lost all their lives
  result: null, // { winner, scores } after the match ends, otherwise null
  paused: null, // { by } while the match is paused, otherwise null
  detonator: false, // this player has the Detonator power-up
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

// The chat keeps only the newest messages, so a long match does not keep
// growing the page.
const MAX_MESSAGES = 50;
let nextMessageId = 0;

// Gives a message an id that never changes, so the list can drop old
// messages without redrawing the ones that stay.
function withId(message) {
  nextMessageId += 1;
  return { ...message, id: nextMessageId };
}

export function addMessage(message) {
  store.setState((state) => ({
    messages: [...state.messages, withId(message)].slice(-MAX_MESSAGES),
  }));
}

export function setMessages(messages) {
  store.setState({ messages: messages.slice(-MAX_MESSAGES).map(withId) });
}

export function setNicknameLength(nicknameLength) {
  store.setState({ nicknameLength });
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
    // A player who left before a restart has no lives and is not in this match.
    players: data.players.filter((player) => player.lives > 0),
    detonator: false,
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
    result: { winner: data.winner, scores: data.scores || [], reason: data.reason || "" },
    out: false,
    paused: null,
  });
}

// Forgets the finished match and the nickname, so the player can join again.
export function backToStart() {
  store.setState({
    page: "nickname",
    nickname: "",
    nicknameLength: 0,
    messages: [],
    chatLength: 0,
    players: [],
    countdown: null,
    error: null,
    map: null,
    out: false,
    result: null,
    paused: null,
  });
}

// The connection to the server dropped: forget the match and show the
// "Connection lost" page.
export function connectionLost() {
  store.setState({
    page: "lost",
    players: [],
    countdown: null,
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
