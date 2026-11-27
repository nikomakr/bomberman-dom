package main

import (
	"log"
	"math"
	"time"
)

// Damage and score. An explosion leaves flames on the cells it hit for a short time. A player whose centre is on a flame loses a life, then is safe for a while so one explosion cannot take all three lives at once.

const (
	flameTime  = 500 * time.Millisecond
	flameTicks = int(flameTime / tickInterval) // 10 ticks
	safeTime   = 2 * time.Second
	safeTicks  = int(safeTime / tickInterval) // 40 ticks

	pointsBlock   = 10  // for each block a player's bomb destroys
	pointsHit     = 100 // for each hit on another player
	pointsPowerUp = 50  // for each power-up collected (added in BD-28)
)

// flame is one burning cell and the player whose bomb lit it.
type flame struct {
	owner *MatchPlayer
	ticks int // ticks left before it goes out
}

// scoreData is one player's final score in the end message.
type scoreData struct {
	ID       int    `json:"id"`
	Nickname string `json:"nickname"`
	Score    int    `json:"score"`
	Lives    int    `json:"lives"` // 0 for a player who was out when the match ended
}

// lightFlames puts a flame on every cell an explosion hit. A newer flame on the same cell replaces the older one.
func (m *Match) lightFlames(owner *MatchPlayer, cells []cellData) {
	for _, c := range cells {
		m.flames[gridCell{col: c.Col, row: c.Row}] = &flame{owner: owner, ticks: flameTicks}
	}
}

// burnPlayers takes a life from every player standing in a flame, unless they are still safe from an earlier hit. It reports whether anyone lost their last life.
func (m *Match) burnPlayers() bool {
	someoneOut := false
	for _, p := range m.players {
		if p.Lives == 0 || m.tick < p.safeUntil {
			continue
		}
		f, burning := m.flames[centreCell(p.Position)]
		if !burning {
			continue
		}
		p.Lives--
		p.safeUntil = m.tick + safeTicks
		if f.owner != p {
			f.owner.Score += pointsHit
		}
		log.Printf("%q was hit (%d lives left)", p.Nickname, p.Lives)
		if p.Lives == 0 {
			log.Printf("%q is out", p.Nickname)
			m.dropOnDeath(p)
			someoneOut = true
		}
	}
	return someoneOut
}

// coolFlames counts every flame down by one tick and removes the ones that have gone out.
func (m *Match) coolFlames() {
	for cell, f := range m.flames {
		f.ticks--
		if f.ticks <= 0 {
			delete(m.flames, cell)
		}
	}
}

// centreCell is the cell under the centre of a player's box.
func centreCell(pos Position) gridCell {
	return gridCell{
		col: int(math.Floor(pos.X + playerSize/2)),
		row: int(math.Floor(pos.Y + playerSize/2)),
	}
}

// finalScores lists every player's score for the end message.
func (m *Match) finalScores() []scoreData {
	scores := make([]scoreData, 0, len(m.players))
	for _, p := range m.players {
		scores = append(scores, scoreData{ID: p.ID, Nickname: p.Nickname, Score: p.Score, Lives: p.Lives})
	}
	return scores
}
