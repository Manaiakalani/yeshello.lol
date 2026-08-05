/**
 * Minimal static file server that mirrors the Azure Static Web Apps behaviour
 * declared in staticwebapp.config.json.
 *
 * Playwright previously ran against the live production site, which meant tests
 * could never catch a regression in the code under review. Serving the working
 * tree locally - with the real CSP and 404 rewrite applied - makes the suite
 * validate the actual commit.
 *
 * Zero dependencies on purpose: the repo is a plain static site and this keeps
 * CI fast and reproducible.
 *
 * Usage: node scripts/static-server.mjs [--port 4280] [--root .]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const ROOT = normalize(arg('root', join(fileURLToPath(new URL('.', import.meta.url)), '..')));
const PORT = Number(arg('port', process.env.PORT || 4280));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
};

const config = JSON.parse(await readFile(join(ROOT, 'staticwebapp.config.json'), 'utf8'));
const globalHeaders = config.globalHeaders ?? {};
const notFoundRewrite = config.responseOverrides?.['404']?.rewrite ?? null;

/** Resolve a SWA route pattern (supports a single trailing `*`) to its headers. */
function routeHeaders(pathname) {
  for (const route of config.routes ?? []) {
    const pattern = route.route ?? '';
    const matches = pattern.endsWith('/*')
      ? pathname.startsWith(pattern.slice(0, -1))
      : pattern === pathname;
    if (matches) return route.headers ?? {};
  }
  return {};
}

/** Reject paths that escape ROOT (e.g. `/../secrets`). */
function safeResolve(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const resolved = normalize(join(ROOT, decoded));
  if (resolved !== ROOT && !resolved.startsWith(ROOT + sep)) return null;
  return resolved;
}

async function readIfFile(filePath) {
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) return null;
    return await readFile(filePath);
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  let pathname = url.pathname;
  if (pathname.endsWith('/')) pathname += 'index.html';

  const headers = { ...globalHeaders, ...routeHeaders(pathname) };

  const resolved = safeResolve(pathname);
  let body = resolved ? await readIfFile(resolved) : null;
  let status = 200;

  if (body === null) {
    status = 404;
    const fallback = notFoundRewrite ? safeResolve(notFoundRewrite) : null;
    body = fallback ? await readIfFile(fallback) : null;
    pathname = notFoundRewrite ?? pathname;
    if (body === null) body = Buffer.from('Not Found');
  }

  res.writeHead(status, {
    ...headers,
    'Content-Type': MIME[extname(pathname).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': body.length,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Static server (SWA config applied) on http://127.0.0.1:${PORT}`);
});
