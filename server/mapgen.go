package main

import "math/rand"

const (
	mapColumns = 15
	mapRows    = 13

	blockProbability = 0.7
)

// TileType identifies the contents of a map cell.
type TileType string

const (
	TileEmpty TileType = "empty"
	TileWall  TileType = "wall"
	TileBlock TileType = "block"
)

// Map represents the game board.
type Map struct {
	Columns int        `json:"columns"`
	Rows    int        `json:"rows"`
	Tiles   []TileType `json:"tiles"`
}

// Tile returns the tile at the given column and row.
// Out-of-bounds coordinates are treated as walls.
func (m Map) Tile(col, row int) TileType {
	if col < 0 || col >= m.Columns || row < 0 || row >= m.Rows {
		return TileWall
	}

	return m.Tiles[row*m.Columns+col]
}

// GenerateMap creates a deterministic map from the supplied seed.
func GenerateMap(seed int64) Map {
	m := Map{
		Columns: mapColumns,
		Rows:    mapRows,
		Tiles:   make([]TileType, mapColumns*mapRows),
	}

	rng := rand.New(rand.NewSource(seed))

	// Initialise every cell as empty.
	for i := range m.Tiles {
		m.Tiles[i] = TileEmpty
	}

	// Create the border and fixed internal walls.
	for row := 0; row < m.Rows; row++ {
		for col := 0; col < m.Columns; col++ {
			if col == 0 || row == 0 ||
				col == m.Columns-1 || row == m.Rows-1 ||
				(col%2 == 0 && row%2 == 0) {
				m.Tiles[row*m.Columns+col] = TileWall
			}
		}
	}

	// Fill eligible cells with seeded random blocks.
	for row := 1; row < m.Rows-1; row++ {
		for col := 1; col < m.Columns-1; col++ {
			index := row*m.Columns + col

			if m.Tiles[index] == TileWall {
				continue
			}

			if isSafeCell(col, row, m.Columns, m.Rows) {
				continue
			}

			if rng.Float64() < blockProbability {
				m.Tiles[index] = TileBlock
			}
		}
	}

	return m
}

// isSafeCell reports whether a cell belongs to one of the four
// three-cell starting areas.
func isSafeCell(col, row, columns, rows int) bool {
	return (col == 1 && (row == 1 || row == 2)) ||
		(col == 2 && row == 1) ||
		(col == columns-2 && (row == 1 || row == 2)) ||
		(col == columns-3 && row == 1) ||
		(col == 1 && (row == rows-2 || row == rows-3)) ||
		(col == 2 && row == rows-2) ||
		(col == columns-2 && (row == rows-2 || row == rows-3)) ||
		(col == columns-3 && row == rows-2)
}
