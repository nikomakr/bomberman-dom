package main

import (
	"log"
	"math/rand/v2"
)

// Power-ups. A destroyed block may drop one. Walking over it collects it and
// applies its effect; a flame destroys one nobody has collected yet.

const (
	dropChance = 0.3 // chance that a destroyed block drops a power-up
	speedStep  = 1.0 // tiles per second added by a Speed power-up
	maxSpeed   = 8.0 // fastest a player can go, in tiles per second
	maxLives   = 5   // most lives a player can have with 1 Up power-ups
)

type powerUpKind string

const (
	powerUpBombs     powerUpKind = "bomb"
	powerUpFlame     powerUpKind = "flame"
	powerUpSpeed     powerUpKind = "speed"
	powerUpLife      powerUpKind = "life"      // bonus: 1 Up
	powerUpDetonator powerUpKind = "detonator" // bonus: Detonator
)

// powerUpKinds lists every kind, in a fixed order, for the random pick.
var powerUpKinds = []powerUpKind{powerUpBombs, powerUpFlame, powerUpSpeed, powerUpLife, powerUpDetonator}

// powerUpEffects is the data that says what each kind does to a player.
// Adding a power-up means adding a kind and one entry here.
var powerUpEffects = map[powerUpKind]func(p *MatchPlayer){
	powerUpBombs:     func(p *MatchPlayer) { p.bombsMax++ },
	powerUpFlame:     func(p *MatchPlayer) { p.bombRange++ },
	powerUpSpeed:     func(p *MatchPlayer) { p.speed = min(p.speed+speedStep, maxSpeed) },
	powerUpLife:      func(p *MatchPlayer) { p.Lives = min(p.Lives+1, maxLives) },
	powerUpDetonator: func(p *MatchPlayer) { p.detonator = true },
}

// powerUp is one power-up lying on the map.
type powerUp struct {
	id   int
	kind powerUpKind
}

// powerUpData tells clients a power-up appeared.
type powerUpData struct {
	ID   int         `json:"id"`
	Kind powerUpKind `json:"kind"`
	Col  int         `json:"col"`
	Row  int         `json:"row"`
}

// collectedData tells clients who picked up which power-up.
type collectedData struct {
	ID     int `json:"id"`
	Player int `json:"player"`
}

// dropPowerUps gives each destroyed block a chance to leave a power-up.
func (m *Match) dropPowerUps(cells []gridCell) {
	for _, c := range cells {
		if m.rng.Float64() >= dropChance {
			continue
		}
		m.placePowerUp(c, m.randomKind())
	}
}

// randomKind picks any power-up kind, each as likely as the others.
func (m *Match) randomKind() powerUpKind {
	return powerUpKinds[m.rng.IntN(len(powerUpKinds))]
}

// placePowerUp puts a power-up of the given kind on a cell and tells every
// client about it.
func (m *Match) placePowerUp(c gridCell, kind powerUpKind) {
	m.nextPowerUpID++
	pu := &powerUp{id: m.nextPowerUpID, kind: kind}
	m.powerUps[c] = pu
	m.newPowerUps = append(m.newPowerUps, powerUpData{ID: pu.id, Kind: pu.kind, Col: c.col, Row: c.row})
	log.Printf("power-up %d (%s) at (%d, %d)", pu.id, pu.kind, c.col, c.row)
}

// dropOnDeath leaves a power-up where a player lost their last life: one of
// the power-ups they collected, or a random one if they had none. A cell
// that already holds a power-up keeps it.
func (m *Match) dropOnDeath(p *MatchPlayer) {
	c := centreCell(p.Position)
	if _, taken := m.powerUps[c]; taken {
		return
	}
	kind := m.randomKind()
	if len(p.powerUps) > 0 {
		kind = p.powerUps[m.rng.IntN(len(p.powerUps))]
	}
	log.Printf("%q dropped a power-up", p.Nickname)
	m.placePowerUp(c, kind)
}

// burnPowerUp destroys a power-up a flame reaches, if there is one.
func (m *Match) burnPowerUp(c gridCell) {
	pu, ok := m.powerUps[c]
	if !ok {
		return
	}
	delete(m.powerUps, c)
	m.burntPowerUps = append(m.burntPowerUps, pu.id)
	log.Printf("power-up %d burnt", pu.id)
}

// collectPowerUps gives each player the power-up under their centre, if any.
func (m *Match) collectPowerUps() {
	for _, p := range m.players {
		if p.Lives == 0 {
			continue
		}
		c := centreCell(p.Position)
		pu, ok := m.powerUps[c]
		if !ok {
			continue
		}
		delete(m.powerUps, c)
		powerUpEffects[pu.kind](p)
		p.powerUps = append(p.powerUps, pu.kind)
		p.Score += pointsPowerUp
		m.collected = append(m.collected, collectedData{ID: pu.id, Player: p.ID})
		log.Printf("%q collected power-up %d (%s)", p.Nickname, pu.id, pu.kind)
	}
}

// newMatchRand gives each match its own random numbers, from its seed.
func newMatchRand(seed int64) *rand.Rand {
	return rand.New(rand.NewPCG(uint64(seed), uint64(seed)^0x9e3779b97f4a7c15))
}
