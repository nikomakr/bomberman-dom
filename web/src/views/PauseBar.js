import { h } from "/framework/index.js";
import { send } from "../net/socket.js";

// The bar under the map: the key to pause while playing, and who paused with
// the keys to continue or restart while paused. It has no buttons, so it only
// redraws when the match is paused or continued.

/**
 * Asks the server to pause, continue or restart the match for everyone.
 *
 * @param {"pause"|"continue"|"restart"} action
 */
export function sendPauseAction(action) {
  send("pause", { action });
}

/**
 * One key and what it does, e.g. [Esc] Pause.
 *
 * @param {string} key
 * @param {string} label
 * @returns {Object} A virtual node.
 */
function keyHint(key, label) {
  return h("span", { class: "pause-key" }, [h("kbd", {}, key), ` ${label}`]);
}

/**
 * @param {{ paused: { by: string }|null, out: boolean }} state
 * @returns {Object} A virtual node.
 */
export function PauseBar(state) {
  if (!state.paused) {
    return h("div", { class: "pause-bar" }, state.out ? [] : [keyHint("Esc", "Pause")]);
  }

  const keys = state.out ? [] : [keyHint("Esc", "Continue"), keyHint("R", "Restart")];
  return h("div", { class: "pause-bar pause-bar-paused", role: "status" }, [
    h("strong", {}, `Paused by ${state.paused.by}`),
    ...keys,
  ]);
}
