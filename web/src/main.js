// Entry point: sets up the routes and puts each part of the page on screen.

import { createRouter, createApp } from "/framework/index.js";
import { store } from "./store.js";
import { Board } from "./views/Board.js";
import { Chat } from "./views/Chat.js";
import { GameOver, OutBanner } from "./views/GameOver.js";
import { Hud } from "./views/Hud.js";
import { Lobby } from "./views/Lobby.js";
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
    "/over": (routerStore) => {
      if (routerStore.getState().result) routerStore.setState({ page: "over" });
      else location.hash = "#/";
    },
  },
});

// Pages in #app: one view per page.
createApp({
  root: document.getElementById("app"),
  store,
  view: (state) => {
    if (state.page === "nickname") return Nickname(state);
    if (state.page === "lobby") return Lobby(state);
    if (state.page === "over") return GameOver(state);
    if (state.page === "game" && state.out) return OutBanner();
    return [];
  },
  select: (state) => ({
    page: state.page,
    nickname: state.nickname,
    error: state.error,
    players: state.players,
    countdown: state.countdown,
    out: state.out,
    result: state.result,
  }),
});

// Chat in #chat: shown on the waiting page and in game, hidden on #/.
createApp({
  root: document.getElementById("chat"),
  store,
  view: (state) => (state.page === "nickname" ? [] : Chat(state)),
  select: (state) => ({
    page: state.page,
    messages: state.messages,
    chatLength: state.chatLength,
  }),
});

createApp({
  root: document.getElementById("board"),
  store,
  view: Board,
  select: (state) => ({
    page: state.page,
    map: state.map,
    paused: state.paused,
    out: state.out,
  }),
});

createApp({
  root: document.getElementById("hud"),
  store,
  view: Hud,
  select: (state) => ({
    page: state.page,
    lives: state.lives,
    score: state.score,
    time: state.time,
  }),
});
