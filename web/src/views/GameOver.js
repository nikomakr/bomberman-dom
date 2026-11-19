import { h } from "/framework/index.js";
import { backToStart } from "../store.js";

// The end of a match: who won and everyone's final score, highest first,
// and a way back to the nickname page to play again.

/**
 * Clears this player's match and goes back to the nickname page. The server
 * has already reset the lobby, so joining again works straight away.
 */
function onBackToStart() {
  backToStart();
  window.location.hash = "#/";
}

/**
 * The game over page.
 *
 * @param {{ result: { winner: { id: number, nickname: string }|null, scores: Array<{ id: number, nickname: string, score: number }> } }} state
 * @returns {Object} A virtual node.
 */
export function GameOver(state) {
  const { winner, scores } = state.result;
  const ranked = [...scores].sort((a, b) => b.score - a.score);

  return h("main", { class: "game-over" }, [
    h("h1", {}, winner ? `${winner.nickname} wins!` : "Nobody is left standing"),
    h(
      "ol",
      { class: "game-over-scores" },
      ranked.map((player) =>
        h(
          "li",
          {
            key: player.id,
            class: winner && player.id === winner.id ? "game-over-score game-over-winner" : "game-over-score",
          },
          [h("span", {}, player.nickname), h("span", {}, String(player.score))],
        ),
      ),
    ),
    h("button", { class: "game-over-button", on: { click: onBackToStart } }, "Back to start"),
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
