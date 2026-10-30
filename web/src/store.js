import { createStore } from "/framework/index.js";

// The one store shared by every page.
export const store = createStore({
  page: "home",
  nickname: "",
  players: [],
  countdown: null,
  messages: [],
  error: null,
  connection: "connecting",
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

export function setCountdown(countdown) {
  store.setState({ countdown });
}

export function addMessage(message) {
  store.setState((state) => ({
    messages: [...state.messages, message],
  }));
}

export function setMessages(messages) {
  store.setState({ messages });
}

export function setError(error) {
  store.setState({ error });
}

export function setConnection(connection) {
  store.setState({ connection });
}

export function startGame(players) {
  store.setState({
    page: "game",
    players,
    countdown: null,
    error: null,
  });
}
