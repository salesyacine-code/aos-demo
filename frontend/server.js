import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Candidates for gateway address (Docker container network first, then localhost fallback)
const GATEWAY_CANDIDATES = [
  process.env.GATEWAY_URL,
  'http://gateway:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8000'
].filter(Boolean);

// Aggressive cache disabling so browsers and proxies always receive latest UI
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Pass runtime environment config to frontend client
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  // Use relative URL by default for same-origin proxying, with direct gateway fallback
  res.send(`window.ENV = { GATEWAY_URL: "" };`);
});

// Same-Origin Proxy: Forward all /api/* requests to API Gateway
app.use('/api', async (req, res) => {
  const reqPath = req.url; // e.g. "/students?limit=30"
  let lastError = null;

  const headers = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      headers[key] = val;
    }
  }

  let bodyBuffer = null;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    if (chunks.length > 0) {
      bodyBuffer = Buffer.concat(chunks);
      headers['content-length'] = String(bodyBuffer.length);
    }
  }

  for (const baseUrl of GATEWAY_CANDIDATES) {
    const targetUrl = `${baseUrl}/api${reqPath}`;
    try {
      const options = {
        method: req.method,
        headers,
        signal: AbortSignal.timeout(6000)
      };
      if (bodyBuffer) {
        options.body = bodyBuffer;
      }

      const downstreamRes = await fetch(targetUrl, options);
      res.status(downstreamRes.status);
      downstreamRes.headers.forEach((val, key) => {
        if (!['transfer-encoding', 'content-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });

      const buffer = await downstreamRes.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (err) {
      lastError = err;
      // Try next candidate
    }
  }

  console.error(`[Frontend Proxy Error] Failed all candidates for /api${reqPath}:`, lastError?.message);
  res.status(502).json({
    error: 'Gateway Unreachable',
    message: lastError?.message || 'Failed to connect to API Gateway',
    tried: GATEWAY_CANDIDATES
  });
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`💻 [Frontend] Client application running on http://localhost:${PORT}`);
  console.log(`🔗 [Frontend] Gateway targets: ${GATEWAY_CANDIDATES.join(', ')}`);
});
