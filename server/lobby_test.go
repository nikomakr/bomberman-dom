package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

// fastConfig is the real rules (20 waiting steps, 10 countdown steps) with a
// 10 ms step, so a full wait plus countdown takes well under a second.
func fastConfig() LobbyConfig {
	return LobbyConfig{Tick: 10 * time.Millisecond, WaitTicks: 20, CountdownTicks: 10}
}

// newTestLobby builds a lobby with the given config and starts its Run loop.
// Run has no stop signal, so the goroutine ends when the test binary exits.
func newTestLobby(cfg LobbyConfig) *Lobby {
	hub := newHub()
	l := NewLobby(hub, cfg)
	go l.Run()
	return l
}

// newTestClient makes a client that is registered in the lobby's hub, so the
// lobby can send to it. Whatever the lobby sends can be read from c.send.
func newTestClient(l *Lobby) *Client {
	c := &Client{send: make(chan []byte, 1024)}
	l.hub.register(c)
	return c
}

// recv returns the next message sent to the client, or fails after 2 seconds.
func recv(t *testing.T, c *Client) Message {
	t.Helper()
	select {
	case raw, ok := <-c.send:
		if !ok {
			t.Fatal("client send channel was closed")
		}
		var m Message
		if err := json.Unmarshal(raw, &m); err != nil {
			t.Fatalf("could not decode message %q: %v", raw, err)
		}
		return m
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for a message")
	}
	return Message{}
}

// next skips messages until one of the given type arrives, and returns its data.
func next(t *testing.T, c *Client, msgType string) json.RawMessage {
	t.Helper()
	for {
		m := recv(t, c)
		if m.Type == msgType {
			return m.Data
		}
	}
}

func nextLobby(t *testing.T, c *Client) lobbyData {
	t.Helper()
	var d lobbyData
	if err := json.Unmarshal(next(t, c, TypeLobby), &d); err != nil {
		t.Fatalf("bad lobby data: %v", err)
	}
	return d
}

func nextCountdown(t *testing.T, c *Client) countdownData {
	t.Helper()
	var d countdownData
	if err := json.Unmarshal(next(t, c, TypeCountdown), &d); err != nil {
		t.Fatalf("bad countdown data: %v", err)
	}
	return d
}

func nextError(t *testing.T, c *Client) string {
	t.Helper()
	var d errorData
	if err := json.Unmarshal(next(t, c, TypeError), &d); err != nil {
		t.Fatalf("bad error data: %v", err)
	}
	return d.Message
}

// untilPhase skips countdown messages until one has the wanted phase.
func untilPhase(t *testing.T, c *Client, p phase) countdownData {
	t.Helper()
	for {
		if d := nextCountdown(t, c); d.Phase == p {
			return d
		}
	}
}

// joinAll joins one new client per nickname and returns the clients.
// Each join is confirmed with a lobby message, so the lobby has handled it.
func joinAll(t *testing.T, l *Lobby, nicknames ...string) []*Client {
	t.Helper()
	clients := make([]*Client, 0, len(nicknames))
	for _, name := range nicknames {
		c := newTestClient(l)
		l.Join(c, name)
		nextLobby(t, c)
		clients = append(clients, c)
	}
	return clients
}

// waitUntilStarted joins a probe client until the lobby says the game has
// started. Only use it with 4 players in the lobby: before the start the probe
// is refused with "the game is full", so it never changes the lobby.
func waitUntilStarted(t *testing.T, l *Lobby) {
	t.Helper()
	probe := newTestClient(l)
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		l.Join(probe, "probe")
		if nextError(t, probe) == "the game has already started" {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("the game did not start in time")
}

// ---------------------------------------------------------------------
// The real timing
// ---------------------------------------------------------------------

func TestDefaultLobbyConfig(t *testing.T) {
	cfg := DefaultLobbyConfig()
	if got := time.Duration(cfg.WaitTicks) * cfg.Tick; got != 20*time.Second {
		t.Errorf("wait = %v, want 20s", got)
	}
	if got := time.Duration(cfg.CountdownTicks) * cfg.Tick; got != 10*time.Second {
		t.Errorf("countdown = %v, want 10s", got)
	}
}

// ---------------------------------------------------------------------
// Nickname checks
// ---------------------------------------------------------------------

func TestNicknameRejected(t *testing.T) {
	tests := []struct {
		name     string
		nickname string
		want     string
	}{
		{"empty", "", "please enter a nickname"},
		{"only spaces", "    ", "please enter a nickname"},
		{"13 characters", "abcdefghijklm", "nickname must be 12 characters or fewer"},
		{"13 accented characters", strings.Repeat("é", 13), "nickname must be 12 characters or fewer"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := newTestLobby(fastConfig())
			c := newTestClient(l)
			l.Join(c, tt.nickname)
			if got := nextError(t, c); got != tt.want {
				t.Errorf("error = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNicknameAccepted(t *testing.T) {
	tests := []struct {
		name     string
		nickname string
		want     string
	}{
		{"simple", "bob", "bob"},
		{"12 characters", "abcdefghijkl", "abcdefghijkl"},
		{"12 accented characters", strings.Repeat("é", 12), strings.Repeat("é", 12)},
		{"spaces are trimmed", "  bob  ", "bob"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := newTestLobby(fastConfig())
			c := newTestClient(l)
			l.Join(c, tt.nickname)
			d := nextLobby(t, c)
			if d.Count != 1 || len(d.Players) != 1 || d.Players[0].Nickname != tt.want {
				t.Errorf("lobby = %+v, want one player named %q", d, tt.want)
			}
		})
	}
}

func TestNicknameTakenIgnoresCase(t *testing.T) {
	l := newTestLobby(fastConfig())
	joinAll(t, l, "Bob")

	other := newTestClient(l)
	l.Join(other, "bOB")
	if got := nextError(t, other); got != "nickname is already taken" {
		t.Errorf("error = %q, want the nickname-taken error", got)
	}
}

func TestSameClientCannotJoinTwice(t *testing.T) {
	l := newTestLobby(fastConfig())
	c := joinAll(t, l, "bob")[0]

	l.Join(c, "bobby")
	if got := nextError(t, c); got != "you have already joined" {
		t.Errorf("error = %q, want the already-joined error", got)
	}
}

// ---------------------------------------------------------------------
// The counter
// ---------------------------------------------------------------------

func TestCounterFollowsJoinsAndLeaves(t *testing.T) {
	l := newTestLobby(fastConfig())
	c1 := newTestClient(l)
	c2 := newTestClient(l)

	l.Join(c1, "ann")
	d := nextLobby(t, c1)
	if d.Count != 1 || d.Max != 4 {
		t.Errorf("after 1 join: count=%d max=%d, want 1 and 4", d.Count, d.Max)
	}

	l.Join(c2, "bob")
	d = nextLobby(t, c1)
	if d.Count != 2 || len(d.Players) != 2 ||
		d.Players[0].Nickname != "ann" || d.Players[1].Nickname != "bob" {
		t.Errorf("after 2 joins: lobby = %+v, want ann then bob", d)
	}

	l.Leave(c2)
	d = nextLobby(t, c1)
	if d.Count != 1 || len(d.Players) != 1 || d.Players[0].Nickname != "ann" {
		t.Errorf("after a leave: lobby = %+v, want only ann", d)
	}
}

func TestRejectedJoinDoesNotChangeCounter(t *testing.T) {
	l := newTestLobby(fastConfig())
	c1 := joinAll(t, l, "ann")[0]

	bad := newTestClient(l)
	l.Join(bad, "")
	nextError(t, bad)

	good := newTestClient(l)
	l.Join(good, "bob")
	if d := nextLobby(t, c1); d.Count != 2 {
		t.Errorf("count = %d, want 2 (the rejected join must not count)", d.Count)
	}
}

// ---------------------------------------------------------------------
// The 20-second wait
// ---------------------------------------------------------------------

func TestWaitStartsWithSecondPlayerAndEndsInCountdown(t *testing.T) {
	l := newTestLobby(fastConfig())
	cs := joinAll(t, l, "ann", "bob")

	// One player alone does not start the wait, the second one does.
	if d := untilPhase(t, cs[0], phaseWait); d.Seconds != 20 {
		t.Fatalf("wait started at %d, want 20", d.Seconds)
	}
	for want := 19; want >= 1; want-- {
		d := nextCountdown(t, cs[0])
		if d.Phase != phaseWait || d.Seconds != want {
			t.Fatalf("got %+v, want phase wait with %d seconds left", d, want)
		}
	}
	d := nextCountdown(t, cs[0])
	if d.Phase != phaseCountdown || d.Seconds != 10 {
		t.Errorf("after the wait got %+v, want countdown with 10 seconds", d)
	}
}

func TestThirdPlayerDoesNotRestartWait(t *testing.T) {
	l := newTestLobby(LobbyConfig{Tick: 10 * time.Millisecond, WaitTicks: 1000, CountdownTicks: 10})
	cs := joinAll(t, l, "ann", "bob")

	untilPhase(t, cs[0], phaseWait) // 1000
	nextCountdown(t, cs[0])         // 999
	before := nextCountdown(t, cs[0])

	third := newTestClient(l)
	l.Join(third, "cat")
	nextLobby(t, third)

	after := nextCountdown(t, cs[0])
	if after.Phase != phaseWait || after.Seconds >= before.Seconds {
		t.Errorf("after the 3rd player got %+v, the wait was at %d before; it must keep counting down", after, before.Seconds)
	}
}

func TestWaitCancelledWhenBelowTwoPlayers(t *testing.T) {
	l := newTestLobby(LobbyConfig{Tick: 10 * time.Millisecond, WaitTicks: 1000, CountdownTicks: 10})
	cs := joinAll(t, l, "ann", "bob")
	untilPhase(t, cs[0], phaseWait)

	l.Leave(cs[1])
	d := untilPhase(t, cs[0], phaseWaiting)
	if d.Seconds != 0 {
		t.Errorf("seconds = %d, want 0 when back to waiting", d.Seconds)
	}

	// The timer must be stopped: no more countdown messages arrive.
	select {
	case raw := <-cs[0].send:
		var m Message
		if json.Unmarshal(raw, &m) == nil && m.Type == TypeCountdown {
			t.Errorf("got a countdown message after the wait was cancelled: %s", raw)
		}
	case <-time.After(100 * time.Millisecond):
	}
}

// ---------------------------------------------------------------------
// The 10-second countdown
// ---------------------------------------------------------------------

func TestCountdownRunsDownAndStartsGame(t *testing.T) {
	l := newTestLobby(fastConfig())
	cs := joinAll(t, l, "ann", "bob", "cat", "dan")

	// Four players skip the wait and go straight to the countdown.
	if d := untilPhase(t, cs[0], phaseCountdown); d.Seconds != 10 {
		t.Fatalf("countdown started at %d, want 10", d.Seconds)
	}
	for want := 9; want >= 1; want-- {
		d := nextCountdown(t, cs[0])
		if d.Phase != phaseCountdown || d.Seconds != want {
			t.Fatalf("got %+v, want countdown with %d seconds left", d, want)
		}
	}

	waitUntilStarted(t, l)
}

func TestCountdownCancelledWhenBelowTwoPlayers(t *testing.T) {
	l := newTestLobby(LobbyConfig{Tick: 10 * time.Millisecond, WaitTicks: 2, CountdownTicks: 1000})
	cs := joinAll(t, l, "ann", "bob")
	untilPhase(t, cs[0], phaseCountdown)

	l.Leave(cs[1])
	d := untilPhase(t, cs[0], phaseWaiting)
	if d.Seconds != 0 {
		t.Errorf("seconds = %d, want 0 when back to waiting", d.Seconds)
	}
}

// ---------------------------------------------------------------------
// The fifth player
// ---------------------------------------------------------------------

func TestFourthPlayerSkipsWaitAndFifthIsRefused(t *testing.T) {
	// Long timers, so nothing can expire by itself during the test.
	l := newTestLobby(LobbyConfig{Tick: 10 * time.Millisecond, WaitTicks: 1000, CountdownTicks: 1000})
	cs := joinAll(t, l, "ann", "bob", "cat", "dan")

	if d := untilPhase(t, cs[0], phaseCountdown); d.Seconds != 1000 {
		t.Errorf("4th player: got %+v, want the countdown to start at once", d)
	}

	fifth := newTestClient(l)
	l.Join(fifth, "eve")
	if got := nextError(t, fifth); got != "the game is full" {
		t.Errorf("error = %q, want the game-is-full error", got)
	}
}

func TestNobodyCanJoinAfterStart(t *testing.T) {
	l := newTestLobby(fastConfig())
	joinAll(t, l, "ann", "bob", "cat", "dan")
	waitUntilStarted(t, l)

	late := newTestClient(l)
	l.Join(late, "eve")
	if got := nextError(t, late); got != "the game has already started" {
		t.Errorf("error = %q, want the game-already-started error", got)
	}
}

func TestBackToStartReachesEveryone(t *testing.T) {
	l := newTestLobby(fastConfig())
	ann, bob := newTestClient(l), newTestClient(l)

	l.BackToStart()
	for _, c := range []*Client{ann, bob} {
		if m := recv(t, c); m.Type != TypeBackToStart {
			t.Fatalf("expected %q, got %q", TypeBackToStart, m.Type)
		}
	}
}
