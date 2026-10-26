const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

export function send(type, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, data }));
  }
}
