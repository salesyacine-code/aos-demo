/**
 * Dedicated RBAC (Role-Based Access Control) Security Test Suite for SOA Group VII
 * Run via: node test-rbac.js
 */

const BASE_URL = process.env.GATEWAY_URL || 'http://localhost:8000';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m'
};

function pass(step, msg) {
  console.log(`${COLORS.green}  ✓ [PASS] Test ${step}: ${msg}${COLORS.reset}`);
}

function fail(step, msg, details) {
  console.error(`${COLORS.red}  ✗ [FAIL] Test ${step}: ${msg}${COLORS.reset}`);
  if (details) console.error(details);
  process.exit(1);
}

async function runRbacTests() {
  console.log(`\n${COLORS.bold}${COLORS.cyan}======================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}🔐 SOA Group VII — Role-Based Access Control (RBAC) Verification${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}======================================================${COLORS.reset}\n`);

  // Step 1: Student Persona Login
  let studentToken = null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: 'user-std-1' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.role !== 'ROLE_STUDENT' || !data.token) throw new Error('Invalid token/role received');
    studentToken = data.token;
    pass(1, `Authenticated as Student (${data.user.fullName}). Role: ${data.role}`);
  } catch (err) {
    fail(1, 'Failed student authentication', err);
  }

  // Step 2: Registrar Persona Login
  let registrarToken = null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: 'user-reg-1' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.role !== 'ROLE_REGISTRAR' || !data.token) throw new Error('Invalid token/role received');
    registrarToken = data.token;
    pass(2, `Authenticated as Registrar Officer (${data.user.fullName}). Role: ${data.role}`);
  } catch (err) {
    fail(2, 'Failed registrar authentication', err);
  }

  // Step 3: Auditor Persona Login
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: 'user-aud-1' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.role !== 'ROLE_AUDITOR') throw new Error('Expected ROLE_AUDITOR');
    pass(3, `Authenticated as Ministry Auditor (${data.user.fullName}). Role: ${data.role}`);
  } catch (err) {
    fail(3, 'Failed auditor authentication', err);
  }

  // Step 4: Token Validation Endpoint (/api/auth/me)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const me = await res.json();
    if (me.user.role !== 'ROLE_STUDENT') throw new Error('Decoded payload mismatch');
    pass(4, `Token verification (/api/auth/me) validated cryptographic signature and claims`);
  } catch (err) {
    fail(4, 'Token verification failed', err);
  }

  // Create a test request to use for decision security tests
  let testRequestId = null;
  try {
    const subRes = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: '1',
        documentType: 'CERTIFICATE_OF_ENROLLMENT',
        purpose: 'RBAC Security Boundary Testing'
      })
    });
    const reqData = await subRes.json();
    testRequestId = reqData.id;
  } catch (err) {
    fail('Setup', 'Could not create test request', err);
  }

  // Step 5: Anonymous Request Blocked (401 Unauthorized)
  try {
    const res = await fetch(`${BASE_URL}/api/requests/${testRequestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' })
    });
    if (res.status === 401) {
      pass(5, `Anonymous attempt without token blocked: HTTP 401 Unauthorized`);
    } else {
      fail(5, `Expected HTTP 401 for anonymous request, got HTTP ${res.status}`);
    }
  } catch (err) {
    fail(5, 'Unexpected error on anonymous check', err);
  }

  // Step 6: Student Role Blocked from Deciding (403 Forbidden)
  try {
    const res = await fetch(`${BASE_URL}/api/requests/${testRequestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ status: 'APPROVED', comment: 'Student attempting self-approval' })
    });
    if (res.status === 403) {
      const data = await res.json();
      pass(6, `Privilege Escalation Prevented: Student attempt blocked with HTTP 403 Forbidden ("${data.error}")`);
    } else {
      fail(6, `Expected HTTP 403 Forbidden for ROLE_STUDENT, but got HTTP ${res.status}`);
    }
  } catch (err) {
    fail(6, 'Unexpected error on student privilege check', err);
  }

  // Step 7: Tampered Token Blocked (401 Unauthorized)
  try {
    const fakeToken = studentToken.slice(0, -6) + 'XXXXXX';
    const res = await fetch(`${BASE_URL}/api/requests/${testRequestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${fakeToken}`
      },
      body: JSON.stringify({ status: 'APPROVED' })
    });
    if (res.status === 401) {
      pass(7, `Cryptographic Integrity Enforced: Tampered JWT token rejected with HTTP 401 Unauthorized`);
    } else {
      fail(7, `Expected HTTP 401 for tampered token, got HTTP ${res.status}`);
    }
  } catch (err) {
    fail(7, 'Unexpected error on tampered token check', err);
  }

  // Step 8: Registrar Role Authorized (200 OK)
  try {
    const res = await fetch(`${BASE_URL}/api/requests/${testRequestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${registrarToken}`
      },
      body: JSON.stringify({
        status: 'APPROVED',
        comment: 'Official approval by authenticated Registrar Officer'
      })
    });
    if (res.status === 200) {
      const approvalData = await res.json();
      pass(8, `Registrar Authority Granted: Approved request successfully with HTTP 200 OK (Actor: ${approvalData.request.history.slice(-1)[0].actor})`);
    } else {
      fail(8, `Expected HTTP 200 for ROLE_REGISTRAR, got HTTP ${res.status}`);
    }
  } catch (err) {
    fail(8, 'Unexpected error on registrar approval', err);
  }

  console.log(`\n${COLORS.bold}${COLORS.green}======================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.green}🎉 ALL 8 RBAC SECURITY ENFORCEMENT TESTS PASSED!${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.green}======================================================${COLORS.reset}\n`);
}

runRbacTests().catch(console.error);

