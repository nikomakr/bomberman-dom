import { h, onKey } from "/framework/index.js";
import { send } from "../net/socket.js";

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
}

function renderMessage(message, index) {
  return h(
    "li",
    {
      key: `${message.time}-${index}`,
      class: "chat-message",
      // Keep the newest message in view (scrolls the list, not the page).
      onMount: (el) => {
        el.parentNode.scrollTop = el.parentNode.scrollHeight;
      },
    },
    [
      h("strong", { class: "chat-nickname" }, message.nickname),
      " ",
      h("time", { class: "chat-time" }, formatTime(message.time)),
      // A plain string child becomes a text node, so the text is never read as HTML.
      h("p", { class: "chat-text" }, message.text),
    ],
  );
}

/**
 * The chat panel, shown on #/lobby and #/game.
 *
 * @param {{ messages: Array<{ nickname: string, text: string, time: number }> }} state
 * @returns {Object} Virtual node.
 */
export function Chat(state) {
  return h("section", { class: "chat" }, [
    h("ul", { class: "chat-messages" }, state.messages.map(renderMessage)),
    h("input", {
      class: "chat-input",
      type: "text",
      placeholder: "Type a message and press Enter",
      autocomplete: "off",
      on: { keydown: onKey({ Enter: sendMessage }) },
    }),
  ]);
}
