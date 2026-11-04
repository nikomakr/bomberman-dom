import { h, createApp } from '../../framework/index.js';
import { store, setNickname } from '../store.js';
import { send } from '../socket.js';

const MIN_LENGTH = 1;
const MAX_LENGTH = 12;

// Local state of this page (not shared, so it does not belong in the store).
let app = null;
let error = '';
let submitting = false;

function refresh() {
  if (app) app.refresh();
}

function showError(message) {
  error = message;
  refresh();
}

async function onSubmit(event) {
  event.preventDefault();
  if (submitting) return;

  const nickname = event.target.elements.nickname.value.trim();
  if (nickname.length < MIN_LENGTH || nickname.length > MAX_LENGTH) {
    showError(`Your nickname must be ${MIN_LENGTH} to ${MAX_LENGTH} characters long.`);
    return;
  }

  submitting = true;
  error = '';
  refresh();

  try {
    await send('join', { nickname });
  } catch (err) {
    submitting = false;
    showError((err && err.message) || 'Could not join the game. Please try again.');
    return;
  }

  submitting = false;
  // The store must hold the nickname before the route changes,
  // because #/lobby sends players without a nickname back to #/.
  setNickname(nickname);
  window.location.hash = '#/lobby';
}

function view() {
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
      h('p', { class: 'nickname-error', role: 'alert' }, error),
      h('button', { type: 'submit', disabled: submitting }, 'Join'),
    ]),
  ]);
}

/**
 * Shows the nickname page in #app. Called by the router for #/.
 *
 * @returns {{ unmount: Function }} Call unmount() when leaving the page.
 */
export function mountNickname() {
  error = '';
  submitting = false;
  app = createApp({
    root: document.getElementById('app'),
    store,
    select: (state) => state.nickname,
    view,
  });

  return {
    unmount() {
      if (app) app.unmount();
      app = null;
    },
  };
}
