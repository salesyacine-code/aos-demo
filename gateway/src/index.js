import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import { gatewaySwaggerDocument } from './swaggerAggregator.js';
import {
  ROLES,
  PERMISSIONS,
  PRECONFIGURED_USERS,
  generateToken,
  verifyToken
} from '../../shared/auth.js';

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

// ==========================================
// Authentication & RBAC Identity Service
// ==========================================
app.use('/api/auth', express.json());

// GET /api/auth/personas - List pre-configured demo personas
app.get('/api/auth/personas', (req, res) => {
  const safePersonas = PRECONFIGURED_USERS.map(({ password, ...u }) => u);
  res.json(safePersonas);
});

// POST /api/auth/login - Authenticate persona or username/password
app.post('/api/auth/login', (req, res) => {
  const { username, password, personaId } = req.body;

  let user = null;
  if (personaId) {
    user = PRECONFIGURED_USERS.find(u => u.id === personaId);
  } else if (username) {
    user = PRECONFIGURED_USERS.find(u => u.username === username);
    if (user && password && user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials', message: 'Incorrect password.' });
    }
  }

  if (!user) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'User identity not found in National Academic Registry.'
    });
  }

  const token = generateToken(user);
  const { password: _, ...safeUser } = user;

  res.json({
    message: 'Authentication successful',
    token,
    user: safeUser,
    role: user.role,
    permissions: PERMISSIONS[user.role] || []
  });
});

// GET /api/auth/me - Verify active session and permissions
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No Bearer token provided.' });
  }

  try {
    const payload = verifyToken(token);
    res.json({
      authenticated: true,
      user: payload
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token', message: err.message });
  }
});

// ==========================================
// RBAC Gatekeeper Middleware for Decisions
// ==========================================
// Intercept status transition attempts to enforce that only ROLE_REGISTRAR can decide requests
app.patch('/api/requests/:id/status', express.json(), (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access Denied: Authentication token required to perform administrative decisions.'
    });
  }

  try {
    const user = verifyToken(token);
    if (user.role !== ROLES.REGISTRAR) {
      console.warn(`[RBAC Violation] User ${user.username} (${user.role}) attempted to modify request ${req.params.id}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: `RBAC Violation: Role "${user.role}" does not have permission to approve or reject requests. Requires "${ROLES.REGISTRAR}".`,
        userRole: user.role,
        requiredRole: ROLES.REGISTRAR
      });
    }

    // Set actor name from validated token if not provided
    if (!req.body.actor) {
      req.body.actor = user.fullName;
    }

    // Forward directly to request-service
    fetch(`${REQUEST_SERVICE_URL}/api/requests/${req.params.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.sub,
        'x-user-role': user.role,
        'x-user-name': user.fullName
      },
      body: JSON.stringify(req.body)
    })
      .then(async downstreamRes => {
        const data = await downstreamRes.json();
        res.status(downstreamRes.status).json(data);
      })
      .catch(err => {
        res.status(502).json({ error: 'Bad Gateway', message: err.message });
      });
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: `Invalid token: ${err.message}` });
  }
});

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
    security: 'Role-Based Access Control (RBAC) enabled',
    endpoints: {
      authLogin: '/api/auth/login',
      authMe: '/api/auth/me',
      authPersonas: '/api/auth/personas',
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
  console.log(`🔐 [API Gateway] RBAC security enabled`);
  console.log(`📖 [API Gateway] Unified Swagger Docs: http://localhost:${PORT}/docs`);
  console.log(`🩺 [API Gateway] Health check: http://localhost:${PORT}/health`);
});
