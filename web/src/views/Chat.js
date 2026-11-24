// The chat view: the message list and the box for typing a new message.

import { h, onKey } from "/framework/index.js";
import { send } from "../net/socket.js";
import { setChatLength } from "../store.js";
import { limitChars } from "../text.js";
import { playerColour } from "../colours.js";

const MAX_LENGTH = 200; // the same limit the server uses

/**
 * @param {Array<{ nickname: string, colour?: string }>} players
 * @param {string} nickname
 * @returns {string} A class for the sender's colour, or none if they left.
 */
function colourClass(players, nickname) {
  const index = players.findIndex((player) => player.nickname === nickname);
  if (index === -1) return "";
  return ` chat-player-${playerColour(players[index], index)}`;
}
// "14:05" from a timestamp in milliseconds. Empty if there is none.
function formatTime(value) {
  if (value === undefined || value === null) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sendMessage(event, input) {
  const text = input.value.trim();
  if (text === "") return;
  send("chat", { text });
  input.value = "";
  setChatLength(0);
}
function updateChatLength(event, input) {
  setChatLength(limitChars(event, input, MAX_LENGTH));
}

function renderMessage(message, players) {
  return h(
    "li",
    {
      key: message.id,
      class: `chat-message${colourClass(players, message.nickname)}`,
      // Keep the newest message in view (scrolls the list, not the page).
      onMount: (el) => {
        el.parentNode.scrollTop = el.parentNode.scrollHeight;
      },
    },
    [
      h("time", { class: "chat-time" }, formatTime(message.time)),
      " ",
      h("strong", { class: "chat-nickname" }, message.nickname),
      " ",
      // A plain string child becomes a text node, so the text is never read as HTML.
      h("span", { class: "chat-text" }, message.text),
    ],
  );
}

/**
 * The chat panel, shown on #/lobby and #/game. One line per message, newest
 * at the bottom, each in the colour of the player who sent it.
 *
 * @param {{ players: Array<{ nickname: string, colour?: string }>, chatLength: number, messages: Array<{ id: number, nickname: string, text: string, time: number }> }} state
 * @returns {Object} Virtual node.
 */
export function Chat(state) {
  return h("section", { class: "chat" }, [
    h(
      "ul",
      { class: "chat-messages" },
      state.messages.map((message) => renderMessage(message, state.players)),
    ),
    h("input", {
      class: "chat-input",
      type: "text",
      placeholder: "Type a message…",
      autocomplete: "off",
      on: {
        input: updateChatLength,
        compositionend: updateChatLength,
        keydown: onKey({ Enter: sendMessage }),
      },
    }),
    h("p", { class: "chat-counter" }, `${state.chatLength} / ${MAX_LENGTH}`),
  ]);
}
