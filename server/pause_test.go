package main

import (
	"encoding/json"
	"testing"
)

// newPauseMatch creates a two-player match whose messages to the first
// player can be read from the returned client's send channel.
func newPauseMatch() (*Match, *MatchPlayer, *MatchPlayer, *Client) {
	hub := newHub()
	first := &Client{send: make(chan []byte, 64)}
	hub.register(first)
	entrants := []matchEntrant{
		{client: first, player: Player{ID: 1, Nickname: "ann"}},
		{client: &Client{}, player: Player{ID: 2, Nickname: "bob"}},
	}
	m := NewMatch(hub, entrants, 42, nil)
	return m, m.players[0], m.players[1], first
}

// lastMessage empties a client's send channel and returns the last message.
func lastMessage(t *testing.T, c *Client) Message {
	t.Helper()
	var msg Message
	for {
		select {
		case raw := <-c.send:
			if err := json.Unmarshal(raw, &msg); err != nil {
				t.Fatalf("could not decode %q: %v", raw, err)
			}
		default:
			return msg
		}
	}
}

func pause(m *Match, p *MatchPlayer, action string) {
	m.applyPause(pauseRequest{client: p.client, action: action})
}

func TestPausedMatchDoesNotTick(t *testing.T) {
	m, ann, _, client := newPauseMatch()
	m.placeBomb(ann.client)

	pause(m, ann, actionPause)
	msg := lastMessage(t, client)
	var data pausedData
	json.Unmarshal(msg.Data, &data)
	if msg.Type != TypePause || !data.Paused || data.By != "ann" {
		t.Fatalf("expected a pause message by ann, got %s %+v", msg.Type, data)
	}

	for i := 0; i < fuseTicks*2; i++ {
		m.onTick()
	}
	if m.tick != 0 {
		t.Fatalf("expected the tick to stay 0 while paused, got %d", m.tick)
	}
	if len(m.bombs) != 1 {
		t.Fatalf("expected the bomb to wait while paused, got %d bombs", len(m.bombs))
	}
}

func TestPauseStopsPlayersWalking(t *testing.T) {
	m, ann, _, _ := newPauseMatch()
	press(m, ann, inputData{Right: true, Seq: 1})

	pause(m, ann, actionPause)
	if ann.held.Right {
		t.Fatal("expected pausing to stop the player walking")
	}
}

func TestContinueResumesTheMatch(t *testing.T) {
	m, ann, bob, client := newPauseMatch()
	pause(m, ann, actionPause)

	pause(m, bob, actionContinue)
	msg := lastMessage(t, client)
	var data pausedData
	json.Unmarshal(msg.Data, &data)
	if msg.Type != TypePause || data.Paused || data.By != "bob" {
		t.Fatalf("expected a continue message by bob, got %s %+v", msg.Type, data)
	}

	m.onTick()
	if m.tick != 1 {
		t.Fatalf("expected the match to tick again, got tick %d", m.tick)
	}
}

func TestRestartStartsAgain(t *testing.T) {
	m, ann, bob, client := newPauseMatch()
	m.placeBomb(ann.client)
	for i := 0; i < 5; i++ {
		m.onTick()
	}
	ann.Score, bob.Lives = 70, 1

	pause(m, ann, actionPause)
	pause(m, bob, actionRestart)

	if m.paused || m.tick != 0 || len(m.bombs) != 0 {
		t.Fatalf("expected a running match at tick 0 with no bombs, got paused=%v tick=%d bombs=%d", m.paused, m.tick, len(m.bombs))
	}
	if ann.Score != 0 || bob.Lives != startLives {
		t.Fatalf("expected scores and lives reset, got score %d and lives %d", ann.Score, bob.Lives)
	}
	if msg := lastMessage(t, client); msg.Type != TypeStart {
		t.Fatalf("expected a new start message, got %q", msg.Type)
	}
}

func TestContinueAndRestartNeedAPause(t *testing.T) {
	m, ann, _, _ := newPauseMatch()
	ann.Score = 70

	pause(m, ann, actionRestart)
	pause(m, ann, actionContinue)
	if ann.Score != 70 || m.paused {
		t.Fatal("expected continue and restart to do nothing while the match runs")
	}
}

func TestPlayerWhoIsOutCannotPause(t *testing.T) {
	m, ann, _, _ := newPauseMatch()
	ann.Lives = 0

	pause(m, ann, actionPause)
	if m.paused {
		t.Fatal("expected a player who is out not to pause the match")
	}
}

func TestPlayerWhoLeftStaysOutAfterRestart(t *testing.T) {
	m, ann, bob, _ := newPauseMatch()
	m.players = append(m.players, &MatchPlayer{ID: 3, Nickname: "cat", client: &Client{}, Lives: startLives})
	cat := m.players[2]
	m.removePlayer(cat.client)

	pause(m, ann, actionPause)
	pause(m, bob, actionRestart)
	if cat.Lives != 0 {
		t.Fatalf("expected the player who left to stay out, got %d lives", cat.Lives)
	}
}

func TestDecodePause(t *testing.T) {
	if action, ok := decodePause(json.RawMessage(`{"action":"restart"}`)); !ok || action != actionRestart {
		t.Fatalf("expected restart, got %q %v", action, ok)
	}
	if _, ok := decodePause(json.RawMessage(`{"action":"jump"}`)); ok {
		t.Fatal("expected an unknown action to be rejected")
	}
}
