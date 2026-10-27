package main

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second    // longest time to write one message
	pongWait       = 60 * time.Second    // longest silence allowed from the browser
	pingPeriod     = (pongWait * 9) / 10 // how often to ping; must be under pongWait
	maxMessageSize = 4096                // largest message accepted, in bytes
	sendQueueSize  = 256                 // messages waiting to be sent per client
)

// Client is one connected browser: its connection and its send queue.
type Client struct {
	hub   *Hub
	lobby *Lobby
	conn  *websocket.Conn
	send  chan []byte
}

// newClient creates a client for a new connection.
func newClient(hub *Hub, lobby *Lobby, conn *websocket.Conn) *Client {
	return &Client{hub: hub, lobby: lobby, conn: conn, send: make(chan []byte, sendQueueSize)}
}

// readPump reads messages from the browser until the connection closes,
// then removes the client from the lobby and the hub.
func (c *Client) readPump() {
	defer func() {
		c.lobby.Leave(c)
		c.hub.unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("read error: %v", err)
			}
			return
		}
		c.handle(data)
	}
}

// handle decodes one message and passes it on. Invalid JSON and unknown
// types are logged and ignored, so a bad message never stops the server.
func (c *Client) handle(data []byte) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("ignored invalid JSON: %v", err)
		return
	}
	if !IsKnownType(msg.Type) {
		log.Printf("ignored unknown message type %q", msg.Type)
		return
	}

	switch msg.Type {
	case TypeJoin:
		nickname, ok := decodeJoin(msg.Data)
		if !ok {
			log.Printf("ignored join with invalid data")
			return
		}
		c.lobby.Join(c, nickname)
	default:
		log.Printf("received %q", msg.Type)
	}
}

// writePump sends queued messages to the browser and pings it regularly.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case data, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the queue: tell the browser and stop.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
