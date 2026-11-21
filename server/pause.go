package main

import (
	"encoding/json"
	"log"
)

// Pause actions a player can send. Any player still in the game can pause,
// continue or restart, and every player sees the result.
const (
	actionPause    = "pause"
	actionContinue = "continue"
	actionRestart  = "restart"
)

// pauseRequest is a player's pause action on its way to the match.
type pauseRequest struct {
	client *Client
	action string
}

// pauseActionData is what the browser sends: {"action": "pause"}.
type pauseActionData struct {
	Action string `json:"action"`
}

// pausedData tells every player whether the match is paused, and who did it.
type pausedData struct {
	Paused bool   `json:"paused"`
	By     string `json:"by"`
}

// decodePause reads a pause message. Only the three known actions are valid.
func decodePause(raw json.RawMessage) (string, bool) {
	var data pauseActionData
	if err := json.Unmarshal(raw, &data); err != nil {
		return "", false
	}
	switch data.Action {
	case actionPause, actionContinue, actionRestart:
		return data.Action, true
	}
	return "", false
}

// Pause passes a player's pause action to the match. It never blocks.
func (m *Match) Pause(client *Client, action string) {
	select {
	case m.pauses <- pauseRequest{client: client, action: action}:
	default:
		log.Printf("pause queue full, pause dropped")
	}
}

// applyPause pauses, continues or restarts the match. Requests from unknown
// clients or from players who are out are ignored. Continue and restart only
// work while the match is paused.
func (m *Match) applyPause(req pauseRequest) {
	p := m.playerFor(req.client)
	if p == nil || p.Lives <= 0 {
		return
	}
	switch req.action {
	case actionPause:
		if m.paused {
			return
		}
		m.paused = true
		for _, player := range m.players {
			player.held = inputData{Seq: player.held.Seq} // nobody keeps walking
		}
		log.Printf("%q paused the match", p.Nickname)
		m.sendToPlayers(TypePause, pausedData{Paused: true, By: p.Nickname})
	case actionContinue:
		if !m.paused {
			return
		}
		m.paused = false
		log.Printf("%q continued the match", p.Nickname)
		m.sendToPlayers(TypePause, pausedData{Paused: false, By: p.Nickname})
	case actionRestart:
		if !m.paused {
			return
		}
		log.Printf("%q restarted the match", p.Nickname)
		m.restart()
	}
}

// restart starts the match again with the same players on a new map: full
// lives, no score, no bombs or power-ups. The browsers get a new start message.
func (m *Match) restart() {
	seed := m.rng.Int64()
	m.gameMap = GenerateMap(seed)
	m.grid = NewCollisionGrid(&m.gameMap)
	m.rng = newMatchRand(seed)
	m.tick = 0
	m.paused = false

	m.bombs = make(map[gridCell]*bomb)
	m.flames = make(map[gridCell]*flame)
	m.powerUps = make(map[gridCell]*powerUp)
	m.newBombs, m.explosions, m.destroyed = nil, nil, nil
	m.newPowerUps, m.collected, m.burntPowerUps = nil, nil, nil

	spawns := spawnPositions(m.gameMap)
	for i, p := range m.players {
		resetPlayer(p, spawns[i])
		m.lastSent[p.ID] = p.update()
	}
	m.sendToPlayers(TypeStart, matchStartData{Map: m.gameMap, Players: m.players, PlayerSize: playerSize})
}
