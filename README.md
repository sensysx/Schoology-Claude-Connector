# Schoology-Claude-Connector

An MCP (Model Context Protocol) server that connects Claude to your Schoology account, letting you read your courses and assignments directly in Claude.

Runs as an HTTP server — host it on your home server and connect to it from Claude Desktop or claude.ai.

## Setup on your home server

### 1. Clone the repo

```bash
git clone https://github.com/your-username/Schoology-Claude-Connector
cd Schoology-Claude-Connector
```

### 2. Configure credentials

```bash
cp .env.example .env
```

Edit `.env` with your Schoology API credentials:
- Go to **Schoology > Settings > API Access**
- Copy your **Consumer Key** and **Consumer Secret**

### 3. Run with Docker Compose

```bash
docker compose up -d
```

That's it. Portainer will show it as a running container. The server listens on port `3000`.

### 4. Expose it with a public URL

If you already use a reverse proxy (Nginx Proxy Manager, Traefik, etc.) just point a subdomain at port `3000` on the container.

Otherwise the easiest option is **Cloudflare Tunnel** (free):

```bash
cloudflared tunnel --url http://localhost:3000
```

### 5. Connect in Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "schoology": {
      "type": "http",
      "url": "https://your-server-url/mcp"
    }
  }
}
```

Or add it via **Claude.ai > Connectors > Add custom connector** and paste `https://your-server-url/mcp`.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_profile` | Your Schoology user profile |
| `get_courses` | All your courses/sections |
| `get_assignments` | Assignments for a specific course (requires `section_id`) |
| `get_all_assignments` | All assignments across every course |
| `get_upcoming_assignments` | Only upcoming assignments, sorted by due date |

## Example prompts

- "What assignments do I have due this week?"
- "List all my Schoology courses"
- "What's my most urgent assignment?"

## Health check

Visit `http://localhost:3000/health` to verify the server is running.
