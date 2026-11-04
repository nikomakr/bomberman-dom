import { h, createApp, onKey } from "../../framework/index.js";
import { store } from "../store.js";
import { send } from "../net/socket.js";

let app = null;

// "14:05" from a timestamp (ISO string or milliseconds). Empty if there is none.
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
      key: message.id ?? index,
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

function view(state) {
  return h("section", { class: "chat" }, [
    h(
      "ul",
      {
        class: "chat-messages",
        style: { maxHeight: "200px", overflowY: "auto" },
      },
      state.messages.map(renderMessage),
    ),
    h("input", {
      class: "chat-input",
      type: "text",
      placeholder: "Type a message and press Enter",
      autocomplete: "off",
      on: { keydown: onKey({ Enter: sendMessage }) },
    }),
  ]);
}

/**
 * Shows the chat panel in #chat. Called by the router for #/lobby and #/game.
 * Calling it again while the panel is already shown does nothing.
 *
 * @returns {{ unmount: Function }} Call unmount() to hide the panel (on #/).
 */
export function mountChat() {
  if (!app) {
    app = createApp({
      root: document.getElementById("chat"),
      store,
      select: (state) => state.messages,
      view,
    });
  }

  return {
    unmount() {
      if (app) app.unmount();
      app = null;
    },
  };
}
