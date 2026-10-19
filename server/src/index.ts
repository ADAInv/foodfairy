import { createServer } from 'node:http';
import { readFileSync, existsSync, createReadStream, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { config } from './config.js';
import './db.js';
import { Router, HttpError, sendJson, securityHeaders, parseCookies, clientIp, type Req } from './http.js';
import { registerPublic } from './routes/public.js';
import { registerAdmin } from './routes/admin.js';
import { registerWebhooks } from './routes/webhooks.js';
import { mediaPath } from './lib/images.js';
import { metaFor, renderHead, sitemap, robots } from './seo.js';

const router = new Router();
registerPublic(router);
registerAdmin(router);
registerWebhooks(router);

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const indexPath = join(config.clientDir, 'index.html');
let indexTemplate = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
if (!indexTemplate) console.warn(`[boot] ${indexPath} not found — run "npm run build" (API still works).`);

function serveFile(res: import('node:http').ServerResponse, file: string, cache: string): boolean {
  try {
    const st = statSync(file);
    if (!st.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache
    });
    createReadStream(file).pipe(res);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (rawReq, res) => {
  const req = rawReq as Req;
  securityHeaders(res);
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    req.path = url.pathname;
    req.query = url.searchParams;
    req.cookies = parseCookies(req.headers.cookie);
    req.ip = clientIp(req);
    const method = req.method ?? 'GET';

    if (req.path.startsWith('/api/')) {
      const m = router.match(method, req.path);
      if (!m) throw new HttpError(404, 'Not found');
      await m.handler(req, res, m.params);
      return;
    }
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Method not allowed');

    if (req.path === '/robots.txt') { res.writeHead(200, { 'Content-Type': MIME['.txt']! }); return void res.end(robots()); }
    if (req.path === '/sitemap.xml') { res.writeHead(200, { 'Content-Type': 'application/xml' }); return void res.end(sitemap()); }

    // Uploaded, processed images. Strict filename pattern = no traversal.
    const media = /^\/media\/([a-f0-9]{24}-(?:\d{2,5}\.webp|og\.jpg))$/.exec(req.path);
    if (media) {
      if (serveFile(res, mediaPath(media[1]!), 'public, max-age=31536000, immutable')) return;
      throw new HttpError(404, 'Not found');
    }

    // Built client assets (hashed filenames -> cache forever).
    if (req.path.startsWith('/assets/') || /^\/[\w.-]+\.(svg|png|ico|webmanifest|txt)$/.test(req.path) || /^\/brand\/[\w-]+\.svg$/.test(req.path)) {
      const file = normalize(join(config.clientDir, req.path));
      if (!file.startsWith(config.clientDir)) throw new HttpError(404, 'Not found');
      const cache = req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
      if (serveFile(res, file, cache)) return;
      throw new HttpError(404, 'Not found');
    }

    if (req.method === "GET" && req.url === "/fairy") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
    }

    // Everything else is the SPA shell with route-specific <head>.
    if (!config.isProd && existsSync(indexPath)) indexTemplate = readFileSync(indexPath, 'utf8');
    if (!indexTemplate) throw new HttpError(503, 'Site not built yet');
    const meta = metaFor(req.path);
    const html = indexTemplate.replace(/<title>.*?<\/title>/s, '').replace('<!--ssr-head-->', renderHead(req.path, meta));
    res.writeHead(meta.status, { 'Content-Type': MIME['.html']!, 'Cache-Control': 'no-cache' });
    res.end(method === 'HEAD' ? undefined : html);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error('[error]', err);
    if (res.headersSent) return void res.end();
    sendJson(res, status, { error: status === 500 ? 'Something went wrong on our side.' : (err as Error).message });
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(config.port, config.host, () => {
  console.log(`[boot] Food Fairy on http://${config.host}:${config.port} (checkout: ${config.checkout.mode})`);
});
