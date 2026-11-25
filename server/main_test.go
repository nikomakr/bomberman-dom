package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWebFilesAreNotCached(t *testing.T) {
	files := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	rec := httptest.NewRecorder()

	noCache(files).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/src/main.js", nil))
	if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
		t.Fatalf("expected Cache-Control no-cache, got %q", got)
	}
}
