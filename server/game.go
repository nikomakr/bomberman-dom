package main

import (
	"encoding/json"
	"log"
	"math"
	"math/rand/v2"
	"time"
)

// A Match runs one game on the server, which is authoritative: it alone decides positions and lives. All match state is changed only inside Run, one event at a time, so no locks are needed.
// Positions are in tiles and mark the top-left corner of a player's box, which is playerSize tiles wide and high.

const (
	tickRate     = 20                     // state updates per second
	tickInterval = time.Second / tickRate // 50 ms between updates
	startLives   = 3

	playerSize      = 0.8  // player box width and height, in tiles
	baseSpeed       = 4.0  // tiles per second
	cornerTolerance = 0.4  // how far off a corridor a player can be and still slide in
	moveStep        = 0.05 // largest distance checked for collisions at once, in tiles
	inputQueueSize  = 64   // how many unprocessed inputs can be queued per match
)

// playerColours gives each player a colour in join order.
var playerColours = []string{"red", "blue", "green", "yellow"}

// Position is a place on the map, in tiles; (0, 0) is the top-left tile.
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// inputData is the directions a player is holding. Seq starts at 1 and goes up with every input the client sends.
type inputData struct {
	Up    bool `json:"up"`
	Down  bool `json:"down"`
	Left  bool `json:"left"`
	Right bool `json:"right"`
	Seq   int  `json:"seq"`
}

type playerInput struct {
	client *Client
	input  inputData
}

// MatchPlayer is one player's state during a match.
type MatchPlayer struct {
	ID       int      `json:"id"`
	Nickname string   `json:"nickname"`
	Colour   string   `json:"colour"`
	Position Position `json:"position"`
	Lives    int      `json:"lives"`
	Score    int      `json:"score"`

	client      *Client       // not exported, so never sent as JSON
	held        inputData     // the newest input applied
	speed       float64       // tiles per second
	bombsMax    int           // bombs this player can have on the map at once
	bombsPlaced int           // bombs this player has on the map now
	bombRange   int           // cells this player's flames reach in each direction
	safeUntil   int           // tick until which flames cannot hurt this player
	left        bool          // disconnected, so stays out after a restart
	detonator   bool          // can explode their own bombs early with the Detonator
	powerUps    []powerUpKind // collected this match; one is dropped when they are out
}

// playerUpdate is the part of a player that can change during a match.
// LastInput tells the client which of its inputs this state includes.
type playerUpdate struct {
	ID        int      `json:"id"`
	Position  Position `json:"position"`
	Lives     int      `json:"lives"`
	Score     int      `json:"score"`
	Bombs     int      `json:"bombs"` // bombs the player can have on the map at once
	Range     int      `json:"range"` // cells the player's flames reach
	Speed     float64  `json:"speed"` // tiles per second
	LastInput int      `json:"lastInput"`
	Detonator bool     `json:"detonator"` // has the Detonator power-up
}

type matchStartData struct {
	Map        Map            `json:"map"`
	Players    []*MatchPlayer `json:"players"`
	PlayerSize float64        `json:"playerSize"`
}

// endData names the last player standing, or null when nobody is left.
type endData struct {
	Winner *Player     `json:"winner"`
	Scores []scoreData `json:"scores"`
}

type stateData struct {
	Tick       int             `json:"tick"`
	Players    []playerUpdate  `json:"players,omitempty"`
	Bombs      []bombData      `json:"bombs,omitempty"`      // placed since the last state
	Explosions []explosionData `json:"explosions,omitempty"` // bombs that went off and the cells they hit
	Destroyed  []cellData      `json:"destroyed,omitempty"`  // blocks destroyed, now empty
	PowerUps   []powerUpData   `json:"powerUps,omitempty"`   // power-ups that appeared
	Collected  []collectedData `json:"collected,omitempty"`  // power-ups picked up, and by whom
	Burnt      []int           `json:"burnt,omitempty"`      // ids of power-ups a flame destroyed
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
	grid     *CollisionGrid
	players  []*MatchPlayer
	inputs   chan playerInput
	leaves   chan *Client
	pauses   chan pauseRequest
	paused   bool   // while true the match does not tick, so nobody moves and every timer waits
	onEnd    func() // called once when the match is over; may be nil
	lastSent map[int]playerUpdate
	tick     int

	bombRequests     chan *Client
	detonateRequests chan *Client
	bombs            map[gridCell]*bomb
	nextBombID       int
	flames           map[gridCell]*flame
	powerUps         map[gridCell]*powerUp
	nextPowerUpID    int
	rng              *rand.Rand // the match's own random numbers, from its seed

	// Events since the last state message; sent and cleared by sendState.
	newBombs      []bombData
	explosions    []explosionData
	destroyed     []cellData
	newPowerUps   []powerUpData
	collected     []collectedData
	burntPowerUps []int
}

// NewMatch creates a match on a new map and places each player in a corner.
func NewMatch(hub *Hub, entrants []matchEntrant, seed int64, onEnd func()) *Match {
	m := &Match{
		hub:      hub,
		gameMap:  GenerateMap(seed),
		inputs:   make(chan playerInput, inputQueueSize),
		leaves:   make(chan *Client, maxPlayers),
		pauses:   make(chan pauseRequest, inputQueueSize),
		onEnd:    onEnd,
		lastSent: make(map[int]playerUpdate),

		bombRequests:     make(chan *Client, inputQueueSize),
		detonateRequests: make(chan *Client, inputQueueSize),
		bombs:            make(map[gridCell]*bomb),
		flames:           make(map[gridCell]*flame),
		powerUps:         make(map[gridCell]*powerUp),
		rng:              newMatchRand(seed),
	}
	m.grid = NewCollisionGrid(&m.gameMap)

	spawns := spawnPositions(m.gameMap)
	for i, e := range entrants {
		p := &MatchPlayer{
			ID:       e.player.ID,
			Nickname: e.player.Nickname,
			Colour:   playerColours[i],
			client:   e.client,
		}
		resetPlayer(p, spawns[i])
		m.players = append(m.players, p)
		m.lastSent[p.ID] = p.update()
	}
	return m
}

// resetPlayer gives a player the starting lives, score and power-ups and
// puts them on their spawn. A player who left stays out.
func resetPlayer(p *MatchPlayer, spawn Position) {
	p.Position = spawn
	p.Lives = startLives
	if p.left {
		p.Lives = 0
	}
	p.Score = 0
	p.held = inputData{}
	p.speed = baseSpeed
	p.bombsMax = startBombs
	p.bombsPlaced = 0
	p.bombRange = startRange
	p.safeUntil = 0
	p.detonator = false
	p.powerUps = nil
}

// Input passes a player's held directions to the match. It never blocks:
// if the queue is full the input is dropped, and the next one replaces it.
func (m *Match) Input(client *Client, input inputData) {
	select {
	case m.inputs <- playerInput{client: client, input: input}:
	default:
		log.Printf("input queue full, input dropped")
	}
}

// Leave tells the match that a player has disconnected. It never blocks.
func (m *Match) Leave(client *Client) {
	select {
	case m.leaves <- client:
	default:
		log.Printf("leave queue full, leave dropped")
	}
}

// Run sends the start message, then handles inputs, leaves and ticks one at
// a time. It returns when the match is over, so its goroutine stops.
func (m *Match) Run() {
	log.Printf("match started: %d players, %dx%d map", len(m.players), m.gameMap.Columns, m.gameMap.Rows)
	m.sendToPlayers(TypeStart, matchStartData{Map: m.gameMap, Players: m.players, PlayerSize: playerSize})

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	for {
		select {
		case in := <-m.inputs:
			m.applyInput(in)
		case client := <-m.bombRequests:
			if !m.paused {
				m.placeBomb(client)
			}
		case client := <-m.detonateRequests:
			if !m.paused {
				m.detonate(client)
			}
		case req := <-m.pauses:
			m.applyPause(req)
		case client := <-m.leaves:
			if m.removePlayer(client) {
				return
			}
		case <-ticker.C:
			if m.onTick() {
				return
			}
		}
	}
}

// applyInput keeps only the newest input per player. Inputs from unknown clients, from players who are out, or older than one already applied are ignored
func (m *Match) applyInput(in playerInput) {
	p := m.playerFor(in.client)
	if p == nil || p.Lives <= 0 || in.input.Seq <= p.held.Seq {
		return
	}
	p.held = in.input
}

// removePlayer puts a player who left out of the game. It reports whether
// the match is now over.
func (m *Match) removePlayer(client *Client) bool {
	p := m.playerFor(client)
	if p == nil {
		return false
	}
	p.left = true
	if p.Lives == 0 {
		return false
	}
	p.Lives = 0
	log.Printf("%q left the match", p.Nickname)
	return m.checkForWinner()
}

// checkForWinner ends the match when one player or none is left. It sends
// the final state and the end message, then tells the lobby.
func (m *Match) checkForWinner() bool {
	var alive []*MatchPlayer
	for _, p := range m.players {
		if p.Lives > 0 {
			alive = append(alive, p)
		}
	}
	if len(alive) > 1 {
		return false
	}

	var winner *Player
	if len(alive) == 1 {
		winner = &Player{ID: alive[0].ID, Nickname: alive[0].Nickname}
		log.Printf("match over: %q wins", winner.Nickname)
	} else {
		log.Printf("match over: no winner")
	}

	m.sendState()
	m.sendToPlayers(TypeEnd, endData{Winner: winner, Scores: m.finalScores()})
	if m.onEnd != nil {
		m.onEnd()
	}
	return true
}

// onTick steps the match unless it is paused. It reports whether the match is over.
func (m *Match) onTick() bool {
	if m.paused {
		return false
	}
	return m.step()
}

// step moves every player still in the game, runs the bombs and flames,
// then sends what changed. It reports whether the match is over.
func (m *Match) step() bool {
	m.tick++
	seconds := tickInterval.Seconds()
	for _, p := range m.players {
		if p.Lives > 0 {
			m.move(p, p.speed*seconds)
		}
	}
	m.collectPowerUps()
	m.coolFlames()
	m.tickBombs()
	if m.burnPlayers() && m.checkForWinner() {
		return true
	}
	m.sendState()
	return false
}

// sendState sends what changed since the last state: players, new bombs,
// explosions and destroyed blocks. The events are then cleared.
func (m *Match) sendState() {
	state := stateData{
		Tick:       m.tick,
		Players:    m.changedPlayers(),
		Bombs:      m.newBombs,
		Explosions: m.explosions,
		Destroyed:  m.destroyed,
		PowerUps:   m.newPowerUps,
		Collected:  m.collected,
		Burnt:      m.burntPowerUps,
	}
	m.newBombs, m.explosions, m.destroyed = nil, nil, nil
	m.newPowerUps, m.collected, m.burntPowerUps = nil, nil, nil
	if state.isEmpty() {
		return
	}
	m.sendToPlayers(TypeState, state)
}

func (s stateData) isEmpty() bool {
	return len(s.Players) == 0 && len(s.Bombs) == 0 && len(s.Explosions) == 0 && len(s.Destroyed) == 0 && len(s.PowerUps) == 0 && len(s.Collected) == 0 && len(s.Burnt) == 0
}

// move moves a player up to dist tiles in the held directions. Each axis moves on its own, so a player slides along a wall instead of stopping.
func (m *Match) move(p *MatchPlayer, dist float64) {
	dx := axis(p.held.Left, p.held.Right)
	dy := axis(p.held.Up, p.held.Down)
	if dx != 0 && dy != 0 {
		dist *= math.Sqrt2 / 2 // moving diagonally is not faster
	}
	if dx != 0 {
		m.moveAxis(p, true, dx, dist)
	}
	if dy != 0 {
		m.moveAxis(p, false, dy, dist)
	}
}

// moveAxis moves along one axis in small steps and stops flush against anything solid. If the player cannot move at all, it is nudged towards the nearest corridor centre, so turning a corner feels smooth.
func (m *Match) moveAxis(p *MatchPlayer, horizontal bool, dir, dist float64) {
	moved := false
	for remaining := dist; remaining > 0; remaining -= moveStep {
		delta := math.Min(moveStep, remaining) * dir
		x, y := p.Position.X, p.Position.Y
		if horizontal {
			x += delta
		} else {
			y += delta
		}
		if !m.canMoveTo(p, x, y) {
			break
		}
		p.Position = Position{X: x, Y: y}
		moved = true
	}
	if moved {
		return
	}

	x, y := m.grid.NudgeToCorridor(p.Position.X, p.Position.Y, playerSize, playerSize, cornerTolerance, horizontal)
	p.Position = Position{X: approach(p.Position.X, x, dist), Y: approach(p.Position.Y, y, dist)}
}

// axis turns two opposite keys into -1, 0 or 1. Both held cancel out.
func axis(negative, positive bool) float64 {
	switch {
	case positive && !negative:
		return 1
	case negative && !positive:
		return -1
	}
	return 0
}

// approach moves from towards to by at most maxStep.
func approach(from, to, maxStep float64) float64 {
	if math.Abs(to-from) <= maxStep {
		return to
	}
	if to > from {
		return from + maxStep
	}
	return from - maxStep
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

func (m *Match) playerFor(client *Client) *MatchPlayer {
	for _, p := range m.players {
		if p.client == client {
			return p
		}
	}
	return nil
}

func (p *MatchPlayer) update() playerUpdate {
	return playerUpdate{
		ID:        p.ID,
		Position:  Position{X: round3(p.Position.X), Y: round3(p.Position.Y)},
		Lives:     p.Lives,
		Score:     p.Score,
		Bombs:     p.bombsMax,
		Range:     p.bombRange,
		Speed:     p.speed,
		LastInput: p.held.Seq,
		Detonator: p.detonator,
	}
}

// round3 rounds to 3 decimal places, enough for smooth drawing and short
// messages.
func round3(v float64) float64 {
	return math.Round(v*1000) / 1000
}

// spawnPositions returns a player box centred in each corner cell:
// top-left, top-right, bottom-left, bottom-right. Those cells are always
// empty (see GenerateMap).
func spawnPositions(m Map) []Position {
	offset := (1 - playerSize) / 2
	near := 1 + offset
	right := float64(m.Columns-2) + offset
	bottom := float64(m.Rows-2) + offset
	return []Position{{X: near, Y: near}, {X: right, Y: near}, {X: near, Y: bottom}, {X: right, Y: bottom}}
}

// decodeInput reads an input message. Seq must be 1 or more.
func decodeInput(raw json.RawMessage) (inputData, bool) {
	var data inputData
	if err := json.Unmarshal(raw, &data); err != nil || data.Seq < 1 {
		return inputData{}, false
	}
	return data, true
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
