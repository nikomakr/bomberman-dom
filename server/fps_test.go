package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestDecodeFPS(t *testing.T) {
	raw := json.RawMessage(`{"nickname":"p1","browser":"Firefox","average":59.84,"slowest":18.2,"dropped":1,"window":"switched"}`)
	r, ok := decodeFPS(raw)
	if !ok {
		t.Fatal("expected a valid report")
	}
	line := r.String()
	for _, part := range []string{`"p1"`, "(Firefox)", "avg  59.8", "slowest  18.2 ms", "dropped 1", "window switched"} {
		if !strings.Contains(line, part) {
			t.Fatalf("expected %q in %q", part, line)
		}
	}
}

func TestDecodeFPSRejectsBadReports(t *testing.T) {
	for _, raw := range []string{`not json`, `{"nickname":"p1","average":0}`} {
		if _, ok := decodeFPS(json.RawMessage(raw)); ok {
			t.Fatalf("expected %s to be rejected", raw)
		}
	}
}
