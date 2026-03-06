import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { SchoologyClient } from './schoology.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

const client = new SchoologyClient(
  process.env.SCHOOLOGY_CONSUMER_KEY,
  process.env.SCHOOLOGY_CONSUMER_SECRET
);

function createServer() {
  const server = new McpServer({
    name: 'schoology-connector',
    version: '1.0.0',
  });

  server.tool(
    'get_profile',
    'Get your Schoology user profile',
    {},
    async () => {
      const me = await client.getMe();
      return { content: [{ type: 'text', text: JSON.stringify(me, null, 2) }] };
    }
  );

  server.tool(
    'get_courses',
    'Get all your Schoology courses/sections',
    {},
    async () => {
      const sections = await client.getSections();
      return { content: [{ type: 'text', text: JSON.stringify(sections, null, 2) }] };
    }
  );

  server.tool(
    'get_assignments',
    'Get assignments for a specific course section',
    { section_id: z.string().describe('The section ID from get_courses') },
    async ({ section_id }) => {
      const assignments = await client.getAssignments(section_id);
      return { content: [{ type: 'text', text: JSON.stringify(assignments, null, 2) }] };
    }
  );

  server.tool(
    'get_all_assignments',
    'Get all assignments across all your courses',
    {},
    async () => {
      const data = await client.getAllAssignments();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_upcoming_assignments',
    'Get only upcoming (not yet due) assignments sorted by due date',
    {},
    async () => {
      const data = await client.getUpcomingAssignments();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

// Log every incoming request so we can debug
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on('close', () => server.close());
});

app.get('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res);
  res.on('close', () => server.close());
});

app.delete('/mcp', async (req, res) => {
  res.status(200).end();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'schoology-connector' });
});

app.get('/debug', async (_req, res) => {
  try {
    const me = await client.getMe();
    res.json({ status: 'ok', user: me });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Schoology MCP server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
