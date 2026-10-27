import { createStore } from "/framework/index.js";

// The one store shared by every page.
export const store = createStore({
  page: "home", // 'home' | 'lobby' | 'game'
  nickname: "",
  players: [],
  countdown: null, // seconds left, or null when no countdown is running
  messages: [],
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
  store.setState((state) => ({ messages: [...state.messages, message] }));
}

export function setMessages(messages) {
  store.setState({ messages });
}

