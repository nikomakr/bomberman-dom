package main

import (
	"log"
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages to the clients. Guards access to the clients map with a mutex.
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]bool
}

func newHub() *Hub {
	return &Hub{
		clients: make(map[*Client]bool),
	}
}

// register adds a client to the hub's clients map.
func (h *Hub) register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[client] = true
}

// unregister removes a client from the hub's clients map and closes its send channel.
func (h *Hub) unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.send)
	}
}

// broadcast sends a message to all clients in the hub's clients map. It uses a read lock to allow concurrent broadcasts while preventing modifications to the clients map.
func (h *Hub) broadcast(message []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for client := range h.clients {
		select {
		case client.send <- message:
		default:
			log.Printf("Send queue failed for client, closing connection")
			close(client.send)
		}
	}
}
