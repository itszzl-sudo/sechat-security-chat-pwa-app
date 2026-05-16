# SeChatbot ↔ sechat API Protocol

## Overview
SeChatbot communicates with the sechat server via REST API and WebSocket.

## Authentication
Every request includes headers: `X-Bot-API-Key` and `X-Bot-Secret`.

## Endpoints (Bot → Server)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bot/auth` | Authenticate bot, get userId |
| POST | `/api/bot/users/:userId/sponsor-role` | Update sponsor role |
| POST | `/api/bot/messages` | Send message as bot |
| POST | `/api/bot/broadcast` | Broadcast to all users |
| GET | `/api/users/:username` | Lookup user by username |
| GET | `/api/health` | Server health check |

## Endpoints (Server → Bot)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sponsor/update` | Bot notifies role change |
| POST | `/api/version/heartbeat` | Client reports version |
| GET | `/api/sponsor/effects` | Get active sponsor list |

## WebSocket Events
The bot connects to `ws://<server>/ws/bot?token=<key>` and receives:
- `message` - New chat message
- `user_status` - User online/offline
- `sponsor_update` - Sponsor role change
- `friend_request` - Friend request
- `system` - System notification
