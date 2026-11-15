import crypto from 'crypto';

export const JWT_SECRET = process.env.JWT_SECRET || 'soa-group7-super-secret-jwt-key-2026';

export const ROLES = {
  STUDENT: 'ROLE_STUDENT',
  REGISTRAR: 'ROLE_REGISTRAR',
  AUDITOR: 'ROLE_AUDITOR'
};

export const PERMISSIONS = {
  [ROLES.STUDENT]: [
    'requests:create',
    'requests:read:own',
    'documents:read:own'
  ],
  [ROLES.REGISTRAR]: [
    'requests:read:all',
    'requests:decide', // Approve or Reject
    'documents:read:all',
    'students:read:all'
  ],
  [ROLES.AUDITOR]: [
    'requests:read:all',
    'documents:read:all',
    'notifications:read:all',
    'audit:read'
  ]
};

// Mock Persona Users for quick demonstration
export const PRECONFIGURED_USERS = [
  {
    id: 'user-std-1',
    username: 'amedini',
    password: 'password123',
    fullName: 'Abderrazak Medini',
    role: ROLES.STUDENT,
    studentId: '1',
    studentNumber: 'STD-2024-0001',
    email: 'amedini@esi.dz'
  },
  {
    id: 'user-std-2',
    username: 'ysalles',
    password: 'password123',
    fullName: 'Yacine Salles',
    role: ROLES.STUDENT,
    studentId: '2',
    studentNumber: 'STD-2024-0002',
    email: 'ysalles@esi.dz'
  },
  {
    id: 'user-reg-1',
    username: 'registrar',
    password: 'adminpassword',
    fullName: 'Dr. Karima Benali (Academic Registrar)',
    role: ROLES.REGISTRAR,
    department: 'Registrar Office & Student Affairs',
    email: 'registrar@esi.dz'
  },
  {
    id: 'user-aud-1',
    username: 'auditor',
    password: 'auditpassword',
    fullName: 'Inspector Youssef Cherif',
    role: ROLES.AUDITOR,
    department: 'Ministry Quality & Compliance Audit',
    email: 'audit@mesrs.gov.dz'
  }
];

// Helper: Base64Url encode/decode
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf-8');
}

/**
 * Generate standard HMAC-SHA256 JWT Token
 */
export function generateToken(user, expiresInSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    studentId: user.studentId || null,
    studentNumber: user.studentNumber || null,
    email: user.email,
    permissions: PERMISSIONS[user.role] || [],
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify JWT Token and return payload
 */
export function verifyToken(token) {
  if (!token) throw new Error('Token is missing');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT token format');

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSig) {
    throw new Error('Invalid token cryptographic signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('JWT token has expired');
  }

  return payload;
}

/**
 * Express Middleware: Require Authentication
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access denied: Valid Authorization Bearer JWT token required.'
    });
  }

  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: `Invalid authentication token: ${err.message}`
    });
  }
}

/**
 * Express Middleware: Require specific role(s)
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Operation requires one of roles [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
}
