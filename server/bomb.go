package main

import (
	"log"
	"math"
	"sort"
	"time"
)

// Bombs belong to the match, so like everything else in a match they are
// only changed inside Run. A bomb sits on one cell, counts down its fuse
// once per tick, then explodes in four directions.

const (
	fuseTime   = 3 * time.Second
	fuseTicks  = int(fuseTime / tickInterval) // 60 ticks at 20 per second
	startBombs = 1                            // bombs a player can have on the map at once
	startRange = 1                            // cells a flame reaches in each direction
)

// directions are the four ways a flame travels: up, down, left and right.
var directions = []gridCell{{col: 0, row: -1}, {col: 0, row: 1}, {col: -1, row: 0}, {col: 1, row: 0}}

// bomb is one bomb on the map.
type bomb struct {
	id    int
	cell  gridCell
	owner *MatchPlayer
	reach int // cells the flame reaches in each direction
	fuse  int // ticks left before it explodes
}

// cellData is one map cell in a message.
type cellData struct {
	Col int `json:"col"`
	Row int `json:"row"`
}

// bombData tells clients a new bomb was placed.
type bombData struct {
	ID    int `json:"id"`
	Col   int `json:"col"`
	Row   int `json:"row"`
	Owner int `json:"owner"`
}

// explosionData tells clients a bomb exploded and which cells its flames hit.
type explosionData struct {
	Bomb  int        `json:"bomb"`
	Cells []cellData `json:"cells"`
}

// Bomb asks the match to place a bomb for a player. It never blocks.
func (m *Match) Bomb(client *Client) {
	select {
	case m.bombRequests <- client:
	default:
		log.Printf("bomb queue full, bomb dropped")
	}
}

// placeBomb puts a bomb on the cell under the centre of the player, if they
// still have a bomb to place and the cell is free.
func (m *Match) placeBomb(client *Client) {
	p := m.playerFor(client)
	if p == nil || p.Lives == 0 || p.bombsPlaced >= p.bombsMax {
		return
	}
	cell := gridCell{
		col: int(math.Floor(p.Position.X + playerSize/2)),
		row: int(math.Floor(p.Position.Y + playerSize/2)),
	}
	if !m.grid.PlaceBomb(cell.col, cell.row) {
		return // a wall, a block or another bomb is already there
	}

	m.nextBombID++
	b := &bomb{id: m.nextBombID, cell: cell, owner: p, reach: p.bombRange, fuse: fuseTicks}
	m.bombs[cell] = b
	p.bombsPlaced++
	m.newBombs = append(m.newBombs, bombData{ID: b.id, Col: cell.col, Row: cell.row, Owner: p.ID})
	log.Printf("%q placed bomb %d at (%d, %d)", p.Nickname, b.id, cell.col, cell.row)
}

// tickBombs counts every fuse down by one tick and explodes the bombs that
// reach zero, oldest first, so the result is the same on every run.
func (m *Match) tickBombs() {
	var due []*bomb
	for _, b := range m.bombs {
		b.fuse--
		if b.fuse <= 0 {
			due = append(due, b)
		}
	}
	sort.Slice(due, func(i, j int) bool { return due[i].id < due[j].id })
	for _, b := range due {
		m.explode(b)
	}
}

// explode sets off a bomb and any bombs its flames reach (a chain). Flames
// stop at walls, destroy the first block they reach and stop there, and
// stop at another bomb after setting it off.
func (m *Match) explode(first *bomb) {
	queue := []*bomb{first}
	for len(queue) > 0 {
		b := queue[0]
		queue = queue[1:]
		if m.bombs[b.cell] != b {
			continue // already exploded earlier in this chain
		}
		delete(m.bombs, b.cell)
		m.grid.RemoveBomb(b.cell.col, b.cell.row)
		b.owner.bombsPlaced--

		cells := []cellData{{Col: b.cell.col, Row: b.cell.row}}
		for _, dir := range directions {
			for step := 1; step <= b.reach; step++ {
				c := gridCell{col: b.cell.col + dir.col*step, row: b.cell.row + dir.row*step}
				tile := m.gameMap.Tile(c.col, c.row)
				if tile == TileWall {
					break
				}
				cells = append(cells, cellData{Col: c.col, Row: c.row})
				if tile == TileBlock {
					m.grid.DestroyBlock(c.col, c.row)
					m.destroyed = append(m.destroyed, cellData{Col: c.col, Row: c.row})
					break
				}
				if other, ok := m.bombs[c]; ok {
					queue = append(queue, other)
					break
				}
			}
		}
		m.explosions = append(m.explosions, explosionData{Bomb: b.id, Cells: cells})
		log.Printf("bomb %d exploded: %d cells", b.id, len(cells))
	}
}

// canMoveTo reports whether a player's box fits at (x, y). A player who is
// standing on a bomb, usually one they just placed, may still walk off it:
// bombs under the player's current box do not block them.
func (m *Match) canMoveTo(p *MatchPlayer, x, y float64) bool {
	if m.grid.CanOccupy(x, y, playerSize, playerSize) {
		return true
	}
	left, top, right, bottom := boxCells(x, y)
	for row := top; row <= bottom; row++ {
		for col := left; col <= right; col++ {
			if m.gameMap.Tile(col, row) != TileEmpty {
				return false
			}
			if _, isBomb := m.bombs[gridCell{col: col, row: row}]; isBomb && !covers(p.Position, col, row) {
				return false
			}
		}
	}
	return true
}

// boxCells returns the first and last column and row a player box at (x, y)
// covers, with the same edge rule as CanOccupy.
func boxCells(x, y float64) (left, top, right, bottom int) {
	const epsilon = 1e-9
	return int(math.Floor(x + epsilon)), int(math.Floor(y + epsilon)),
		int(math.Floor(x + playerSize - epsilon)), int(math.Floor(y + playerSize - epsilon))
}

// covers reports whether a player box at pos covers a cell.
func covers(pos Position, col, row int) bool {
	left, top, right, bottom := boxCells(pos.X, pos.Y)
	return col >= left && col <= right && row >= top && row <= bottom
}
