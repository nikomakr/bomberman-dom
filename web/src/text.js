// Counts and limits text the way players see it and the server checks it:
// one emoji or one Chinese character is one character, not two UTF-16 units.

/**
 * @param {string} text
 * @returns {number} How many characters (Unicode code points) the text has.
 */
export function countChars(text) {
  return [...text].length;
}

/**
 * Cuts an input's text to at most `max` characters, keeping the start. It
 * waits while an input method (for example Chinese) is still composing.
 *
 * @param {Event} event
 * @param {HTMLInputElement} input
 * @param {number} max
 * @returns {number} How many characters the input now has.
 */
export function limitChars(event, input, max) {
  const chars = [...input.value];
  if (chars.length > max && !event.isComposing) {
    input.value = chars.slice(0, max).join("");
    return max;
  }
  return chars.length;
}
