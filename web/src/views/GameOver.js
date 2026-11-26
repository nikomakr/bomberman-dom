import { h } from "/framework/index.js";
import { backToStart } from "../store.js";
import { send, connect } from "../net/socket.js";

// The end of a match: who won and everyone's final score, highest first,
// and a way back to the nickname page to play again.

/**
 * Clears this player's match and goes back to the nickname page, and takes
 * every other player on this screen back with them. The server has already
 * reset the lobby, so joining again works straight away.
 */
function onBackToStart() {
  send("backToStart", {});
  backToStart();
  window.location.hash = "#/";
}

/**
 * One row of the scores: the winner's row is gold, and this player's own row
 * is outlined and marked "(you)", so everyone finds themselves.
 *
 * @param {{ id: number, nickname: string, score: number }} player
 * @param {boolean} isWinner
 * @param {boolean} isYou
 * @returns {Object} A virtual node.
 */
function scoreRow(player, isWinner, isYou) {
  let className = "game-over-score";
  if (isWinner) className += " game-over-winner";
  if (isYou) className += " game-over-you";

  return h("li", { key: player.id, class: className }, [
    h("span", {}, isYou ? `${player.nickname} (you)` : player.nickname),
    h("span", {}, String(player.score)),
  ]);
}

/**
 * The game over page.
 *
 * @param {{ nickname: string, result: { winner: { id: number, nickname: string }|null, scores: Array<{ id: number, nickname: string, score: number }> } }} state
 * @returns {Object} A virtual node.
 */
export function GameOver(state) {
  const { winner, scores, reason } = state.result;
  const ranked = [...scores].sort((a, b) => b.score - a.score);

  return h("main", { class: "game-over" }, [
    h("h1", {}, winner ? `${winner.nickname} wins!` : "Nobody is left standing"),
    reason === "highestScore"
      ? h("p", { class: "game-over-note" }, "Nothing was left to destroy or collect, so the highest score among the players still in wins.")
      : null,
    h(
      "ol",
      { class: "game-over-scores" },
      ranked.map((player) =>
        scoreRow(player, Boolean(winner) && player.id === winner.id, player.nickname === state.nickname),
      ),
    ),
    h("button", { class: "game-over-button", on: { click: onBackToStart } }, "Back to start"),
  ]);
}

/**
 * Opens a new connection and goes back to the nickname page, using the same
 * reset as the end of a match.
 */
function onReconnect() {
  connect();
  backToStart();
  window.location.hash = "#/";
}

/**
 * Shown when the connection to the server drops. The game has already been
 * stopped; Back to start connects again so the player can join a new game.
 *
 * @returns {Object} A virtual node.
 */
export function ConnectionLost() {
  return h("main", { class: "game-over", role: "alert" }, [
    h("h1", {}, "Connection lost"),
    h("p", { class: "game-over-note" }, "The game cannot reach the server. Check the server is running, then go back to start."),
    h("button", { class: "game-over-button", on: { click: onReconnect } }, "Back to start"),
  ]);
}

/**
 * Shown over the board to a player who has lost all their lives while the
 * others keep playing.
 *
 * @returns {Object} A virtual node.
 */
export function OutBanner() {
  return h("p", { class: "out-banner", role: "status" }, "You are out. Watch the rest of the match.");
}
