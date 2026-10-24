package main

import "encoding/json"

// Message types exchanged between the browser and the server.
// Every type name lives here, so client and server use the same words.
const (
	TypeJoin      = "join"
	TypeLobby     = "lobby"
	TypeCountdown = "countdown"
	TypeStart     = "start"
	TypeState     = "state"
	TypeInput     = "input"
	TypeBomb      = "bomb"
	TypeChat      = "chat"
	TypeError     = "error"
	TypeEnd       = "end"
	TypePause     = "pause"
)

var knownTypes = map[string]bool{
	TypeJoin: true, TypeLobby: true, TypeCountdown: true, TypeStart: true,
	TypeState: true, TypeInput: true, TypeBomb: true, TypeChat: true,
	TypeError: true, TypeEnd: true, TypePause: true,
}

// Message is the envelope for every WebSocket message:
type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// IsKnownType reports whether t is one of the message types above.
func IsKnownType(t string) bool {
	return knownTypes[t]
}

// NewMessage builds an encoded message of the given type, with data encoded as JSON.
func NewMessage(msgType string, data any) ([]byte, error) {
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return json.Marshal(Message{Type: msgType, Data: raw})
}
