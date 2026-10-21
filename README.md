# bomberman-dom

## Overview

A multiplayer Bomberman-style game for 2 to 4 players, built with our own mini-framework (no canvas, no WebGL, no other framework) and a Go server. Players join with a nickname, chat in real time over WebSockets, and battle until one of them is the last one standing.

## Project description

The project is a multiplayer version of the classic Bomberman game. It must be built with the mini-framework created in the earlier mini-framework project.

### Objectives

Build a Bomberman-style game in which several players join and battle until only one is left standing.

### Instructions

A match starts with up to 4 players, and only one can win. Each player starts in a different corner of the map.

The game follows the same principles as the make-your-game project, described below.

#### Features (from make-your-game)

The game must provide:

- At least 60 FPS at all times
- No frame drops
- Proper use of `requestAnimationFrame`
- Measured performance: JavaScript performance is hard to predict, so it must be measured to confirm the code is fast enough. This will be tested.
- A pause menu with:
  - Continue
  - Restart
- A scoreboard showing:
  - A countdown or timer: the time left until the game ends, or the time the game has been running
  - The score: the current score (experience or points)
  - Lives: the number of lives the player has left
- Minimal, but not zero, use of layers, to optimise rendering performance

No frameworks or canvas may be used; the game is built with plain JavaScript, the DOM and HTML only.

#### Animation and controls (from make-your-game)

Animation must move consistently. Smooth animation, without interruptions (known as jank), requires 60 FPS.

The game is played with the keyboard only, and the controls must be smooth: players never need to press a key repeatedly to act. While a key is held down, the action continues; when the key is released, the action stops. Movement triggered by a key must never jank or stutter.

The pause menu must allow players to pause, restart and continue the game at any time. Frames must not drop while the game is paused.

#### Learning outcomes (from make-your-game)

- `requestAnimationFrame`
- The event loop
- FPS
- The DOM
- Jank and stutter in animation
- `transform` and `opacity`
- Rendering tasks:
  - JavaScript
  - Styles
  - Layout
  - Painting
  - Compositing
- Developer tools:
  - Firefox
  - Chrome

#### Good practices

The project must respect the following good practices.

**Code**

- Commenting and documentation
- Consistent indentation
- Avoiding obvious comments
- Code grouping
- A consistent naming scheme:
  - camelCase
  - under_scores
- DRY (Don't Repeat Yourself), also known as DIE (Duplication Is Evil)
- KISS (Keep It Simple)
- YAGNI (You Aren't Gonna Need It)
- Separation of concerns
- Avoiding deep nesting
- Error handling
- Limited line length
- File and folder organisation
- Consistent temporary names
- Separation of code and data
- Code refactoring

**Go**

- Go conventions
- `gofmt`
- `goimports`
- `goimports` compared with `gofmt`

**CSS**

- CSS best practices

**Dockerfile**

- Dockerfile best practices

**Time limit**

- Every program must finish running within 5 minutes.

#### Game performance

Performance is essential. Each frame must take less than 16.7 ms (1000 ms / 60 frames), because both the browser's work and the game's work must fit into every frame.

- `requestAnimationFrame` is used to synchronise changes with the browser.
- Memory is reused where possible, to avoid jank when the garbage collector runs.

Jank is caused by too much work in a frame, for instance:

- JavaScript
- Styles: working out which styles apply to which elements
- Layout: calculating the geometry of the page (for example, recalculating widths and heights)
- Painting: usually needed after layout, and again every time an element animates
- Compositing: putting the layers of the page together at the end

The most costly of these are layout and painting, so they must be avoided. The best way to do this is to use `transform` and `opacity`.

Layout can be avoided with `transform`:

```js
// Avoid: triggers layout and a repaint
box.style.left = `${x * 100}px`

// Prefer: no layout
box.style.transform = `translateX(${x * 100}px)`
```

Painting can be avoided by promoting an element to its own layer:

```css
/* Promotes the element to its own layer, so moving it does not repaint */
#box {
  width: 100px;
  height: 100px;
  /* ... */
  will-change: transform;
}
```

A new layer removes painting, but there is always a trade-off: too many layers increase compositing work and the size of the layer tree. A layer should only be promoted when it is known to be needed. Performance is the key to good animation: "performance is the art of avoiding work".

#### UI and UX

- Follow user interface and user experience best practices.

### Performance, framework and chat

As in make-your-game, performance is one of the most important aspects of the game. The game must:

- Run at 60 FPS or more at all times
- Never drop frames
- Use `requestAnimationFrame` properly
- Have its performance measured, to confirm the code is fast enough

Canvas, WebGL and other frameworks are not allowed. The game is built with the framework from the mini-framework project.

The game includes a chat that lets players talk to each other, built with WebSockets. The chat is the first step of the multiplayer feature.

### Game mechanics

1. **Players**
   - Number of players: 2 to 4
   - Each player has 3 lives. A player who loses all 3 is out.
2. **Map**
   - The map is fixed, so every player sees the whole map at once.
   - There are two kinds of obstacle: blocks, which can be destroyed, and walls, which cannot.
     - Walls are always in the same place; blocks are placed at random on the map. The optional different-maps project is useful here (see below).
     - Players must be able to survive at their starting positions: for example, a player who places a bomb must have room to escape the explosion.
   - Players start in the corners of the map.
3. **Power-ups:** each time a player destroys a block, a random power-up may appear:
   - **Bombs:** increases the number of bombs a player can drop at a time by 1
   - **Flames:** increases the explosion range of the bomb by 1 block in all four directions
   - **Speed:** increases movement speed

#### Optional project: different maps

**Objectives**

This optional project follows the same principles as make-your-game, and requires:

- A tileset used to generate tile maps
- Our own engine to generate tile maps (tile editors are not allowed)
- At least 3 different tile maps
- Each map different from the others

**Instructions**

To store tile images efficiently, all tiles are grouped in a single image (the tileset). Each tile is drawn by selecting its section of that image. This improves both performance and memory use.

Scrolling tile maps can be costly to render, so they need special care. One of the best approaches is to render only the tiles visible to the player, using `opacity` or other methods, although this is sometimes not enough.

A tile map can be represented as a logical grid, which helps with both the display and the game logic. An example tile map data structure:

```js
const map = {
  columns: 5,
  rows: 5,
  size: 25,
  tiles: [
    1, 3, 3, 3, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 3, 1, 1, 1,
    1, 3, 1, 2, 1,
  ],
  getTile(col, row) {
    return this.tiles[row * this.columns + col];
  },
};
```

This map object contains:

- `columns`: the number of columns in the grid
- `rows`: the number of rows in the grid
- `size`: the size of the map
- `tiles`: the array holding the grid
- `getTile`: a function that returns the tile at a given position

This is only an example; properties can be added to suit the game.

Learning outcomes:

- Tile maps
- Image manipulation
- Rendering

### Joining a game

When a player opens the game, they are asked for a nickname, which tells players apart. After choosing a nickname, the player is taken to a waiting page with a player counter that goes up to 4. Each time a player joins, the counter increases by 1.

If at least 2 players are waiting and the counter does not reach 4 within 20 seconds, a 10-second countdown starts so players can get ready, and then the game starts. If the counter reaches 4 within 20 seconds, the 10-second countdown starts straight away, and then the game starts.

### Bonus

The following optional features can make the game even better:

- **Solo and co-op mode:** an AI opponent plays against the players. When the AI is defeated, every player involved wins.
- **More power-ups:**
  - **Bomb Push:** throw a bomb after it has been placed
  - **Bomb Pass:** walk through bombs
  - **Block Pass:** walk through blocks (not walls)
  - **Detonator:** choose when a bomb explodes, with a key press
  - **1 Up:** gain an extra life
- **Power-ups released on death:** when a player dies, they drop one of their power-ups. A player with no power-ups drops a random one.
- **Team mode:** 2 versus 2 matches.
- **After-death interaction:** a player who dies comes back as a ghost. A ghost that touches another player comes back to life. A ghost caught in a bomb explosion dies permanently.

### Learning outcomes

- `requestAnimationFrame`
- The event loop
- FPS
- Animation performance and frame rate
- WebSockets
- Synchronisation
- Developer tools:
  - Firefox
  - Chrome

## Using the mini-framework

## Architecture

## How to run

## How to play

## Game engine and performance

## Map, tiles and design

## Testing

## Team

| Name | Gitea | Role | Skills |
|---|---|---|---|
| Niko | nmakridi | Server Network Engineer | Back-End, Full-Stack, code review |
| Sabri | ssuleiman | Client Network Engineer | Front-End, Network |
| Claudia | cwidger | Frontend & QA Engineer | Front-End, QA |
| Amal | aosman | Game System Designer | UI/UX, Systems |