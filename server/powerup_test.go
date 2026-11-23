package main

import "testing"

// ownsBomb reports whether any bomb on the map belongs to the player.
func ownsBomb(m *Match, p *MatchPlayer) bool {
	for _, b := range m.bombs {
		if b.owner == p {
			return true
		}
	}
	return false
}

func TestOneUpAddsALife(t *testing.T) {
	m, p := newTestMatch()
	m.powerUps[centreCell(p.Position)] = &powerUp{id: 1, kind: powerUpLife}

	m.collectPowerUps()
	if p.Lives != startLives+1 {
		t.Fatalf("expected %d lives, got %d", startLives+1, p.Lives)
	}
}

func TestOneUpStopsAtMaxLives(t *testing.T) {
	_, p := newTestMatch()
	for i := 0; i < maxLives+3; i++ {
		powerUpEffects[powerUpLife](p)
	}
	if p.Lives != maxLives {
		t.Fatalf("expected at most %d lives, got %d", maxLives, p.Lives)
	}
}

func TestDetonatorExplodesOnlyOwnBombs(t *testing.T) {
	m, ann, bob, _ := newPauseMatch()
	m.powerUps[centreCell(ann.Position)] = &powerUp{id: 1, kind: powerUpDetonator}
	m.collectPowerUps()
	if !ann.detonator {
		t.Fatal("expected collecting the Detonator to give it to the player")
	}
	m.placeBomb(ann.client)
	m.placeBomb(bob.client)

	m.detonate(ann.client)
	m.step()
	if ownsBomb(m, ann) {
		t.Fatal("expected ann's bomb to explode on the next tick")
	}
	if !ownsBomb(m, bob) {
		t.Fatal("expected bob's bomb to keep its fuse")
	}
}

func TestDetonateNeedsTheDetonator(t *testing.T) {
	m, _, bob, _ := newPauseMatch()
	m.placeBomb(bob.client)

	m.detonate(bob.client)
	m.step()
	if !ownsBomb(m, bob) {
		t.Fatal("expected nothing to happen without the Detonator")
	}
}

func TestRestartTakesTheDetonatorAway(t *testing.T) {
	m, ann, bob, _ := newPauseMatch()
	ann.detonator = true

	pause(m, ann, actionPause)
	pause(m, bob, actionRestart)
	if ann.detonator {
		t.Fatal("expected a restart to take the Detonator away")
	}
}

func TestBonusPowerUpsDropAtRandom(t *testing.T) {
	m, _ := newTestMatch()
	cells := make([]gridCell, 400)
	for i := range cells {
		cells[i] = gridCell{col: i % 20, row: i / 20}
	}

	m.dropPowerUps(cells)
	seen := map[powerUpKind]bool{}
	for _, pu := range m.powerUps {
		seen[pu.kind] = true
	}
	for _, kind := range powerUpKinds {
		if !seen[kind] {
			t.Fatalf("expected %q among the dropped power-ups", kind)
		}
	}
}
