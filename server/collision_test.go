package main

import (
	"math"
	"testing"
)

func TestCollisionGridCanEnter(t *testing.T) {
	gameMap := &Map{
		Columns: 3,
		Rows:    3,
		Tiles: []TileType{
			TileWall, TileEmpty, TileBlock,
			TileEmpty, TileEmpty, TileEmpty,
			TileEmpty, TileWall, TileEmpty,
		},
	}

	grid := NewCollisionGrid(gameMap)

	tests := []struct {
		name string
		col  int
		row  int
		want bool
	}{
		{"empty cell", 1, 0, true},
		{"wall", 0, 0, false},
		{"block", 2, 0, false},
		{"out of bounds", -1, 0, false},
		{"past right edge", 3, 1, false},
		{"past bottom edge", 1, 3, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := grid.CanEnter(tt.col, tt.row); got != tt.want {
				t.Errorf("CanEnter(%d, %d) = %t, want %t",
					tt.col, tt.row, got, tt.want)
			}
		})
	}
}

func TestCollisionGridBombPlacementAndRemoval(t *testing.T) {
	gameMap := &Map{
		Columns: 2,
		Rows:    2,
		Tiles: []TileType{
			TileEmpty, TileWall,
			TileEmpty, TileEmpty,
		},
	}

	grid := NewCollisionGrid(gameMap)

	if !grid.PlaceBomb(0, 0) {
		t.Fatal("PlaceBomb should succeed on an empty cell")
	}

	if grid.CanEnter(0, 0) {
		t.Error("CanEnter should return false when a bomb occupies the cell")
	}

	if grid.PlaceBomb(0, 0) {
		t.Error("PlaceBomb should fail when a bomb already occupies the cell")
	}

	if grid.PlaceBomb(1, 0) {
		t.Error("PlaceBomb should fail on a wall")
	}

	if !grid.RemoveBomb(0, 0) {
		t.Fatal("RemoveBomb should succeed when a bomb is present")
	}

	if !grid.CanEnter(0, 0) {
		t.Error("CanEnter should return true after the bomb is removed")
	}

	if grid.RemoveBomb(0, 0) {
		t.Error("RemoveBomb should fail when no bomb is present")
	}
}

func TestCollisionGridDestroyBlock(t *testing.T) {
	gameMap := &Map{
		Columns: 2,
		Rows:    2,
		Tiles: []TileType{
			TileBlock, TileWall,
			TileEmpty, TileEmpty,
		},
	}

	grid := NewCollisionGrid(gameMap)

	if grid.CanEnter(0, 0) {
		t.Fatal("CanEnter should return false before the block is destroyed")
	}

	if !grid.DestroyBlock(0, 0) {
		t.Fatal("DestroyBlock should succeed on a block")
	}

	if !grid.CanEnter(0, 0) {
		t.Error("CanEnter should return true after the block is destroyed")
	}

	if grid.DestroyBlock(0, 0) {
		t.Error("DestroyBlock should fail when the cell is no longer a block")
	}

	if grid.DestroyBlock(1, 0) {
		t.Error("DestroyBlock should fail on a wall")
	}
}

func TestCollisionGridCanOccupyBox(t *testing.T) {
	gameMap := &Map{
		Columns: 3,
		Rows:    3,
		Tiles: []TileType{
			TileEmpty, TileWall, TileEmpty,
			TileEmpty, TileEmpty, TileEmpty,
			TileEmpty, TileEmpty, TileEmpty,
		},
	}
	grid := NewCollisionGrid(gameMap)

	if !grid.CanOccupy(0.1, 0.1, 0.5, 0.5) {
		t.Error("box inside an empty tile should be allowed")
	}

	if grid.CanOccupy(0.7, 0.1, 0.5, 0.5) {
		t.Error("box overlapping a wall should not be allowed")
	}

	if grid.CanOccupy(-0.1, 0.1, 0.5, 0.5) {
		t.Error("box extending outside the map should not be allowed")
	}

	if grid.CanOccupy(0, 0, 0, 0.5) {
		t.Error("box with zero width should not be allowed")
	}
}

func TestCollisionGridNudgeToCorridor(t *testing.T) {
	gameMap := &Map{
		Columns: 5,
		Rows:    5,
		Tiles: []TileType{
			TileWall, TileWall, TileWall, TileWall, TileWall,
			TileWall, TileEmpty, TileEmpty, TileEmpty, TileWall,
			TileWall, TileEmpty, TileEmpty, TileEmpty, TileWall,
			TileWall, TileEmpty, TileEmpty, TileEmpty, TileWall,
			TileWall, TileWall, TileWall, TileWall, TileWall,
		},
	}
	grid := NewCollisionGrid(gameMap)

	x, y := grid.NudgeToCorridor(1.1, 1.1, 0.6, 0.6, 0.2, true)
	if math.Abs(y-1.2) > 1e-9 {
		t.Errorf("horizontal movement should nudge y to 1.2, got %v", y)
	}
	if math.Abs(x-1.1) > 1e-9 {
		t.Errorf("horizontal movement should not change x, got %v", x)
	}

	x, y = grid.NudgeToCorridor(1.1, 1.1, 0.6, 0.6, 0.05, true)
	if math.Abs(y-1.1) > 1e-9 {
		t.Errorf("nudge beyond maxNudge should leave y unchanged, got %v", y)
	}
}
