package main

import (
	"log"
	"time"
)

// A Match runs one game on the server, which is authoritative: it alone decides positions and lives. All match state is changed only inside Run, one step at a time, so no locks are needed.

const (
	tickRate     = 20                     // state updates per second
	tickInterval = time.Second / tickRate // 50 ms between updates
	startLives   = 3
)

// playerColours gives each player a colour in join order.
var playerColours = []string{"red", "blue", "green", "yellow"}

// Position is a place on the map, in tiles; (0, 0) is the top-left tile.
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// MatchPlayer is one player's state during a match.
type MatchPlayer struct {
	ID       int      `json:"id"`
	Nickname string   `json:"nickname"`
	Colour   string   `json:"colour"`
	Position Position `json:"position"`
	Lives    int      `json:"lives"`

	client *Client // not exported, so never sent as JSON
}

// playerUpdate is the part of a player that can change during a match.
type playerUpdate struct {
	ID       int      `json:"id"`
	Position Position `json:"position"`
	Lives    int      `json:"lives"`
}

type matchStartData struct {
	Map     Map            `json:"map"`
	Players []*MatchPlayer `json:"players"`
}

type stateData struct {
	Tick    int            `json:"tick"`
	Players []playerUpdate `json:"players,omitempty"`
}

// matchEntrant is a lobby player handed over to a new match.
type matchEntrant struct {
	client *Client
	player Player
}

// Match holds one game. Only Run reads or changes its fields.
type Match struct {
	hub      *Hub
	gameMap  Map
	players  []*MatchPlayer
	lastSent map[int]playerUpdate
	tick     int
}

// NewMatch creates a match on a new map and places each player in a corner.
func NewMatch(hub *Hub, entrants []matchEntrant, seed int64) *Match {
	m := &Match{
		hub:      hub,
		gameMap:  GenerateMap(seed),
		lastSent: make(map[int]playerUpdate),
	}

	corners := cornerPositions(m.gameMap)
	for i, e := range entrants {
		p := &MatchPlayer{
			ID:       e.player.ID,
			Nickname: e.player.Nickname,
			Colour:   playerColours[i],
			Position: corners[i],
			Lives:    startLives,
			client:   e.client,
		}
		m.players = append(m.players, p)
		m.lastSent[p.ID] = p.update()
	}
	return m
}

// Run sends the start message, then one state update per tick.
func (m *Match) Run() {
	log.Printf("match started: %d players, %dx%d map", len(m.players), m.gameMap.Columns, m.gameMap.Rows)
	m.sendToPlayers(TypeStart, matchStartData{Map: m.gameMap, Players: m.players})

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	// Inputs and bombs join this select as the game grows.
	for range ticker.C {
		m.step()
	}
}

// step advances the match by one tick and sends what changed.
func (m *Match) step() {
	m.tick++
	m.sendToPlayers(TypeState, stateData{Tick: m.tick, Players: m.changedPlayers()})
}

// changedPlayers returns the players whose state differs from the last
// update sent, and remembers the new values.
func (m *Match) changedPlayers() []playerUpdate {
	var changed []playerUpdate
	for _, p := range m.players {
		u := p.update()
		if m.lastSent[p.ID] != u {
			changed = append(changed, u)
			m.lastSent[p.ID] = u
		}
	}
	return changed
}

func (p *MatchPlayer) update() playerUpdate {
	return playerUpdate{ID: p.ID, Position: p.Position, Lives: p.Lives}
}

// cornerPositions returns the four starting cells: top-left, top-right,
// bottom-left, bottom-right. They are always empty (see GenerateMap).
func cornerPositions(m Map) []Position {
	right := float64(m.Columns - 2)
	bottom := float64(m.Rows - 2)
	return []Position{{X: 1, Y: 1}, {X: right, Y: 1}, {X: 1, Y: bottom}, {X: right, Y: bottom}}
}

// sendToPlayers sends one message to every player in the match.
func (m *Match) sendToPlayers(msgType string, data any) {
	message, ok := encode(msgType, data)
	if !ok {
		return
	}
	for _, p := range m.players {
		m.hub.sendTo(p.client, message)
	}
}
