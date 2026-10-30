import { createRouter, createApp } from "/framework/index.js";
import { store } from "./store.js";
import { Board } from "./views/Board.js";
import "./net/socket.js";
/**

Checks that the player has chosen a nickname. If not, sends them back to
the nickname page.
@param {{ getState: Function }} routerStore
@returns {boolean} True if a nickname is set.
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

createApp({
  root: document.getElementById('board'),
  store,
  view: Board,
  select: (state) => state.page,
});
