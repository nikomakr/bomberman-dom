import {
  setPlayers,
  setCountdown,
  addMessage,
  setError,
  setConnection,
  startGame,
} from "../store.js";

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

export function send(type, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, data }));
  }
}

// One dispatch table: incoming message type -> store action.
const dispatch = {
  lobby: (data) => setPlayers(data.players),
  countdown: (data) => setCountdown(data.seconds),
  chat: (data) => addMessage(data),
  error: (data) => setError(data.message),
  start: (data) => startGame(data.players),
};

socket.addEventListener("open", () => {
  setConnection("open");
});

socket.addEventListener("message", (event) => {
  let message;

  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }

  if (!message || typeof message.type !== "string") {
    return;
  }

  const action = dispatch[message.type];

  // Unknown message types are ignored.
  if (typeof action === "function") {
    action(message.data);
  }
});

socket.addEventListener("close", () => {
  setConnection("closed");
});
