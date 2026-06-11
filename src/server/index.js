import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, getClientConfig } from './config.js';
import { createOutput } from './output.js';
import { ControllerState } from './state.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clientDir = path.join(rootDir, 'dist/client');
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const config = await loadConfig();
const controller = new ControllerState(config);
const output = createOutput(config);
const clients = new Set();

let lastOutputError = 0;

function publicState() {
  return {
    ...controller.publicState,
    output: output.publicState
  };
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function writeStateToClients() {
  const payload = `data: ${JSON.stringify(publicState())}\n\n`;
  for (const client of clients) client.write(payload);
}

function publishState() {
  controller.render();
  writeStateToClients();
}

async function handleApi(request, response) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    });
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === 'GET' && url.pathname === '/api/state') {
      controller.render();
      sendJson(response, 200, publicState());
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/config') {
      sendJson(response, 200, getClientConfig(config));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/power') {
      const body = await readJsonBody(request);
      controller.setPower(body.power);
      publishState();
      sendJson(response, 200, publicState());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/mode') {
      const body = await readJsonBody(request);
      controller.setMode(body.mode);
      publishState();
      sendJson(response, 200, publicState());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/output') {
      output.set(await readJsonBody(request));
      publishState();
      sendJson(response, 200, publicState());
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/manual/clear') {
      controller.clearManual();
      publishState();
      sendJson(response, 200, publicState());
      return;
    }

    const manualMatch = url.pathname.match(/^\/api\/manual\/([^/]+)(\/clear)?$/);
    if (request.method === 'POST' && manualMatch) {
      const elementId = decodeURIComponent(manualMatch[1]);
      if (manualMatch[2]) {
        controller.clearManual(elementId);
      } else {
        controller.setManual(elementId, await readJsonBody(request));
      }
      publishState();
      sendJson(response, 200, publicState());
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const safePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(clientDir, safePath);

  if (!filePath.startsWith(clientDir)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml'
    }[ext] ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': contentType });
    response.end(content);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url.startsWith('/api/')) {
    await handleApi(request, response);
    return;
  }

  if (request.url === '/events') {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'access-control-allow-origin': '*'
    });
    clients.add(response);
    controller.render();
    response.write(`data: ${JSON.stringify(publicState())}\n\n`);
    request.on('close', () => clients.delete(response));
    return;
  }

  await serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Deflector control listening on http://${host}:${port}`);
});

const intervalMs = Math.round(1000 / config.defaults.frameRate);
setInterval(async () => {
  const snapshot = controller.render();
  writeStateToClients();
  try {
    await output.send(snapshot.frame);
  } catch (error) {
    const now = Date.now();
    if (now - lastOutputError > 5000) {
      lastOutputError = now;
      console.error(`[output] ${error.message}`);
    }
  }
}, intervalMs);
