import { h, navigate, getState, setState } from "../../framework/index.js";

export default function GameOver() {
  const { winnerId, scores = [] } = getState();
  const winner = scores.find((p) => p.id === winnerId);

  const backToStart = () => {
    setState({ nickname: "", winnerId: null, scores: [], isOut: false });
    navigate("#/");
  };

  return h(
    "main",
    { class: "game-over" },
    h("h1", null, winner ? `${winner.nickname} won the match!` : "Match over"),
    h(
      "ul",
      { class: "scores" },
      ...scores
        .slice()
        .sort((a, b) => b.score - a.score)
        .map((p) => h("li", { key: p.id }, `${p.nickname}: ${p.score}`)),
    ),
    h("button", { onclick: backToStart }, "Back to start"),
  );
}

// when the server says this player is out - 'you are out' and input lock.
if (msg.type === "player_out" && msg.id === getState().myId) {
  setState({ isOut: true });
}

// at the top of your keydown handler and your place-bomb function
if (getState().isOut) return;

// in the game view's render
getState().isOut && h("div", { class: "out-banner" }, "You are out");

// stop loop and key tracking when leaving the board

let rafId = null;
const onKeyDown = (e) => {
  /* your existing handler */
};
const onKeyUp = (e) => {
  /* your existing handler */
};

function start() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const loop = () => {
    /* update + render */ rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function stop() {
  cancelAnimationFrame(rafId);
  rafId = null;
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
}
