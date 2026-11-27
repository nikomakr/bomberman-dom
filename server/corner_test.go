package main

import (
	"encoding/json"
	"testing"
)

// openMatch is a match whose map has only the outer walls and the pillars,
// so a test decides exactly what is in the way.
func openMatch() (*Match, *MatchPlayer, *Client) {
	m, ann, _, client := newPauseMatch()
	for i, tile := range m.gameMap.Tiles {
		if tile == TileBlock {
			m.gameMap.Tiles[i] = TileEmpty
		}
	}
	m.gameMap.Tiles[11*m.gameMap.Columns+13] = TileBlock // one block left, so the match does not end
	m.grid = NewCollisionGrid(&m.gameMap)
	return m, ann, client
}

// Pressing right at a corner turns into the open row, even when the player
// is nearer the blocked one (the pillar at (12, 4) is ahead of row 4).
func TestTurnIntoOpenCorridor(t *testing.T) {
	for _, y := range []float64{3.4, 3.5, 3.55, 3.6, 3.7} {
		m, ann, _ := openMatch()
		ann.Position = Position{X: 11.1, Y: y}
		ann.speed = baseSpeed
		ann.held = inputData{Right: true, Seq: 1}
		for i := 0; i < 10; i++ {
			m.move(ann, ann.speed*tickInterval.Seconds())
		}
		if ann.Position.Y+playerSize > 4+1e-9 || ann.Position.X < 12 {
			t.Errorf("from y=%.2f: got (%.3f, %.3f), want the player in row 3 past column 12", y, ann.Position.X, ann.Position.Y)
		}
	}
}

// A player who is centred in a corridor and presses into a pillar stays put:
// neither lane is open, so there is nothing to slide to.
func TestNoSlideWhenBothLanesBlocked(t *testing.T) {
	m, ann, _ := openMatch()
	ann.Position = Position{X: 11.2, Y: 4.1} // row 4: pillars at (10, 4) and (12, 4)
	ann.held = inputData{Right: true, Seq: 1}
	for i := 0; i < 5; i++ {
		m.move(ann, ann.speed*tickInterval.Seconds())
	}
	if ann.Position != (Position{X: 11.2, Y: 4.1}) {
		t.Errorf("got %+v, want the player to stay at (11.2, 4.1)", ann.Position)
	}
}

// While a player holds a key but cannot move, every tick still sends them,
// so their screen is put back straight away instead of on release.
func TestBlockedPlayerIsSentEveryTick(t *testing.T) {
	m, ann, client := openMatch()
	ann.Position = Position{X: 11.2, Y: 4.1}
	ann.held = inputData{Right: true, Seq: 1}
	m.step()
	lastMessage(t, client)
	for i := 0; i < 3; i++ {
		m.step()
		msg := lastMessage(t, client)
		var state stateData
		if msg.Type != TypeState || json.Unmarshal(msg.Data, &state) != nil || len(state.Players) == 0 {
			t.Fatalf("tick %d: want a state with the blocked player, got %+v", i, msg)
		}
	}
}
