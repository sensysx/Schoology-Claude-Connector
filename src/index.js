import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { SchoologyClient } from './schoology.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const VERSION = '1.1.8d2';

const client = new SchoologyClient(
  process.env.SCHOOLOGY_CONSUMER_KEY,
  process.env.SCHOOLOGY_CONSUMER_SECRET
);


function createServer() {
  const server = new McpServer({
    name: 'schoology-connector',
    version: VERSION,
  });

  console.log('Created server');
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

  console.log('Registering');
  server.tool(
    'fetch_docs',
    'Get all documents for a specific course section',
    { section_id: z.string().describe('The section ID from get_courses') },
    async ({ section_id }) => {
      const data = await client.getSectionDocuments(section_id);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
  'get_test',
  'Test tool',
  {},
  async () => ({ content: [{ type: 'text', text: 'test' }] })
);
  console.log('Registered');
  return server;
}

const app = express();
app.use(express.json());

// Log every incoming request so we can debug
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// OAuth 2.1 + PKCE flow — auto-approves so Claude.ai completes auth without user login

app.get('/.well-known/oauth-protected-resource', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({ resource: base, authorization_servers: [base] });
});

app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({ resource: base, authorization_servers: [base] });
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
  });
});

// Auto-approve: immediately redirect back with a dummy auth code
app.get('/authorize', (req, res) => {
  const { redirect_uri, state } = req.query;
  if (!redirect_uri) return res.status(400).send('Missing redirect_uri');
  const code = 'schoology-auth-code';
  const url = new URL(redirect_uri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.post('/register', (_req, res) => {
  res.json({
    client_id: 'schoology-mcp-client',
    grant_types: ['authorization_code'],
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    token_endpoint_auth_method: 'none',
  });
});

app.post('/token', (_req, res) => {
  res.json({
    access_token: `schoology-token-${Date.now()}`,
    token_type: 'bearer',
    expires_in: 300,
  });
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
    res.json({ status: 'ok', user: me , version: VERSION});
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.get('/tools-debug', (req, res) => {
  const server = createServer();
  res.json({ tools: Object.keys(server._registeredTools) });
});

app.listen(PORT, () => {
  console.log(`Schoology MCP server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Version: ${VERSION}`);
});
