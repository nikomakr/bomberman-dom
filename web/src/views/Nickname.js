import { h } from '/framework/index.js';
import { store, setError, setNickname } from '../store.js';
import { send } from '../net/socket.js';

const MAX_LENGTH = 12;

// The nickname sent to the server, waiting for its answer. Only this page
// needs it, so it does not belong in the store.
let pending = '';

// The server answers a join with a lobby message (joined) or an error.
store.subscribe(
  (state) => state.players,
  (state) => {
    if (pending && state.players.some((player) => player.nickname === pending)) {
      // The store must hold the nickname before the route changes,
      // because #/lobby sends players without a nickname back to #/.
      setNickname(pending);
      pending = '';
      location.hash = '#/lobby';
    }
  },
);

store.subscribe(
  (state) => state.error,
  (state) => {
    if (state.error) pending = '';
  },
);

function onSubmit(event) {
  event.preventDefault();

  const nickname = event.target.elements.nickname.value.trim();
  const length = [...nickname].length;
  if (length < 1 || length > MAX_LENGTH) {
    setError(`Your nickname must be 1 to ${MAX_LENGTH} characters long.`);
    return;
  }

  setError(null);
  pending = nickname;
  send('join', { nickname });
}

/**
 * The nickname page, shown on #/.
 *
 * @param {{ error: string|null }} state
 * @returns {Object} Virtual node.
 */
export function Nickname(state) {
  return h('main', { class: 'nickname' }, [
    h('h1', {}, 'Bomberman DOM'),
    h('form', { class: 'nickname-form', on: { submit: onSubmit } }, [
      h('label', { for: 'nickname' }, 'Choose a nickname'),
      h('input', {
        id: 'nickname',
        name: 'nickname',
        type: 'text',
        maxlength: MAX_LENGTH,
        autocomplete: 'off',
        placeholder: 'Nickname',
        onMount: (el) => el.focus(),
      }),
      h('p', { class: 'nickname-error', role: 'alert' }, state.error || ''),
      h('button', { type: 'submit' }, 'Join'),
    ]),
  ]);
}
