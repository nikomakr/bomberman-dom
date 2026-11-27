package main

import "math"

// Collision checks: which cells and player positions are free of walls, blocks and bombs.

// CollisionGrid tracks the map and bomb positions for collision checks.
type CollisionGrid struct {
	gameMap *Map
	bombs   map[gridCell]struct{}
}

type gridCell struct {
	col int
	row int
}

// NewCollisionGrid creates a collision grid for a map.
func NewCollisionGrid(gameMap *Map) *CollisionGrid {
	return &CollisionGrid{
		gameMap: gameMap,
		bombs:   make(map[gridCell]struct{}),
	}
}

// CanEnter reports whether a cell is free of walls, blocks and bombs.
func (g *CollisionGrid) CanEnter(col, row int) bool {
	if g == nil || g.gameMap == nil {
		return false
	}

	if g.gameMap.Tile(col, row) != TileEmpty {
		return false
	}

	_, hasBomb := g.bombs[gridCell{col: col, row: row}]
	return !hasBomb
}

// PlaceBomb marks an empty cell as occupied by a bomb.
func (g *CollisionGrid) PlaceBomb(col, row int) bool {
	if !g.CanEnter(col, row) {
		return false
	}

	g.bombs[gridCell{col: col, row: row}] = struct{}{}
	return true
}

// RemoveBomb removes a bomb from a cell.
// It returns false if no bomb was present.
func (g *CollisionGrid) RemoveBomb(col, row int) bool {
	if g == nil {
		return false
	}

	cell := gridCell{col: col, row: row}
	if _, exists := g.bombs[cell]; !exists {
		return false
	}

	delete(g.bombs, cell)
	return true
}

// DestroyBlock removes a block from the map.
// It returns false if the cell does not contain a block.
func (g *CollisionGrid) DestroyBlock(col, row int) bool {
	if g == nil || g.gameMap == nil {
		return false
	}

	if g.gameMap.Tile(col, row) != TileBlock {
		return false
	}

	g.gameMap.Tiles[row*g.gameMap.Columns+col] = TileEmpty
	return true
}

// CanOccupy reports whether a rectangular player box can occupy the
// requested position. Coordinates and dimensions are measured in tile units.
func (g *CollisionGrid) CanOccupy(x, y, width, height float64) bool {
	if g == nil || g.gameMap == nil ||
		width <= 0 || height <= 0 ||
		math.IsNaN(x) || math.IsNaN(y) ||
		math.IsNaN(width) || math.IsNaN(height) ||
		math.IsInf(x, 0) || math.IsInf(y, 0) ||
		math.IsInf(width, 0) || math.IsInf(height, 0) {
		return false
	}

	const epsilon = 1e-9

	left := int(math.Floor(x + epsilon))
	top := int(math.Floor(y + epsilon))
	right := int(math.Floor(x + width - epsilon))
	bottom := int(math.Floor(y + height - epsilon))

	for row := top; row <= bottom; row++ {
		for col := left; col <= right; col++ {
			if !g.CanEnter(col, row) {
				return false
			}
		}
	}

	return true
}

// NudgeToCorridor tells a player who is blocked where to slide so they can
// keep going: to the centre of one of the lanes their box overlaps (rows when
// moving left or right, columns when moving up or down) whose next cell in the
// direction of travel is free. The nearer lane is tried first, so a player
// pressing right at a corner turns into the corridor that is open, not the one
// that happens to be closer. dir is -1 or 1 along the axis of travel; with 0
// the cell ahead is not checked. The position comes back unchanged if no lane
// within maxNudge is open.
func (g *CollisionGrid) NudgeToCorridor(
	x, y, width, height, maxNudge float64,
	movingHorizontal bool, dir float64,
) (float64, float64) {
	if g == nil || g.gameMap == nil || width <= 0 || height <= 0 || maxNudge < 0 {
		return x, y
	}

	const epsilon = 1e-9

	// along is the axis of travel, across the axis the player slides on.
	along, across, length, breadth := x, y, width, height
	if !movingHorizontal {
		along, across, length, breadth = y, x, height, width
	}

	offset := (1 - breadth) / 2 // a lane centre, measured from the lane's edge
	first := int(math.Floor(across + epsilon))
	last := int(math.Floor(across + breadth - epsilon))
	lanes := [2]int{first, last}
	if math.Abs(float64(last)+offset-across) < math.Abs(float64(first)+offset-across) {
		lanes = [2]int{last, first}
	}

	ahead := int(math.Floor(along+length-epsilon)) + 1
	if dir < 0 {
		ahead = int(math.Floor(along+epsilon)) - 1
	}

	for _, lane := range lanes {
		target := float64(lane) + offset
		if math.Abs(target-across) > maxNudge+epsilon {
			continue
		}
		if movingHorizontal {
			if g.CanOccupy(x, target, width, height) && (dir == 0 || g.CanEnter(ahead, lane)) {
				return x, target
			}
		} else if g.CanOccupy(target, y, width, height) && (dir == 0 || g.CanEnter(lane, ahead)) {
			return target, y
		}
	}

	return x, y
}
