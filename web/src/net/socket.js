// The WebSocket connection to the server: sends messages and hands each incoming one to the store or the game.

import {
  setPlayers,
  setCountdown,
  addMessage,
  setError,
  setConnection,
  startGame,
  endGame,
  setPaused,
  backToStart,
  connectionLost,
  store,
} from "../store.js";
import { startMatch, updatePlayers, clearPlayers } from "../game/players.js";

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const url = `${protocol}//${window.location.host}/ws`;

let socket = null;

// True while the page itself is closing (reload, close tab, leave the site),
// so that closing the connection then is not reported as a lost connection.
let leavingPage = false;
window.onpagehide = () => {
  leavingPage = true;
};

export function send(type, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, data }));
  }
}

// One dispatch table: incoming message type -> store action.
const dispatch = Object.freeze({
  lobby: (data) => setPlayers(data.players),
  countdown: (data) => setCountdown(data.phase, data.seconds),
  chat: (data) => addMessage(data),
  error: (data) => setError(data.message),
  start: (data) => {
    // A chat box that still has focus would swallow the arrow keys.
    if (document.activeElement !== document.body) document.activeElement.blur();
    startMatch(data);
    startGame(data);
    window.location.hash = "#/game";
  },
  // Positions change about 20 times a second, so they are kept outside the
  // store and do not re-render the page.
  state: (data) => updatePlayers(data),
  pause: (data) => setPaused(data),
  end: (data) => {
    endGame(data);
    window.location.hash = "#/over";
  },
  // Someone left the scores screen, so everyone still on it goes back too.
  backToStart: () => {
    if (store.getState().page !== "over") return;
    backToStart();
    window.location.hash = "#/";
  },
});

function onMessage(event) {
  let message;

  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }

  if (!message || typeof message.type !== "string") {
    return;
  }

  if (!Object.hasOwn(dispatch, message.type)) {
    return;
  }

  dispatch[message.type](message.data);
}

/**
 * The connection dropped without the page asking for it (the server stopped,
 * the network went, the laptop slept). The game stops and the page says so.
 */
function onClose() {
  setConnection("closed");
  if (leavingPage) return;
  clearPlayers(); // stops prediction and frees every board element
  connectionLost(); // leaving the game page also stops the loop and input
}

/**
 * Opens a new connection to the server. Called once when the page loads, and
 * again by the Back to start button after the connection was lost.
 */
export function connect() {
  setConnection("connecting");
  socket = new WebSocket(url);
  socket.onopen = () => setConnection("open");
  socket.onmessage = onMessage;
  socket.onclose = onClose;
}

connect();
