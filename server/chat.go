package main

import (
	"encoding/json"
	"strings"
	"time"
	"unicode/utf8"
)

const maxChatLen = 200

type chatIn struct {
	Text string `json:"text"`
}

type chatOut struct {
	Nickname string `json:"nickname"`
	Text     string `json:"text"`
	Time     int64  `json:"time"`
}

type chatRequest struct {
	client *Client
	text   string
}

// Chat asks the lobby to relay a chat message from a client.
func (l *Lobby) Chat(client *Client, text string) {
	l.chats <- chatRequest{client: client, text: text}
}

// chat checks one message and sends it to every player. It runs inside Lobby.Run, so it never races with a join or a leave.
func (l *Lobby) chat(req chatRequest) {
	player, ok := l.players[req.client]
	if !ok {
		l.sendError(req.client, "join the game before chatting")
		return
	}

	text := truncateRunes(strings.TrimSpace(req.text), maxChatLen)
	if text == "" {
		return
	}

	l.sendToPlayers(TypeChat, chatOut{
		Nickname: player.Nickname,
		Text:     text,
		Time:     time.Now().UnixMilli(),
	})
}

// truncateRunes cuts s to at most max characters, never splitting one.
func truncateRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}

// decodeChat reads the text from a chat message.
func decodeChat(raw json.RawMessage) (string, bool) {
	var data chatIn
	if err := json.Unmarshal(raw, &data); err != nil {
		return "", false
	}
	return data.Text, true
}
