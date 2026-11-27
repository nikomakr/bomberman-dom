package main

import (
	"encoding/json"
	"fmt"
)

// fpsReport is the frame rate a tab opened with ?fps sends every 2 seconds
// during a match. The server only prints it, so the frame rate of every
// player, in every browser and on every laptop, shows in one terminal.
type fpsReport struct {
	Nickname string  `json:"nickname"`
	Browser  string  `json:"browser"`
	Average  float64 `json:"average"` // frames per second
	Slowest  float64 `json:"slowest"` // milliseconds
	Dropped  int     `json:"dropped"` // frames slower than 20 ms
	Window   string  `json:"window"`  // front, behind, or switched (focus moved to or from it)
}

// decodeFPS reads a report. Names are cut so a long one cannot flood the log.
func decodeFPS(raw json.RawMessage) (fpsReport, bool) {
	var r fpsReport
	if err := json.Unmarshal(raw, &r); err != nil || r.Average <= 0 {
		return fpsReport{}, false
	}
	r.Nickname = cut(r.Nickname, maxNicknameLen)
	r.Browser = cut(r.Browser, 10)
	r.Window = cut(r.Window, 8)
	return r, true
}

// String is the line printed in the terminal.
func (r fpsReport) String() string {
	return fmt.Sprintf("fps %-14q %-9s avg %5.1f  slowest %5.1f ms  dropped %-2d window %s",
		r.Nickname, "("+r.Browser+")", r.Average, r.Slowest, r.Dropped, r.Window)
}

// cut keeps at most max characters.
func cut(s string, max int) string {
	runes := []rune(s)
	if len(runes) > max {
		return string(runes[:max])
	}
	return s
}
