// Player colours. The server gives players these colours in join order, so
// the lobby, the chat and the scoreboard can show the same colour before and
// during the match.

export const PLAYER_COLOURS = ["red", "blue", "green", "yellow"];

/**
 * @param {{ colour?: string }} player
 * @param {number} index - The player's place in join order.
 * @returns {string} The player's colour name.
 */
export function playerColour(player, index) {
  return player.colour || PLAYER_COLOURS[index];
}
