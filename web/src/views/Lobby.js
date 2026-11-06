import { h } from "/framework/index.js";

const MAX_PLAYERS = 4;

/**
 * The timer line: what the server is counting, or '' when nothing is shown.
 *
 * @param {{ phase: string, seconds: number }|null} countdown
 * @returns {string}
 */
function countdownText(countdown) {
  if (!countdown) return "";
  if (countdown.phase === "wait")
    return `Waiting for players: ${countdown.seconds}`;
  if (countdown.phase === "countdown")
    return `Game starts in: ${countdown.seconds}`;
  return ""; // "waiting" (not enough players) or anything else
}

/**
 * The waiting page: who has joined, how many, and the time left.
 *
 * @param {Object} state
 * @returns {Object} A virtual node.
 */
export function Lobby(state) {
  const players = state.players;
  const timer = countdownText(state.countdown);

  return h("main", { class: "lobby" }, [
    h("h1", {}, "Lobby"),
    h("p", { class: "lobby-counter" }, `${players.length} / ${MAX_PLAYERS}`),
    h(
      "ul",
      { class: "lobby-players" },
      players.map((player) =>
        h("li", { key: player.id, class: "lobby-player" }, player.nickname),
      ),
    ),
    timer ? h("p", { class: "lobby-timer", role: "status" }, timer) : null,
  ]);
}

