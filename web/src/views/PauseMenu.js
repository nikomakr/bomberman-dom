import { h } from "/framework/index.js";
import { send } from "../net/socket.js";

// The pause menu, shown to every player while the match is paused. Players
// still in the game choose with the arrow keys and Enter, or with the mouse.

export const PAUSE_OPTIONS = [
  { action: "continue", label: "Continue" },
  { action: "restart", label: "Restart" },
];

/**
 * Asks the server to pause, continue or restart the match for everyone.
 *
 * @param {"pause"|"continue"|"restart"} action
 */
export function sendPauseAction(action) {
  send("pause", { action });
}

/**
 * @param {{ paused: { by: string }, pauseChoice: number, out: boolean }} state
 * @returns {Object} A virtual node.
 */
export function PauseMenu(state) {
  const options = state.out
    ? h("p", { class: "pause-hint" }, "Waiting for a player to continue.")
    : h(
        "ul",
        { class: "pause-options" },
        PAUSE_OPTIONS.map((option, index) =>
          h("li", { key: option.action }, [
            h(
              "button",
              {
                class: index === state.pauseChoice ? "pause-option pause-option-selected" : "pause-option",
                on: { click: () => sendPauseAction(option.action) },
              },
              option.label,
            ),
          ]),
        ),
      );

  return h("section", { class: "pause-menu", role: "dialog", "aria-label": "Pause menu" }, [
    h("h2", {}, "Paused"),
    h("p", { class: "pause-by" }, `Paused by ${state.paused.by}`),
    options,
    state.out ? null : h("p", { class: "pause-hint" }, "Up and Down to choose, Enter to select, Esc to continue"),
  ]);
}
