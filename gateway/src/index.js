import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import { gatewaySwaggerDocument } from './swaggerAggregator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

const STUDENT_SERVICE_URL = process.env.STUDENT_SERVICE_URL || 'http://localhost:8001';
const REQUEST_SERVICE_URL = process.env.REQUEST_SERVICE_URL || 'http://localhost:8002';
const DOCUMENT_SERVICE_URL = process.env.DOCUMENT_SERVICE_URL || 'http://localhost:8003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8004';

app.use(cors());
app.use(morgan('dev'));

// Swagger UI aggregated documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(gatewaySwaggerDocument, {
  customSiteTitle: 'Unified API Gateway Docs — Group VII'
}));

// Global System Healthcheck
app.get('/health', async (req, res) => {
  const probe = async (name, url) => {
    try {
      const start = Date.now();
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
      const latencyMs = Date.now() - start;
      if (response.ok) {
        const body = await response.json();
        return { name, url, status: 'UP', latencyMs, details: body };
      }
      return { name, url, status: 'DEGRADED', latencyMs, statusCode: response.status };
    } catch (err) {
      return { name, url, status: 'DOWN', error: err.message };
    }
  };

  const results = await Promise.all([
    probe('student-service', STUDENT_SERVICE_URL),
    probe('request-service', REQUEST_SERVICE_URL),
    probe('document-service', DOCUMENT_SERVICE_URL),
    probe('notification-service', NOTIFICATION_SERVICE_URL)
  ]);

  const allHealthy = results.every(r => r.status === 'UP');

  res.status(allHealthy ? 200 : 207).json({
    status: allHealthy ? 'UP' : 'PARTIALLY_AVAILABLE',
    timestamp: new Date().toISOString(),
    gatewayPort: PORT,
    services: results
  });
});

// Reverse Proxy Configuration using pathFilter so Express does NOT strip prefixes
const makeProxy = (pathFilter, target) => createProxyMiddleware({
  target,
  pathFilter,
  changeOrigin: true,
  logLevel: 'debug',
  on: {
    error: (err, req, res) => {
      console.error(`[Gateway Proxy Error] Target: ${target}, Path: ${req.url}, Error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: `Downstream service at ${target} is unreachable.`,
          details: err.message
        });
      }
    }
  }
});

app.use(makeProxy('/api/students', STUDENT_SERVICE_URL));
app.use(makeProxy('/api/requests', REQUEST_SERVICE_URL));
app.use(makeProxy('/api/documents', DOCUMENT_SERVICE_URL));
app.use(makeProxy('/api/notifications', NOTIFICATION_SERVICE_URL));

// Fallback route
app.get('/', (req, res) => {
  res.json({
    name: 'E-Government Administrative Services API Gateway',
    version: '1.0.0',
    group: 'Group VII',
    theme: 'Administrative document request workflow',
    endpoints: {
      documentation: '/docs',
      systemHealth: '/health',
      studentsApi: '/api/students',
      requestsApi: '/api/requests',
      documentsApi: '/api/documents',
      notificationsApi: '/api/notifications'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 [API Gateway] Running on port ${PORT}`);
  console.log(`📖 [API Gateway] Unified Swagger Docs: http://localhost:${PORT}/docs`);
  console.log(`🩺 [API Gateway] Health check: http://localhost:${PORT}/health`);
});

