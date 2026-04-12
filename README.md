# Qwen-Discord Bridge

Bridge Qwen CLI with Discord channels for seamless AI assistant integration.

## Features

- 🔗 Connect Qwen CLI to any Discord channel
- 💬 Bidirectional communication: Discord → Qwen → Discord
- 🔄 Persistent Qwen session with conversation context
- ⚙️ Configurable via `.env` file
- 🚀 Simple CLI interface

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here
QWEN_APPROVAL_MODE=yolo
```

### 4. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token to `DISCORD_TOKEN` in `.env`
5. Enable these **Privileged Gateway Intents**:
   - Message Content Intent
6. Invite the bot to your server using OAuth2 URL generator (select `bot` scope with `Send Messages` and `Read Message History` permissions)
7. Get the target channel ID (Developer Mode → Right-click channel → Copy ID) and set `DISCORD_CHANNEL_ID`

### 5. Run

```bash
# Start the bot
npx qwen-discord start

# Check configuration
npx qwen-discord info
```

## Usage

Once the bot is running, simply send messages in the configured Discord channel. The bot will:

1. Receive your message
2. Send it to Qwen CLI
3. Return Qwen's response back to the channel

### Commands

| Command | Description |
|---------|-------------|
| `npx qwen-discord start` | Start the bridge bot |
| `npx qwen-discord info` | Show current configuration |

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | Discord bot token (required) | - |
| `ALLOWED_CHANNEL_IDS` | Allowed channel IDs, comma-separated (required) | - |
| `ALLOWED_USER_IDS` | Allowed user IDs, comma-separated | All users |
| `QWEN_APPROVAL_MODE` | Qwen approval mode | `yolo` |
| `QWEN_WORKING_DIR` | Qwen working directory | Current directory |
| `LOG_LEVEL` | Log level | `info` |

### Approval Modes

- `yolo`: Auto-approve all actions (recommended for trusted environments)
- `auto_edit`: Auto-approve file edits
- `default`: Manual approval required

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Discord    │────▶│  Bridge Bot  │────▶│  Qwen CLI   │
│  Channel    │◀────│  (Node.js)   │◀────│  (spawn)    │
└─────────────┘     └──────────────┘     └─────────────┘
     │                    │                    │
     │  User message      │  stdin/out         │  Process
     │  → Bot             │  JSON stream       │  stream-json
```

## Development

```bash
# Development mode with hot reload
npm run dev

# Build
npm run build
```

## License

MIT
