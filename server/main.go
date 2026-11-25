// Command server serves the bomberman-dom client and its WebSocket endpoint.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/websocket"
)

const (
	defaultPort = "65500"
	webDir      = "web"
)

// upgrader turns an HTTP request into a WebSocket connection. Its default origin check only accepts pages served from this same host.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// serveWS upgrades one browser connection and starts its read and write goroutines.
func serveWS(hub *Hub, lobby *Lobby, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade failed: %v", err)
		return
	}

	client := newClient(hub, lobby, conn)
	hub.register(client)
	log.Printf("client connected")

	go client.writePump()
	go client.readPump()
}

// noCache makes the browser check for a newer copy of every game file on each load, so every player always runs the same, latest code.
func noCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		next.ServeHTTP(w, r)
	})
}

func main() {
	if _, err := os.Stat(webDir); err != nil {
		log.Fatalf("%s/ not found: run the server from the repository root", webDir)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	hub := newHub()

	lobby := NewLobby(hub, DefaultLobbyConfig())
	go lobby.Run()
	mux := http.NewServeMux()
	mux.Handle("/", noCache(http.FileServer(http.Dir(webDir))))
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWS(hub, lobby, w, r)
	})

	addr := ":" + port
	log.Printf("serving %s/ at http://localhost%s", webDir, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
