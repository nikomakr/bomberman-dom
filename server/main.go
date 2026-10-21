package main

import (
	"log"
	"net/http"
	"os"
)

const (
	defaultPort = "65500"
	webDir      = "web"
)

func main() {
	if _, err := os.Stat(webDir); err != nil {
		log.Fatalf("%s/ not found: run the server from the repository root", webDir)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir(webDir)))

	addr := ":" + port
	log.Printf("serving %s/ at http://localhost%s", webDir, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
