import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';

app.use(express.static(path.join(__dirname, 'public')));

// Pass runtime environment config to frontend client
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.ENV = { GATEWAY_URL: "${GATEWAY_URL}" };`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`💻 [Frontend] Client application running on http://localhost:${PORT}`);
  console.log(`🔗 [Frontend] Connected to API Gateway at ${GATEWAY_URL}`);
});

