package main

import (
	"encoding/json"
	"testing"
)

// clearBoard removes every block, so only walls and floor are left.
func clearBoard(m *Match) {
	for i, tile := range m.gameMap.Tiles {
		if tile == TileBlock {
			m.gameMap.Tiles[i] = TileEmpty
		}
	}
}

func TestClearedBoardEndsWithHighestScore(t *testing.T) {
	m, ann, bob, client := newPauseMatch()
	clearBoard(m)
	ann.Score, bob.Score = 120, 310

	if !m.step() {
		t.Fatal("expected the match to end once the board is cleared")
	}
	msg := lastMessage(t, client)
	if msg.Type != TypeEnd {
		t.Fatalf("expected an end message, got %q", msg.Type)
	}
	var data endData
	json.Unmarshal(msg.Data, &data)
	if data.Winner == nil || data.Winner.Nickname != "bob" || data.Reason != endHighestScore {
		t.Fatalf("expected bob to win on score, got %+v", data)
	}
}

func TestHighestScoreTieGoesToMostLives(t *testing.T) {
	m, ann, bob, client := newPauseMatch()
	clearBoard(m)
	ann.Score, bob.Score = 200, 200
	ann.Lives, bob.Lives = 1, 2

	m.step()
	var data endData
	json.Unmarshal(lastMessage(t, client).Data, &data)
	if data.Winner == nil || data.Winner.Nickname != "bob" {
		t.Fatalf("expected bob to win on lives, got %+v", data.Winner)
	}
}

func TestBoardNotClearedWhileSomethingIsLeft(t *testing.T) {
	m, ann, _, _ := newPauseMatch()
	clearBoard(m)
	m.placeBomb(ann.client)

	if m.boardCleared() {
		t.Fatal("expected a ticking bomb to keep the match going")
	}
	delete(m.bombs, centreCell(ann.Position))
	m.powerUps[gridCell{col: 1, row: 1}] = &powerUp{id: 1, kind: powerUpSpeed}
	if m.boardCleared() {
		t.Fatal("expected a power-up on the map to keep the match going")
	}
}
