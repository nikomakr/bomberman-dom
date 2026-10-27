package main

import (
	"log"
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
// Guards access to the clients map with a mutex.
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

// broadcast sends a message to all clients in the hub's clients map.
func (h *Hub) broadcast(message []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for client := range h.clients {
		h.queue(client, message)
	}
}

// sendTo queues a message for one specific client as long as the client is still registered in the hub.
func (h *Hub) sendTo(client *Client, message []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; ok {
		h.queue(client, message)
	}
}

// queue sends a message to a client's send channel. If the channel is full, it logs a warning and closes the connection.
func (h *Hub) queue(client *Client, message []byte) {
	select {
	case client.send <- message:
	default:
		log.Printf("send queue full for client, closing connection")
		delete(h.clients, client)
		close(client.send)
	}
}
