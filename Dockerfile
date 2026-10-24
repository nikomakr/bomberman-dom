
# Build stage
FROM golang:1.25.2-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY server ./server

RUN CGO_ENABLED=0 GOOS=linux go build -o /bomberman-dom ./server

# Runtime stage
FROM alpine:3.22

WORKDIR /app

COPY --from=builder /bomberman-dom ./bomberman-dom
COPY web ./web

EXPOSE 65500

ENV PORT=65500

CMD ["./bomberman-dom"]
