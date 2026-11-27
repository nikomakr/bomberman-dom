# Functional

## Inspect the game source code

## Was the mini-framework the only technology/framework used to develop the project? Any other framework or technology such as canvas or Web-GL are not allowed

Yes. The client is plain JavaScript on our own mini-framework (`web/framework/`): no canvas, no WebGL, no npm packages, and not even `addEventListener` (events are attached through the framework's `on:` props). The server is Go with `gorilla/websocket`, used only on the back end.

Compliance can be checked by running our script checker:

```bash
./scripts/check.sh
```

It scans every `.js` file in `web/src/` for `addEventListener`, `innerHTML`, `<canvas`, `getContext(`, `.style.left/top` and imports from packages or URLs. `web/framework/` is not scanned: it is the mini-framework itself, our own code, and the one place allowed to touch the DOM directly.

## Try to open the game. Were you asked for a nickname?

Yes.
`#/` renders `Nickname()` (`web/src/views/Nickname.js:60`). On submit, `onSubmit()` (`Nickname.js:35`) checks the length (1 to 12 characters) and sends a `join` message over the WebSocket. The server checks it again in `Lobby.join()` (`server/lobby.go:201`) and answers with an `error` if the name is empty, too long or already taken (case-insensitive), the lobby is full, or the game has already started.

## After entering your nickname, were you redirected to a waiting page presenting a player counter?

Yes.
On a valid join, the server adds the player and sends the `lobby` message with the player list to every player (`sendLobby()`, `server/lobby.go:380`). On the client, `web/src/net/socket.js` passes it to `setPlayers()` (`web/src/store.js:36`). A store subscription in `Nickname.js:15` sees the pending nickname in the list, saves it with `setNickname()`, and moves the URL from `#/` to `#/lobby`. The `/lobby` route (`web/src/main.js:52`) only lets in a player who has a nickname, then renders `Lobby()` (`web/src/views/Lobby.js:29`), which shows the counter `n / 4`, the players' names and the timer.

## After entering your nickname, did you have access to a chat?

Yes.
As the page loads, `connect()` (`web/src/net/socket.js:100`) opens the WebSocket to `/ws`, and `serveWS()` (`server/main.go:24`) registers the browser in the hub. A connection alone cannot chat: `Lobby.chat()` (`server/chat.go:35`) rejects anyone who has not joined ("join the game before chatting"). Once the nickname is accepted, the `#chat` app (`web/src/main.js:94`) renders `Chat()` (`web/src/views/Chat.js:69`) on the lobby and game pages.

## Try to enter with another user (in another browser or in private browser). Did the player counter increment by 1?

Yes.
Each successful `join()` adds the player and calls `sendLobby()`, which sends the updated list to every player in the lobby, and each `Lobby` view re-renders `players.length / 4`. Leaving works the same way in reverse (`leave()`, `server/lobby.go:228`).

## After entering with another user, can all users chat with each other in real time (using websockets)?

Yes.
Every chat message goes through the server's single `Lobby.Run()` loop (`server/lobby.go:166`), one event at a time, so all players receive messages in the same order and a message never races with a join or a leave. `chat()` trims the text, cuts it to 200 characters, adds the sender's nickname and a server timestamp, and sends it to every player. The client adds it with `addMessage()` (`web/src/store.js:56`), which keeps only the newest 50 messages (`MAX_MESSAGES`), so a long match does not keep growing the page.
The history lives only in the page's in-memory store: the server keeps no messages and nothing is saved to `localStorage` or `sessionStorage`. A refresh therefore clears it, and a player who joins later does not see earlier messages.

## Wait 20 seconds with two users in the waiting page. After 20 seconds, did you get 10 second game start countdown?

Yes.
The lobby is a small state machine with four phases (`server/lobby.go:11`): `waiting` → `wait` → `countdown` → `started`.

1. When a join brings the count to 2, `updatePhase()` (`server/lobby.go:253`) switches to `wait` with 20 ticks (`DefaultLobbyConfig()`, `server/lobby.go:50`).
2. `setPhase()` (`server/lobby.go:282`) starts a one-second `time.Ticker`. On each tick, `onTick()` (`server/lobby.go:268`) takes one off `secondsLeft` and sends a `countdown` message to every player.
3. At 0, `wait` becomes `countdown` with 10 ticks.

The client shows "Waiting for players: n", then "Game starts in: n" (`countdownText()`, `web/src/views/Lobby.js:14`). A third player joining does not restart the 20 seconds. If fewer than 2 players remain, the lobby goes back to `waiting` and the timer stops. Ticks are handled inside `Lobby.Run()` like every other event, so the lobby needs no locks.

## After the 10 seconds did the game start?

Yes.
When the countdown reaches 0, `onTick()` calls `start()` (`server/lobby.go:294`):

1. It stops the ticker and sets the phase to `started`, so any later join gets "the game has already started".
2. It hands the players, in join order, to `NewMatch()` (`server/game.go:151`), which builds a new map with `GenerateMap(seed)` (`server/mapgen.go`) and puts each player in a corner with 3 lives.
3. It runs the match in its own goroutine: `Match.Run()` (`server/game.go:225`) sends `start` with the map and the players, then steps the game 20 times a second (`tickRate`).

On the client, the `start` handler (`web/src/net/socket.js:42`) calls `startMatch()` and `startGame()` and moves the URL from `#/lobby` to `#/game`. The board's `onMount` then starts the `requestAnimationFrame` loop (`startLoop()`, `web/src/game/loop.js:43`).

## Try to enter with 4 different users in the waiting page. As soon as the fourth player entered, did you get 10 second game start countdown?

Yes.
`updatePhase()` (`server/lobby.go:253`) checks `count == maxPlayers && phase != countdown` before anything else. As soon as the fourth player joins, the lobby skips whatever is left of the 20-second `wait` and goes straight to the 10-second `countdown`, even if `wait` had not started yet. Once the countdown runs, joins and leaves do not restart it unless fewer than 2 players remain, and a fifth player gets "the game is full".

## While playing the game, are you able to move and place bombs?

Yes.
Controls: arrow keys move, Space places a bomb, E fires the Detonator power-up, Esc pauses.

- **Listeners:** the game code never calls `addEventListener`. `startInput()` (`web/src/game/input.js:79`) uses the framework's `createKeyState()` and `onGlobal('keydown')` (`web/framework/events.js`), which track held keys through one delegated handler at the root.
- **Movement:** `readInput()` (`web/src/game/input.js:91`) runs every frame, packs the four arrows into a bitmask and sends an `input` message only when the held set changes: holding a key sends one message, releasing it sends another. Each input carries a `seq` number, so the server ignores stale ones (`applyInput()`, `server/game.go:259`).
- **Server:** it is authoritative. Every 50 ms, `step()` (`server/game.go:361`) moves each player by `speed × 0.05` tiles, sliding along walls, with collisions in `server/collision.go`.
- **Client:** `web/src/game/prediction.js` moves your own player straight away using the same rules, then reconciles with the server's position. Other players are interpolated between server updates (`web/src/game/players.js`).
- **Bombs:** Space sends `bomb` once per press (`!event.repeat`), and `placeBomb()` (`server/bomb.go:92`) checks the player's bomb limit and that the cell is free.

To watch it live: DevTools → Network → filter **WS** → click the `ws` request → **Messages**. You will see outgoing `input`, `bomb` and `chat` messages, and incoming `state` messages about 20 times a second while something changes.

## Can players see the whole map at once?

Yes.
The whole 15 × 13 map is always on screen, at any window size, without scrolling.

The tile size is one CSS variable, `--tile` (`web/styles/main.css`). It is the smallest of three values: a 56px cap, the width available divided by 15, and the height available divided by 13. Everything stacked with the map has a fixed height (`--hud-height`, `--pause-bar-height`, the page padding and gaps), so the "height available" is exact rather than guessed. On wide screens the chat sits beside the map, so its column is subtracted from the width. The `.tiles` grid then sizes every tile from `var(--tile)`, and the board needs no JavaScript to resize.

The scoreboard is kept small so the map keeps the space. `Hud()` (`web/src/views/Hud.js`) is one thin line that never wraps: the time, then each player as `name ♥lives ★score` in their colour. A player with no lives left, whether they lost them or left the match, turns grey with their name struck through. Long nicknames are cut with an ellipsis. On windows under 600px wide or high, the frame and the scoreboard get thinner. When the scoreboard itself is under 480px wide (a CSS container query, so a short window that shrinks the map counts too), the names are hidden and each player is shown by colour only, with the full entry in the tooltip and the `aria-label`s.

Checked at 1920×1000, 1440×860, 1180×700, 900×600, 390×760, 360×640 and 740×360: the map, the scoreboard and the pause bar always fit on screen, with no horizontal scroll. Phones can show the game, but it is played with the keyboard only.

## Try placing a bomb and standing by it when it explodes. Did you lose 1 of your 3 lives?

Yes.

- **Fuse:** `placeBomb()` (`server/bomb.go:92`) gives the bomb a 3-second fuse (`fuseTicks`, 60 ticks), and `tickBombs()` (`server/bomb.go:112`) counts it down once per server tick.
- **Explosion:** at 0, `explode()` (`server/bomb.go:129`) sends flames out in four directions, as far as the bomb's range (1 cell at the start). Flames stop at walls and at the first block they reach.
- **Flames:** `lightFlames()` (`server/damage.go:37`) leaves a flame on every cell hit, for 0.5 seconds (`flameTicks`).
- **Damage:** every tick, `burnPlayers()` (`server/damage.go:44`) checks the cell under the centre of each player (`centreCell()`, `server/damage.go:80`). A player standing in a flame loses one life, then cannot be hurt for 2 seconds (`safeTicks`), so one explosion never takes all three lives.
- **HUD:** the new lives count reaches the client in the next `state` message. `updatePlayers()` (`web/src/game/players.js:105`) writes it to the store, and the scoreboard shows ♥2.

## Try to lose all your 3 lives. Did you lose the game and are not able to play anymore?

Yes.

1. When `Lives` reaches 0, `burnPlayers()` logs that the player is out and leaves a power-up where they died (`dropOnDeath()`, `server/powerup.go:89`).
2. `step()` (`server/game.go:361`) then calls `checkForWinner()` (`server/game.go:286`). If one player or none is left, `finish()` (`server/game.go:335`) sends `end` and the match is over.
3. Until then, the server shuts the player out: `applyInput()` (`server/game.go:259`) ignores their input, `placeBomb()` refuses their bombs, and `step()` no longer moves them.
4. On their screen, `updatePlayers()` sees `lives === 0`: it stops prediction, calls `setOut()`, removes their sprite, and `web/src/main.js:78` shows "You are out. Watch the rest of the match."
5. They cannot pause or restart (`togglePause()`, `web/src/game/input.js:58`). Their scoreboard entry turns grey, and they keep watching until `end` takes everyone to `#/over`, where their row is grey with a ☠.

Leaving the match (closing the tab or a hard refresh) counts the same as losing every life: `removePlayer()` (`server/game.go:270`).

## Try placing a bomb next to another player. Did the other player lose a life when the bomb exploded?

Yes.
It is the same `burnPlayers()` check (`server/damage.go:44`), run every tick for every player still in, whoever owns the flame. Each flame remembers whose bomb lit it (`flame.owner`, `server/damage.go:23`). When the player hit is not the owner, the owner scores `pointsHit` (100 points). The 2-second safe window applies to everyone, so a chain of bombs cannot empty a player in one go.

## Place a bomb next to a destroyable block. Did the block disappear when the bomb exploded?

Yes.

1. **Server:** `explode()` (`server/bomb.go:129`) turns the block into floor (`grid.DestroyBlock()`), adds the cell to `m.destroyed`, gives the bomb's owner 10 points, then may drop a power-up there (`dropPowerUps()`).
2. **One message:** every block broken in that tick, including a whole chain of bombs, goes out together in one `state` message (`destroyed: [...]`).
3. **One store update:** `applyEntityChanges()` (`web/src/game/effects.js:12`) calls `destroyBlocks()` (`web/src/store.js:152`) once for all those cells.
4. **One render:** the framework queues the re-render on `requestAnimationFrame` (`scheduleRender()`, `web/framework/scheduler.js:44`), so the board is redrawn at most once per frame.
5. **Smallest DOM change:** tiles are keyed by index, so the diff only changes the `class` of the cells that changed (`tile-block` → `tile-floor`). No element is created or removed.

Why this keeps paint and layers low:

- **No layout:** a tile never changes size, only which part of the tileset it shows (`background-position`). The browser repaints a few tile-sized squares and does no layout.
- **No new layers:** the tiles are one flat grid with no `will-change`, so a broken block never adds a layer. Moving things (players, bombs, flames, power-ups) live in the separate `.entities` layer and move with `transform: translate3d`. They are pooled: elements are reused and hidden with `visibility`, never created mid-game (`web/src/game/entities.js`).

This can still cost a frame when many crates break at once; see the Performance section.

## Try to destroy every block on the map. Did the power ups appear in place of some of the blocks?

Yes.

- **The roll:** at the end of each explosion, `explode()` (`server/bomb.go:170`) passes every block it broke to `dropPowerUps()` (`server/powerup.go:62`). For each of those cells, the match's random number generator rolls `rng.Float64()`. Below `dropChance` (0.3, so about one block in three) a power-up appears there, and `randomKind()` (`server/powerup.go:72`) picks one of the 5 kinds, each equally likely.
- **Seeded randomness:** each match has its own generator, seeded when the match starts (`newMatchRand()`, `server/powerup.go:134`). Drops differ from match to match but can be repeated in tests.
- **Telling the clients:** `placePowerUp()` (`server/powerup.go:78`) puts it on the map and adds it to the next `state` message (`powerUps: [...]`). On the client, `updatePowerUps()` (`web/src/game/powerUps.js:16`) shows it with a pooled element and the sprite for its kind (`tile-power-<kind>`), pulsing with an opacity-only animation.
- **Rules:**
  - Drops are placed after the explosion's own flames, so a new power-up is never burnt by the bomb that uncovered it.
  - A later flame destroys a power-up nobody has collected (`burnPowerUp()`, `server/powerup.go:103`).
  - Walking over one collects it for 50 points (`collectPowerUps()`, `server/powerup.go:114`).
- **End of match:** once every block is gone and no power-up, bomb or flame is left, the match ends and the highest score among the players still in wins (`boardCleared()` and `endByScore()`, `server/game.go`).

## Can you confirm that there are at least 3 types of power ups?

Yes, 5 kinds.
They are defined as data in `server/powerup.go`: the kinds at lines 20 to 29, and what each one does in a single table, `powerUpEffects` (`server/powerup.go:33`). Adding a power-up means adding one kind and one entry in that table.

| Kind | Effect | |
|---|---|---|
| `bomb` (Bombs) | +1 bomb on the map at once | required |
| `flame` (Flames) | +1 cell of explosion range in every direction | required |
| `speed` (Speed) | +1 tile per second, up to 8 | required |
| `life` (1 Up) | +1 life, up to 5 | bonus |
| `detonator` (Detonator) | press E to explode your own bombs early | bonus |

Each kind has its own sprite (`.tile-power-*` in `web/styles/main.css`). Speed also reaches the client's own prediction through `setSpeed()`, so faster movement stays smooth.

## Open the Dev Tool in the Performance tab. Does the game run without frame drops?

Yes.

**How the game is built for 60 FPS:**

- **One loop:** a single `requestAnimationFrame` loop (`createLoop()`, `web/framework/scheduler.js:67`, run by `web/src/game/loop.js`) reads the keys, predicts your own movement, interpolates the other players, and moves only the elements whose position changed (`updateEntities()`, `web/src/game/entities.js`).
- **Transform only:** movement uses `transform`, never `top`/`left`, so moving things needs no layout.
- **No re-render for movement:** positions arrive 20 times a second but never go through the store.
- **Batched re-renders:** rare changes (lives, score, blocks) re-render at most once per frame (`scheduleRender()`, `web/framework/scheduler.js:44`).
- **Pools:** bombs, flames, power-ups and players are reused from element pools (`web/src/game/entities.js`), so no elements are created mid-game and garbage collection causes no stutter.
- **Pause:** the loop keeps running while paused, so no frames drop then either.

**Measured** on an Apple M1 in Chrome, one game window plus three other players:

| Situation | Average | Slowest frame | Frames over 20 ms |
|---|---|---|---|
| Idle | 60 FPS | 17.8 ms | 0 |
| Hit by a bomb | 60 FPS | 17.8 ms | 0 |
| 3 crates break and 2 power-ups appear at once | 60 FPS | 17.7 ms | 0 |
| A player leaves mid-match | 60 FPS | 17.7 ms | 0 |
| Losing the last life ("You are out") | 60 FPS | 17.7 ms | 0 |
| Moving, then standing still | 60 FPS | 17.7 ms | 0 |

Chrome reported no Long Animation Frames. The work each update causes is small next to the 16.7 ms frame budget: a crate breaking and the board re-rendering takes 0.3 ms, a scoreboard update 0.1 ms.

**How to test it fairly:**

- Give each player their own computer, or keep only the window being measured visible. Several game windows on one machine compete for the same CPU and GPU, and that shows up as frame drops in all of them.
- In DevTools → Performance, untick **Screenshots** (taking them costs frames), record while playing, and read the **Frames** track.
- Grey "idle" frames are not drops. When nothing on screen changes, Chrome draws no new frame, which is also why an FPS meter dips while every player stands still.

## Open the Dev Tool in the Performance tab. Does the game run at or around 60fps?

Yes.
See the previous answer: 60 FPS in every situation measured, with the slowest frame at 17.8 ms.

## Open the Dev Tool in the performance tab and select the option rendering with the paint ON. Is paint used as little as possible?

Yes.

**How to test:** DevTools → `Cmd+Shift+P` (`Ctrl+Shift+P` on Windows and Linux) → "Show Rendering" → tick **Paint flashing**. Green rectangles flash wherever the browser repaints pixels.

**What "as little as possible" means:** only small areas flash, and only when something changed.

- **Should flash:** the tile of a crate that breaks (a block becomes floor), the scoreboard when the timer or a score changes, and the chat when a message arrives.
- **Should not flash:**
  - the whole board every frame, or the area around a player as they walk: players move by `transform` on their own layer, so the GPU moves them without repainting
  - bombs and power-ups as they pulse: they animate `opacity` only, which the GPU also handles without repainting.

## Open the Dev Tool in the performance tab and select the option rendering with the layer ON. Are layers used as little as possible?

Yes.

**How to test:** in the same Rendering panel, tick **Layer borders**: orange outlines mark compositor layers. For the full list, with the reason Chrome gives for each layer, open DevTools → More tools → **Layers**.

**What to expect:**

- the page itself
- one layer per player sprite (`will-change: transform`, `web/styles/main.css`)
- bombs and power-ups, each only while its opacity pulse runs.

The 195 tiles share one layer, and flames, which never move, get no layer of their own. Entities are placed with a 2D `translate(...)` (`updateEntities()`, `web/src/game/entities.js`), not `translate3d`, so being positioned never promotes an element by itself.

## Are layers being promoted properly?

Yes.
"Promoted" means Chrome gives an element its own GPU layer, so it can be moved or faded without repainting anything. "Properly" means two things: what moves or animates every frame is promoted, so it never repaints, and nothing static is promoted, because each layer costs memory and compositing time.

- **Promoted:** the players, which move every frame (`will-change: transform` on `.entity[class*="tile-player-"]`, `web/styles/main.css`), and bombs and power-ups while their pulse animation runs (Chrome promotes elements with a running `opacity` animation).
- **Not promoted:** tiles, flames, the scoreboard, the chat and hidden pooled elements.

Check it in the **Layers** panel: the compositing reasons should be "will-change: transform" for players and "active opacity animation" for bombs and power-ups.

# Bonus

## +Is there a Solo + Co-Op mode in the game as described in the subject?

Not implemented.

## +Are 2 or more extra power ups, as described in the subject's bonus section, implemented?

Yes: 1 Up and Detonator, two of the five the subject lists.

- **1 Up:** `powerUpLife` adds a life, up to 5 (`p.Lives = min(p.Lives+1, maxLives)`, `server/powerup.go:37`).
- **Detonator:**
  - Collecting it sets `p.detonator = true` (`server/powerup.go:38`). The flag is sent in `state`, and the bar under the map then shows an **E Detonate** hint (`web/src/views/PauseBar.js`).
  - Pressing E (`web/src/game/input.js:45`) sends `detonate`.
  - `detonate()` (`server/bomb.go:73`) sets the fuse of each of that player's bombs to 1. They go off on the next tick through the normal `explode()`, so chains, damage and drops all still apply.

Both drop from blocks like the three base kinds, with the same one-in-five chance each.

## +When a player dies, is a random power up release as described in the subject's bonus section?

Yes, exactly as the subject's bonus section describes it: "when a player dies, they drop one of their power-ups. A player with no power-ups drops a random one."

- **What is dropped:** `dropOnDeath()` (`server/powerup.go:89`) leaves a power-up on the cell where the player went out.
  - Every power-up a player collects in the match is remembered in `p.powerUps`.
  - A player who collected some drops one of them, chosen at random.
  - A player who collected none drops a random kind (`randomKind()`, any of the 5, each equally likely).
  - So the drop is always random: among the player's own power-ups when they have any, among all kinds when they do not.
- **When:**
  - **Dying:** `burnPlayers()` (`server/damage.go:44`) calls `dropOnDeath()` the moment a flame takes a player's last life.
  - **Leaving:** a player who leaves mid-match (closing the tab or a hard refresh) is out for good, so `removePlayer()` (`server/game.go:270`) treats it as dying and calls `dropOnDeath()` too. A player who was already out does not drop a second one.
- **Edge case:** if the cell already holds a power-up, that one stays and nothing is added.
- **On screen:** the drop goes through the same `placePowerUp()` as block drops, so it appears on every screen in the next `state` message.

Tests in `server/powerup_test.go` cover each case: a collected power-up is dropped, a random one is dropped when there is none, leaving drops one, and losing a life that is not the last drops nothing.

## +Is there a team mode implemented?

Not implemented.

## +Can the player interact with the game after death as described in the subject's bonus section?

Not implemented.

## +Do you think in general this project is well done?

Yes.

- **Authoritative server:** the Go server alone decides positions, bombs, lives and the winner, so clients cannot cheat or drift apart. Each lobby and match handles one event at a time in a single loop, so the game state needs no locks.
- **Our own framework only:** the client is built entirely on the mini-framework from the earlier project. No canvas, WebGL or outside libraries are used, and `scripts/check.sh` enforces it.
- **Smooth play:** your own player moves immediately through client-side prediction, other players are interpolated between server updates, and pooled elements moved by `transform` keep the game at 60 FPS.
- **Fits any screen:** the map always fits the window, with a compact scoreboard.
- **Handles real situations:** players leaving mid-match, reconnecting, pause/continue/restart for everyone, and a clear winner even when the board is cleared.
- **Easy to extend:** power-ups are data (one table entry each), messages are listed in one place, and the map generator takes a seed.
- **Tested:** Go tests cover the lobby timing, movement and collisions, bombs and damage, power-ups and drops, pause, and the end of a match (`server/*_test.go`).
