package main

import (
	"encoding/json"
	"log"
	"strings"
	"time"
	"unicode/utf8"
)

// Lobby runs the waiting-room rules.
// All lobby state is changed only inside Run, one event at a time, so no locks are needed.

const (
	maxPlayers     = 4
	minPlayers     = 2
	maxNicknameLen = 12
)

type phase string

const (
	phaseWaiting   phase = "waiting"
	phaseWait      phase = "wait"
	phaseCountdown phase = "countdown"
	phaseStarted   phase = "started"
)

// LobbyConfig sets the lobby timers, so tests can use short values.
type LobbyConfig struct {
	Tick           time.Duration // length of one countdown step
	WaitTicks      int           // steps in the wait phase
	CountdownTicks int           // steps in the countdown phase
}

func DefaultLobbyConfig() LobbyConfig {
	return LobbyConfig{Tick: time.Second, WaitTicks: 20, CountdownTicks: 10}
}

// Player is one player who has joined the lobby.
type Player struct {
	ID       int    `json:"id"`
	Nickname string `json:"nickname"`
}

type joinData struct {
	Nickname string `json:"nickname"`
}

type lobbyData struct {
	Players []Player `json:"players"`
	Count   int      `json:"count"`
	Max     int      `json:"max"`
}

type countdownData struct {
	Phase   phase `json:"phase"`
	Seconds int   `json:"seconds"`
}

type startData struct {
	Players []Player `json:"players"`
}

type errorData struct {
	Message string `json:"message"`
}

type joinRequest struct {
	client   *Client
	nickname string
}

// Lobby holds the waiting room. Only Run reads or changes its fields.
type Lobby struct {
	hub    *Hub
	config LobbyConfig

	joins  chan joinRequest
	leaves chan *Client
	chats  chan chatRequest

	players     map[*Client]Player
	order       []*Client
	nextID      int
	phase       phase
	secondsLeft int
	ticker      *time.Ticker
}

// NewLobby creates an empty lobby. Call Run in its own goroutine to start it.
func NewLobby(hub *Hub, config LobbyConfig) *Lobby {
	return &Lobby{
		hub:     hub,
		config:  config,
		joins:   make(chan joinRequest),
		leaves:  make(chan *Client),
		chats:   make(chan chatRequest),
		players: make(map[*Client]Player),
		phase:   phaseWaiting,
	}
}

// Join asks the lobby to add a client with the given nickname.
func (l *Lobby) Join(client *Client, nickname string) {
	l.joins <- joinRequest{client: client, nickname: nickname}
}

// Leave tells the lobby that a client has disconnected.
func (l *Lobby) Leave(client *Client) {
	l.leaves <- client
}

// Run handles one event at a time: a join, a leave, a chat or a timer step.
func (l *Lobby) Run() {
	for {
		select {
		case req := <-l.joins:
			l.join(req)
		case client := <-l.leaves:
			l.leave(client)
		case req := <-l.chats:
			l.chat(req)
		case <-l.tickChannel():
			l.onTick()
		}
	}
}

func (l *Lobby) join(req joinRequest) {
	client := req.client
	nickname := strings.TrimSpace(req.nickname)

	switch {
	case l.phase == phaseStarted:
		l.sendError(client, "the game has already started")
	case l.isPlayer(client):
		l.sendError(client, "you have already joined")
	case len(l.players) >= maxPlayers:
		l.sendError(client, "the game is full")
	case nickname == "":
		l.sendError(client, "please enter a nickname")
	case utf8.RuneCountInString(nickname) > maxNicknameLen:
		l.sendError(client, "nickname must be 12 characters or fewer")
	case l.nicknameTaken(nickname):
		l.sendError(client, "nickname is already taken")
	default:
		l.nextID++
		l.players[client] = Player{ID: l.nextID, Nickname: nickname}
		l.order = append(l.order, client)
		log.Printf("%q joined (%d/%d)", nickname, len(l.players), maxPlayers)
		l.sendLobby()
		l.updatePhase()
	}
}

func (l *Lobby) leave(client *Client) {
	player, ok := l.players[client]
	if !ok {
		return
	}
	delete(l.players, client)
	for i, c := range l.order {
		if c == client {
			l.order = append(l.order[:i], l.order[i+1:]...)
			break
		}
	}
	log.Printf("%q left (%d/%d)", player.Nickname, len(l.players), maxPlayers)

	if l.phase == phaseStarted {
		return
	}
	l.sendLobby()
	l.updatePhase()
}

// updatePhase applies the phase rules after a join or a leave.
func (l *Lobby) updatePhase() {
	count := len(l.players)
	switch {
	case count < minPlayers:
		if l.phase != phaseWaiting {
			l.setPhase(phaseWaiting, 0)
		}
	case count == maxPlayers && l.phase != phaseCountdown:
		l.setPhase(phaseCountdown, l.config.CountdownTicks)
	case l.phase == phaseWaiting:
		l.setPhase(phaseWait, l.config.WaitTicks)
	}
}

// onTick counts down one step and moves to the next phase at 0.
func (l *Lobby) onTick() {
	l.secondsLeft--
	if l.secondsLeft > 0 {
		l.sendCountdown()
		return
	}
	switch l.phase {
	case phaseWait:
		l.setPhase(phaseCountdown, l.config.CountdownTicks)
	case phaseCountdown:
		l.start()
	}
}

func (l *Lobby) setPhase(p phase, seconds int) {
	l.phase = p
	l.secondsLeft = seconds
	l.stopTicker()
	if seconds > 0 {
		l.ticker = time.NewTicker(l.config.Tick)
	}
	log.Printf("lobby phase: %s (%d)", p, seconds)
	l.sendCountdown()
}

func (l *Lobby) start() {
	l.stopTicker()
	l.phase = phaseStarted
	log.Printf("game starting with %d players", len(l.players))
	l.sendToPlayers(TypeStart, startData{Players: l.playerList()})
}

// tickChannel returns the ticker's channel, or nil when no timer is running.
// Receiving from a nil channel blocks forever, so Run ignores it.
func (l *Lobby) tickChannel() <-chan time.Time {
	if l.ticker == nil {
		return nil
	}
	return l.ticker.C
}

func (l *Lobby) stopTicker() {
	if l.ticker != nil {
		l.ticker.Stop()
		l.ticker = nil
	}
}

func (l *Lobby) isPlayer(client *Client) bool {
	_, ok := l.players[client]
	return ok
}

func (l *Lobby) nicknameTaken(nickname string) bool {
	for _, player := range l.players {
		if strings.EqualFold(player.Nickname, nickname) {
			return true
		}
	}
	return false
}

func (l *Lobby) playerList() []Player {
	list := make([]Player, 0, len(l.order))
	for _, client := range l.order {
		list = append(list, l.players[client])
	}
	return list
}

func (l *Lobby) sendLobby() {
	l.sendToPlayers(TypeLobby, lobbyData{Players: l.playerList(), Count: len(l.players), Max: maxPlayers})
}

func (l *Lobby) sendCountdown() {
	l.sendToPlayers(TypeCountdown, countdownData{Phase: l.phase, Seconds: l.secondsLeft})
}

func (l *Lobby) sendError(client *Client, text string) {
	if message, ok := encode(TypeError, errorData{Message: text}); ok {
		l.hub.sendTo(client, message)
	}
}

// sendToPlayers sends one message to every player in the lobby.
func (l *Lobby) sendToPlayers(msgType string, data any) {
	message, ok := encode(msgType, data)
	if !ok {
		return
	}
	for _, client := range l.order {
		l.hub.sendTo(client, message)
	}
}

// encode builds a message and logs any encoding error.
func encode(msgType string, data any) ([]byte, bool) {
	message, err := NewMessage(msgType, data)
	if err != nil {
		log.Printf("could not encode %s: %v", msgType, err)
		return nil, false
	}
	return message, true
}

// decodeJoin reads the nickname from a join message.
func decodeJoin(raw json.RawMessage) (string, bool) {
	var data joinData
	if err := json.Unmarshal(raw, &data); err != nil {
		return "", false
	}
	return data.Nickname, true
}
