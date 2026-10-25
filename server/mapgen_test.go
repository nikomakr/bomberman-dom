package main

import "testing"

func TestGenerateMapDimensions(t *testing.T) {
	m := GenerateMap(42)

	if m.Columns != 15 || m.Rows != 13 {
		t.Fatalf("expected 15x13 map, got %dx%d", m.Columns, m.Rows)
	}

	if len(m.Tiles) != m.Columns*m.Rows {
		t.Fatalf("expected %d tiles, got %d", m.Columns*m.Rows, len(m.Tiles))
	}
}

func TestGenerateMapDeterministic(t *testing.T) {
	first := GenerateMap(42)
	second := GenerateMap(42)

	for row := 0; row < first.Rows; row++ {
		for col := 0; col < first.Columns; col++ {
			if first.Tile(col, row) != second.Tile(col, row) {
				t.Fatalf("maps differ at column %d, row %d", col, row)
			}
		}
	}
}

func TestGenerateMapWalls(t *testing.T) {
	m := GenerateMap(42)

	for row := 0; row < m.Rows; row++ {
		for col := 0; col < m.Columns; col++ {
			isBorder := col == 0 || row == 0 ||
				col == m.Columns-1 || row == m.Rows-1
			isInternalWall := col%2 == 0 && row%2 == 0

			if (isBorder || isInternalWall) &&
				m.Tile(col, row) != TileWall {
				t.Errorf("expected wall at (%d, %d)", col, row)
			}
		}
	}
}

func TestGenerateMapSafeCorners(t *testing.T) {
	m := GenerateMap(42)

	safeCells := [][2]int{
		{1, 1}, {2, 1}, {1, 2},
		{m.Columns - 2, 1}, {m.Columns - 3, 1}, {m.Columns - 2, 2},
		{1, m.Rows - 2}, {2, m.Rows - 2}, {1, m.Rows - 3},
		{m.Columns - 2, m.Rows - 2},
		{m.Columns - 3, m.Rows - 2},
		{m.Columns - 2, m.Rows - 3},
	}

	for _, cell := range safeCells {
		if got := m.Tile(cell[0], cell[1]); got != TileEmpty {
			t.Errorf("expected empty safe cell at (%d, %d), got %q",
				cell[0], cell[1], got)
		}
	}
}

func TestGenerateMapTileBounds(t *testing.T) {
	m := GenerateMap(42)

	outOfBounds := [][2]int{
		{-1, 0}, {0, -1},
		{m.Columns, 0}, {0, m.Rows},
	}

	for _, cell := range outOfBounds {
		if got := m.Tile(cell[0], cell[1]); got != TileEmpty {
			t.Errorf("expected empty result for out-of-bounds (%d, %d), got %q",
				cell[0], cell[1], got)
		}
	}
}
