package main

import "github.com/gorilla/websocket"

// Client represents a single WebSocket connection to the server.
type Client struct {
	conn *websocket.Conn
	send chan []byte
}
