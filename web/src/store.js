import { createStore } from "/framework/index.js";

// The one store shared by every page.
export const store = createStore({
  page: "home",
  nickname: "",
  players: [],
  countdown: null, // { phase, seconds } while the server counts, otherwise null
  messages: [],
  chatLength: 0,
  error: null,
  connection: "connecting",
  map: null,
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
    map: data.map,
    countdown: null,
    error: null,
  });
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
