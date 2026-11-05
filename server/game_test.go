package main

import (
	"math"
	"testing"
)

// newTestMatch creates a match with one player in the top-left corner.
func newTestMatch() (*Match, *MatchPlayer) {
	client := &Client{}
	entrants := []matchEntrant{{client: client, player: Player{ID: 1, Nickname: "Niko"}}}
	m := NewMatch(newHub(), entrants, 42)
	return m, m.players[0]
}

func press(m *Match, p *MatchPlayer, input inputData) {
	m.applyInput(playerInput{client: p.client, input: input})
}

func TestPlayerMovesRight(t *testing.T) {
	m, p := newTestMatch()
	startX, startY := p.Position.X, p.Position.Y

	press(m, p, inputData{Right: true, Seq: 1})
	m.step()

	if p.Position.X <= startX {
		t.Fatalf("expected x to increase from %v, got %v", startX, p.Position.X)
	}
	if p.Position.Y != startY {
		t.Fatalf("expected y to stay %v, got %v", startY, p.Position.Y)
	}
}

func TestPlayerStopsFlushAgainstWall(t *testing.T) {
	m, p := newTestMatch()

	press(m, p, inputData{Left: true, Seq: 1})
	for i := 0; i < 10; i++ {
		m.step()
	}

	if math.Abs(p.Position.X-1.0) > 1e-6 {
		t.Fatalf("expected x to stop at 1.0 against the wall, got %v", p.Position.X)
	}
}

func TestOlderInputIsIgnored(t *testing.T) {
	m, p := newTestMatch()

	press(m, p, inputData{Right: true, Seq: 2})
	press(m, p, inputData{Left: true, Seq: 1})

	if !p.held.Right || p.held.Left {
		t.Fatalf("expected the seq 2 input to stay, got %+v", p.held)
	}
}

func TestPlayerWhoIsOutDoesNotMove(t *testing.T) {
	m, p := newTestMatch()
	p.Lives = 0
	start := p.Position

	press(m, p, inputData{Right: true, Seq: 1})
	m.step()

	if p.Position != start {
		t.Fatalf("expected no movement, got %+v", p.Position)
	}
}

func TestUnknownClientIsIgnored(t *testing.T) {
	m, p := newTestMatch()
	start := p.Position

	m.applyInput(playerInput{client: &Client{}, input: inputData{Right: true, Seq: 1}})
	m.step()

	if p.Position != start {
		t.Fatalf("expected no movement, got %+v", p.Position)
	}
}

func TestStateReportsLastInput(t *testing.T) {
	m, p := newTestMatch()

	press(m, p, inputData{Right: true, Seq: 5})
	m.step()

	if got := p.update().LastInput; got != 5 {
		t.Fatalf("expected lastInput 5, got %d", got)
	}
}
