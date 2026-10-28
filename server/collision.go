package main

import "math"

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

// NudgeToCorridor gently aligns a player with a corridor centre.
func (g *CollisionGrid) NudgeToCorridor(
	x, y, width, height, maxNudge float64,
	movingHorizontal bool,
) (float64, float64) {
	if g == nil || g.gameMap == nil || width <= 0 || height <= 0 || maxNudge < 0 {
		return x, y
	}

	if movingHorizontal {
		centerY := y + height/2
		targetY := math.Round(centerY-0.5) + 0.5 - height/2
		if math.Abs(targetY-y) <= maxNudge && g.CanOccupy(x, targetY, width, height) {
			return x, targetY
		}
		return x, y
	}

	centerX := x + width/2
	targetX := math.Round(centerX-0.5) + 0.5 - width/2
	if math.Abs(targetX-x) <= maxNudge && g.CanOccupy(targetX, y, width, height) {
		return targetX, y
	}

	return x, y
}
