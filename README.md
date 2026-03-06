# Schoology-Claude-Connector

An MCP (Model Context Protocol) server that connects Claude to your Schoology account, letting you read your courses and assignments directly in Claude.

Runs as an HTTP server — host it on your home server and connect to it from Claude Desktop or claude.ai.

## Setup with Portainer

No files need to be copied to your server — Portainer pulls directly from GitHub and you enter your secrets in the UI.

### 1. Create a new Stack

1. Open Portainer and go to **Stacks → Add stack**
2. Give it a name (e.g. `schoology-connector`)
3. Select **Repository** as the build method
4. Set the repository URL to your GitHub repo URL
5. Set the compose path to `docker-compose.yml`

### 2. Add environment variables

Scroll down to the **Environment variables** section and add:

| Variable | Value |
|----------|-------|
| `SCHOOLOGY_CONSUMER_KEY` | your key from Schoology |
| `SCHOOLOGY_CONSUMER_SECRET` | your secret from Schoology |
| `PORT` | `3000` (or any port you want) |

To get your credentials: **Schoology > Settings > API Access**

### 3. Deploy

Click **Deploy the stack**. Portainer will pull the repo, build the image, and start the container.

### 4. Expose it with a public URL

If you already use a reverse proxy (Nginx Proxy Manager, Traefik, etc.) point a subdomain at the port you chose.

Otherwise the easiest option is **Cloudflare Tunnel** (free, no port forwarding needed):

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
