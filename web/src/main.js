import { createRouter, createApp } from "/framework/index.js";
import { store } from "./store.js";
import { Board } from "./views/Board.js";
import { Chat } from "./views/Chat.js";
import { Nickname } from "./views/Nickname.js";
import "./net/socket.js";

/**
 * Checks that the player has chosen a nickname. If not, sends them back to
 * the nickname page.
 *
 * @param {{ getState: Function }} routerStore
 * @returns {boolean} True if a nickname is set.
 */
function hasNickname(routerStore) {
  if (routerStore.getState().nickname) return true;
  location.hash = "#/";
  return false;
}

createRouter({
  store,
  routes: {
    "/": (routerStore) => routerStore.setState({ page: "nickname" }),
    "/lobby": (routerStore) => {
      if (hasNickname(routerStore)) routerStore.setState({ page: "lobby" });
    },
    "/game": (routerStore) => {
      if (hasNickname(routerStore)) routerStore.setState({ page: "game" });
    },
  },
});

// Pages in #app: one view per page. The waiting page joins here in BD-12.
createApp({
  root: document.getElementById("app"),
  store,
  view: (state) => (state.page === "nickname" ? Nickname(state) : []),
  select: (state) => ({ page: state.page, error: state.error }),
});

// Chat in #chat: shown on the waiting page and in game, hidden on #/.
createApp({
  root: document.getElementById("chat"),
  store,
  view: (state) => (state.page === "nickname" ? [] : Chat(state)),
  select: (state) => ({ page: state.page, messages: state.messages }),
});

createApp({
  root: document.getElementById("board"),
  store,
  view: Board,
  select: (state) => ({ page: state.page, map: state.map }),
});
