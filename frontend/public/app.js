// Frontend Client Logic for SOA Group VII (Medini Abderrazak & Salles Yacine)
// Supports Same-Origin Proxying, Direct Gateway Fallback, and RBAC Personas

const GATEWAY_URL = window.ENV?.GATEWAY_URL !== undefined ? window.ENV.GATEWAY_URL : '';

let currentStudents = [];
let allRequests = [];
let currentFilter = 'ALL';
let currentUser = null;
let authToken = null;

// Universal fetch helper: tries relative same-origin /api first, falls back to direct http://localhost:8000
async function apiFetch(path, options = {}) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return fetch(path, options);
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const candidates = [
    cleanPath,
    `http://localhost:8000${cleanPath}`,
    `http://127.0.0.1:8000${cleanPath}`
  ];

  let lastRes = null;
  let lastErr = null;

  for (const targetUrl of candidates) {
    try {
      const res = await fetch(targetUrl, {
        ...options,
        signal: AbortSignal.timeout(5000)
      });
      // If we got a valid response (not 502/504 gateway error), return it
      if (res.status !== 502 && res.status !== 504) {
        return res;
      }
      lastRes = res;
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastRes) return lastRes;
  throw lastErr || new Error(`Failed to reach ${cleanPath}`);
}

// ==========================================
// RBAC Persona Authentication & Security
// ==========================================
async function initAuth(personaId = 'user-reg-1') {
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    authToken = data.token;
    currentUser = data.user;
    currentUser.role = data.role;
    currentUser.permissions = data.permissions;

    syncPersonaDropdowns(personaId);
    updateRbacUI();
  } catch (err) {
    console.error('[Auth] Failed to initialize persona:', err);
    // Offline / Mock fallback for RBAC identity
    const FALLBACK_PERSONAS = {
      'user-reg-1': { id: 'user-reg-1', fullName: 'Dr. Karima Benali', role: 'ROLE_REGISTRAR', title: 'Registrar Officer' },
      'user-std-1': { id: 'user-std-1', fullName: 'Abderrazak Medini', studentId: 1, role: 'ROLE_STUDENT', title: 'Student #1' },
      'user-std-2': { id: 'user-std-2', fullName: 'Yacine Salles', studentId: 2, role: 'ROLE_STUDENT', title: 'Student #2' },
      'user-aud-1': { id: 'user-aud-1', fullName: 'Inspector Cherif', role: 'ROLE_AUDITOR', title: 'Ministry Auditor' }
    };
    currentUser = FALLBACK_PERSONAS[personaId] || FALLBACK_PERSONAS['user-reg-1'];
    syncPersonaDropdowns(personaId);
    updateRbacUI();
  }
}

function syncPersonaDropdowns(personaId) {
  const headerSelect = document.getElementById('persona-select');
  const mainSelect = document.getElementById('persona-select-main');
  if (headerSelect) headerSelect.value = personaId;
  if (mainSelect) mainSelect.value = personaId;
}

async function onPersonaChanged() {
  const select = document.getElementById('persona-select');
  await handlePersonaSwitch(select.value);
}

async function onMainPersonaChanged() {
  const select = document.getElementById('persona-select-main');
  await handlePersonaSwitch(select.value);
}

async function handlePersonaSwitch(personaId) {
  syncPersonaDropdowns(personaId);
  await initAuth(personaId);
  showToast(`Active Persona: ${currentUser.fullName} (${currentUser.role})`, 'info');
  renderRequestsTable();

  // If student persona, auto-select them in Student Request tab
  if (currentUser.role === 'ROLE_STUDENT' && currentUser.studentId) {
    const stdSelect = document.getElementById('student-select');
    if (stdSelect) {
      stdSelect.value = currentUser.studentId;
      onStudentSelected();
    }
  }
}

function updateRbacUI() {
  if (!currentUser) return;

  // 1. Update Header Role Badge
  const headerBadge = document.getElementById('role-badge-header');
  if (headerBadge) {
    headerBadge.textContent = currentUser.role;
    if (currentUser.role === 'ROLE_REGISTRAR') {
      headerBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    } else if (currentUser.role === 'ROLE_STUDENT') {
      headerBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      headerBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30';
    }
  }

  // 2. Update Main Prominent RBAC Card
  const pillMain = document.getElementById('role-pill-main');
  const descMain = document.getElementById('role-desc-main');
  const policyText = document.getElementById('role-policy-text');

  if (pillMain && descMain && policyText) {
    pillMain.textContent = currentUser.role;
    if (currentUser.role === 'ROLE_REGISTRAR') {
      pillMain.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-400 text-amber-950 shadow-sm';
      descMain.textContent = `Authenticated as ${currentUser.fullName} — Registrar Officer (Full Decision Authority)`;
      policyText.innerHTML = `<span>⚡</span> <span><strong>Active Authority:</strong> You have full administrative permission to <strong>APPROVE</strong> or <strong>REJECT</strong> student requests under Administration Review.</span>`;
    } else if (currentUser.role === 'ROLE_STUDENT') {
      pillMain.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-400 text-emerald-950 shadow-sm';
      descMain.textContent = `Authenticated as ${currentUser.fullName} — Student Persona (Restricted to Submissions)`;
      policyText.innerHTML = `<span>🔒</span> <span><strong>Restricted Access:</strong> Students can submit document requests. Decision buttons are <strong>disabled</strong>; API attempts return <strong>HTTP 403 Forbidden</strong>.</span>`;
    } else {
      pillMain.className = 'px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-300 text-purple-950 shadow-sm';
      descMain.textContent = `Authenticated as ${currentUser.fullName} — Ministry Auditor (Read-Only Inspection)`;
      policyText.innerHTML = `<span>👁️</span> <span><strong>Audit Mode:</strong> Read-only access to view historical requests, certificates, and system event logs.</span>`;
    }
  }

  // 3. Update Admin Dashboard Banner
  const banner = document.getElementById('rbac-admin-banner');
  const bannerIcon = document.getElementById('rbac-banner-icon');
  const bannerText = document.getElementById('rbac-banner-text');
  const bannerBadge = document.getElementById('rbac-banner-badge');

  if (banner && bannerIcon && bannerText && bannerBadge) {
    if (currentUser.role === 'ROLE_REGISTRAR') {
      banner.className = 'mb-4 p-3 rounded-lg border text-xs flex items-center justify-between bg-emerald-50 border-emerald-200 text-emerald-900';
      bannerIcon.textContent = '🛡️';
      bannerText.innerHTML = `<strong>Full Administrative Authority:</strong> You are authenticated as <em>${currentUser.fullName}</em> with authority to approve or reject document requests.`;
      bannerBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-200 text-emerald-800';
      bannerBadge.textContent = 'AUTHORITY: DECISION_MAKER';
    } else if (currentUser.role === 'ROLE_STUDENT') {
      banner.className = 'mb-4 p-3 rounded-lg border text-xs flex items-center justify-between bg-amber-50 border-amber-200 text-amber-900';
      bannerIcon.textContent = '🔒';
      bannerText.innerHTML = `<strong>Read-Only Access:</strong> You are signed in as Student <em>${currentUser.fullName}</em>. Request decision buttons are disabled by the RBAC Policy.`;
      bannerBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-800';
      bannerBadge.textContent = 'ROLE_STUDENT: RESTRICTED';
    } else {
      banner.className = 'mb-4 p-3 rounded-lg border text-xs flex items-center justify-between bg-purple-50 border-purple-200 text-purple-900';
      bannerIcon.textContent = '🧐';
      bannerText.innerHTML = `<strong>Auditor Inspection Mode:</strong> You are reviewing historical requests and notifications in read-only audit mode.`;
      bannerBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-200 text-purple-800';
      bannerBadge.textContent = 'ROLE_AUDITOR: READ_ONLY';
    }
  }
}

// Visual BPMN-Style 4-Stage Workflow Stepper
function renderWorkflowStepper(status) {
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';
  const isSubmitted = status === 'SUBMITTED';

  return `
    <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
      <!-- Step 1: Submission -->
      <div class="flex items-center gap-1 text-emerald-700 font-semibold">
        <span class="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-[9px]">✓</span>
        <span>1. Submitted</span>
      </div>
      <div class="h-0.5 w-6 ${isSubmitted ? 'bg-amber-300 animate-pulse' : 'bg-emerald-400'}"></div>

      <!-- Step 2: Registrar Review -->
      <div class="flex items-center gap-1 ${isSubmitted ? 'text-amber-700 font-semibold animate-pulse' : isApproved ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}">
        <span class="w-4 h-4 rounded-full ${isSubmitted ? 'bg-amber-100 border border-amber-300' : isApproved ? 'bg-emerald-100 border border-emerald-300' : 'bg-red-100 border border-red-300'} flex items-center justify-center text-[9px]">
          ${isApproved ? '✓' : isRejected ? '✕' : '⏳'}
        </span>
        <span>2. Review</span>
      </div>
      <div class="h-0.5 w-6 ${isApproved ? 'bg-emerald-400' : 'bg-slate-200'}"></div>

      <!-- Step 3: PDF & QR Code -->
      <div class="flex items-center gap-1 ${isApproved ? 'text-emerald-700 font-semibold' : 'text-slate-400'}">
        <span class="w-4 h-4 rounded-full ${isApproved ? 'bg-emerald-100 border border-emerald-300' : 'bg-slate-100 border border-slate-200'} flex items-center justify-center text-[9px]">
          ${isApproved ? '✓' : '3'}
        </span>
        <span>3. PDF & QR</span>
      </div>
      <div class="h-0.5 w-6 ${isApproved ? 'bg-emerald-400' : 'bg-slate-200'}"></div>

      <!-- Step 4: Email Dispatch -->
      <div class="flex items-center gap-1 ${isApproved ? 'text-emerald-700 font-semibold' : isRejected ? 'text-emerald-700 font-semibold' : 'text-slate-400'}">
        <span class="w-4 h-4 rounded-full ${isApproved || isRejected ? 'bg-emerald-100 border border-emerald-300' : 'bg-slate-100 border border-slate-200'} flex items-center justify-center text-[9px]">
          ${isApproved || isRejected ? '✓' : '4'}
        </span>
        <span>4. Notification</span>
      </div>
    </div>
  `;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth('user-reg-1');
  await loadStudents();
  loadAllRequests();
  loadGeneratedDocuments();
  checkSystemHealth();

  // Periodic background refresh for admin table & document repository
  setInterval(() => {
    loadAllRequests(false);
    loadGeneratedDocuments(false);
  }, 10000);
});

// Toast notification helper
function showToast(message, type = 'success') {
  const banner = document.getElementById('toast-banner');
  const msgEl = document.getElementById('toast-message');
  if (!banner || !msgEl) return;

  msgEl.innerText = message;
  banner.className = 'mb-4 p-4 rounded-lg flex items-center justify-between text-sm shadow';
  if (type === 'success') {
    banner.classList.add('bg-emerald-100', 'text-emerald-900', 'border', 'border-emerald-300');
  } else if (type === 'error') {
    banner.classList.add('bg-red-100', 'text-red-900', 'border', 'border-red-300');
  } else {
    banner.classList.add('bg-blue-100', 'text-blue-900', 'border', 'border-blue-300');
  }
  banner.classList.remove('hidden');

  setTimeout(() => hideToast(), 5000);
}

function hideToast() {
  const banner = document.getElementById('toast-banner');
  if (banner) banner.classList.add('hidden');
}

// Tab Switching
function switchTab(tabId) {
  const tabs = ['student', 'admin', 'documents', 'system'];
  tabs.forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (t === tabId) {
      if (section) section.classList.remove('hidden');
      if (btn) btn.className = 'py-3 px-2 tab-active transition';
    } else {
      if (section) section.classList.add('hidden');
      if (btn) btn.className = 'py-3 px-2 text-blue-200 hover:text-white transition';
    }
  });

  if (tabId === 'admin') loadAllRequests();
  if (tabId === 'documents') loadGeneratedDocuments();
  if (tabId === 'system') checkSystemHealth();
}

// ==========================================
// 1. Student Portal Logic (Bulletproof Loading)
// ==========================================
async function loadStudents() {
  const select = document.getElementById('student-select');
  if (!select) return;

  select.innerHTML = '<option value="">Loading students from Student Service...</option>';

  const endpoints = [
    '/api/students?limit=30',
    `${GATEWAY_URL}/api/students?limit=30`,
    'http://localhost:8000/api/students?limit=30',
    'http://127.0.0.1:8000/api/students?limit=30',
    'http://localhost:8001/api/students?limit=30'
  ];

  let studentList = [];
  let lastErr = null;

  for (const url of endpoints) {
    if (!url) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const body = await res.json();
        const items = Array.isArray(body) ? body : (body?.data || []);
        if (items.length > 0) {
          studentList = items;
          console.log(`[Students] Successfully loaded ${items.length} students from ${url}`);
          break;
        }
      } else {
        lastErr = new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      lastErr = err;
    }
  }

  // Guaranteed fallback dataset for Group VII if services are still initializing
  if (studentList.length === 0) {
    console.warn('[Students] Network fetch did not return list, using standard Group VII personas:', lastErr);
    studentList = [
      {
        id: 1,
        studentNumber: 'STD-2024-0001',
        firstName: 'Abderrazak',
        lastName: 'Medini',
        fullName: 'Abderrazak Medini',
        email: 'amedini@esi.dz',
        birthDate: '2002-04-15',
        phone: '+213 555 123 456',
        university: 'ESI Algiers',
        program: 'Master in Service-Oriented Computing & Cloud',
        enrollmentYear: 2024,
        status: 'ACTIVE',
        academicRecord: { overallGpa: 17.5, mention: 'Très Bien', currentSemester: 'S3' }
      },
      {
        id: 2,
        studentNumber: 'STD-2024-0002',
        firstName: 'Yacine',
        lastName: 'Salles',
        fullName: 'Yacine Salles',
        email: 'ysalles@esi.dz',
        birthDate: '2001-11-20',
        phone: '+213 555 123 456',
        university: 'ESI Algiers',
        program: 'Master in Software Engineering & Distributed Systems',
        enrollmentYear: 2024,
        status: 'ACTIVE',
        academicRecord: { overallGpa: 17.2, mention: 'Très Bien', currentSemester: 'S3' }
      },
      {
        id: 3,
        studentNumber: 'STD-2024-0003',
        firstName: 'Amine',
        lastName: 'Kaddour',
        fullName: 'Amine Kaddour',
        email: 'akaddour@usthb.dz',
        birthDate: '2002-08-12',
        phone: '+213 555 123 456',
        university: 'USTHB',
        program: 'Bachelor in Information Systems',
        enrollmentYear: 2024,
        status: 'ACTIVE',
        academicRecord: { overallGpa: 14.8, mention: 'Bien', currentSemester: 'S5' }
      },
      {
        id: 4,
        studentNumber: 'STD-2024-0004',
        firstName: 'Sarah',
        lastName: 'Benali',
        fullName: 'Sarah Benali',
        email: 'sbenali@ensia.edu.dz',
        birthDate: '2003-01-30',
        phone: '+213 555 123 456',
        university: 'ENSIA',
        program: 'Master in Cybersecurity & Network Architecture',
        enrollmentYear: 2024,
        status: 'ACTIVE',
        academicRecord: { overallGpa: 16.9, mention: 'Très Bien', currentSemester: 'S3' }
      },
      {
        id: 5,
        studentNumber: 'STD-2024-0005',
        firstName: 'Karim',
        lastName: 'Mansouri',
        fullName: 'Karim Mansouri',
        email: 'kmansouri@enp.edu.dz',
        birthDate: '2001-09-05',
        phone: '+213 555 123 456',
        university: 'ENP',
        program: 'Master in Service-Oriented Computing & Cloud',
        enrollmentYear: 2024,
        status: 'ACTIVE',
        academicRecord: { overallGpa: 15.6, mention: 'Bien', currentSemester: 'S3' }
      }
    ];
  }

  currentStudents = studentList;
  select.innerHTML = '<option value="">-- Choose a Student --</option>';
  currentStudents.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.fullName} (${s.studentNumber}) - ${s.university}`;
    select.appendChild(opt);
  });

  if (currentUser?.role === 'ROLE_STUDENT' && currentUser.studentId) {
    select.value = currentUser.studentId;
  } else {
    select.value = currentStudents[0].id;
  }
  onStudentSelected();
}

function onStudentSelected() {
  const select = document.getElementById('student-select');
  const studentId = select.value;
  const preview = document.getElementById('student-preview');

  if (!studentId) {
    preview.classList.add('hidden');
    return;
  }

  const student = currentStudents.find(s => String(s.id) === String(studentId));
  if (!student) return;

  document.getElementById('preview-name').textContent = student.fullName;
  document.getElementById('preview-id').textContent = student.studentNumber;
  document.getElementById('preview-email').textContent = student.email;
  document.getElementById('preview-univ').textContent = student.university;
  document.getElementById('preview-program').textContent = student.program;
  document.getElementById('preview-gpa').textContent = `${student.academicRecord?.overallGpa || '15.0'} / 20`;
  document.getElementById('preview-mention').textContent = student.academicRecord?.mention || 'Bien';

  preview.classList.remove('hidden');
  loadStudentRequests(studentId);
}

async function submitDocumentRequest(event) {
  event.preventDefault();
  const studentId = document.getElementById('student-select').value;
  const documentType = document.querySelector('input[name="documentType"]:checked').value;
  const purpose = document.getElementById('request-purpose').value;

  if (!studentId) {
    showToast('Please select a student first.', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit-request');
  btn.disabled = true;
  btn.innerHTML = 'Submitting...';

  try {
    const res = await apiFetch('/api/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify({ studentId, documentType, purpose })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const created = await res.json();
    showToast(`Request ${created.requestNumber} submitted with status SUBMITTED!`, 'success');
    document.getElementById('request-purpose').value = '';

    loadStudentRequests(studentId);
    loadAllRequests(false);
  } catch (err) {
    showToast(`Failed to submit request: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🚀</span> Submit Request to Administration';
  }
}

async function loadStudentRequests(studentId) {
  const container = document.getElementById('student-requests-container');
  try {
    const res = await apiFetch(`/api/requests?studentId=${studentId}`);
    if (!res.ok) return;
    const data = await res.json();
    const reqs = data.data || [];

    if (reqs.length === 0) {
      container.innerHTML = '<div class="text-slate-400 italic">No previous requests found for this student.</div>';
      return;
    }

    container.innerHTML = reqs.map(r => `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-bold text-slate-700">${r.requestNumber}</span>
            <span class="text-slate-500 ml-2">(${r.documentType.replace(/_/g, ' ')})</span>
            <div class="text-slate-400 text-[11px]">${new Date(r.createdAt).toLocaleString()}</div>
          </div>
          <div class="flex items-center gap-2">
            ${renderStatusBadge(r.status)}
            ${r.status === 'APPROVED' ? `
              <a href="/api/documents/${r.id}/download" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[11px] font-semibold">
                📥 Download PDF
              </a>
            ` : ''}
          </div>
        </div>
        ${renderWorkflowStepper(r.status)}
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-red-400">Error loading student requests: ${err.message}</div>`;
  }
}

// ==========================================
// 2. Admin Review Dashboard
// ==========================================
async function loadAllRequests(showLoading = true) {
  const tbody = document.getElementById('admin-requests-tbody');
  if (!tbody) return;
  if (showLoading) tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-400">Loading requests...</td></tr>';

  try {
    const res = await apiFetch('/api/requests?limit=100');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allRequests = data.data || [];
    renderRequestsTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-red-500">Error loading requests: ${err.message}</td></tr>`;
  }
}

function filterRequestsTable(status) {
  currentFilter = status;
  ['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED'].forEach(s => {
    const btn = document.getElementById(`filter-${s.toLowerCase()}`);
    if (btn) {
      if (s === status) {
        btn.className = 'px-3 py-1 rounded-full bg-slate-800 text-white font-semibold';
      } else {
        btn.className = 'px-3 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200';
      }
    }
  });
  renderRequestsTable();
}

function renderRequestsTable() {
  const tbody = document.getElementById('admin-requests-tbody');
  if (!tbody) return;

  let list = [...allRequests];
  if (currentFilter !== 'ALL') {
    list = list.filter(r => r.status === currentFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-400">No requests in this category.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="py-3 px-3 align-top">
        <span class="font-semibold text-slate-800">${r.requestNumber}</span>
      </td>
      <td class="py-3 px-3 align-top">
        <div class="font-medium text-slate-800">${r.studentSummary?.fullName || 'N/A'}</div>
        <div class="text-[11px] text-slate-400">${r.studentSummary?.studentNumber || ''}</div>
      </td>
      <td class="py-3 px-3 align-top font-mono text-[11px] text-blue-900">${r.documentType.replace(/_/g, ' ')}</td>
      <td class="py-3 px-3 align-top text-slate-600">${r.purpose || '—'}</td>
      <td class="py-3 px-3 align-top">
        ${renderStatusBadge(r.status)}
        ${renderWorkflowStepper(r.status)}
      </td>
      <td class="py-3 px-3 align-top text-slate-400 text-[11px] whitespace-nowrap">${new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td class="py-3 px-3 align-top text-right space-x-1.5 whitespace-nowrap">
        ${r.status === 'SUBMITTED' ? `
          ${currentUser?.role === 'ROLE_REGISTRAR' ? `
            <button onclick="approveRequest('${r.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2.5 py-1 rounded shadow-sm text-[11px] transition">
              ✓ Approve
            </button>
            <button onclick="rejectRequest('${r.id}')" class="bg-red-600 hover:bg-red-700 text-white font-medium px-2.5 py-1 rounded shadow-sm text-[11px] transition">
              ✕ Reject
            </button>
          ` : `
            <span class="inline-flex items-center gap-1 text-slate-400 text-[11px] italic bg-slate-100 px-2 py-1 rounded border border-slate-200" title="Only Registrar Officers with ROLE_REGISTRAR have permission to approve/reject">
              <span>🔒</span> Registrar Only
            </span>
          `}
        ` : r.status === 'APPROVED' ? `
          <a href="/api/documents/${r.id}/download" target="_blank" class="text-blue-600 hover:underline font-semibold text-[11px]">
            📥 Download PDF
          </a>
        ` : `
          <span class="text-slate-400 text-[11px] italic">Closed</span>
        `}
      </td>
    </tr>
  `).join('');
}

async function approveRequest(requestId) {
  const comment = prompt('Optional remarks for approval:', 'All academic conditions satisfied.');
  if (comment === null) return;

  try {
    const res = await apiFetch(`/api/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify({
        status: 'APPROVED',
        comment,
        actor: currentUser?.fullName || 'Dr. Karima Benali'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) {
        showToast(`⛔ RBAC Denied (HTTP 403): ${data.message || 'Forbidden'}`, 'error');
        return;
      }
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }

    showToast('Request APPROVED! RabbitMQ event published -> PDF generating -> Email dispatching.', 'success');
    loadAllRequests(false);
    loadGeneratedDocuments(false);
  } catch (err) {
    showToast(`Approval failed: ${err.message}`, 'error');
  }
}

async function rejectRequest(requestId) {
  const rejectionReason = prompt('Reason for rejection:', 'Missing required prerequisite documentation.');
  if (!rejectionReason) return;

  try {
    const res = await apiFetch(`/api/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify({
        status: 'REJECTED',
        rejectionReason,
        actor: currentUser?.fullName || 'Dr. Karima Benali'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) {
        showToast(`⛔ RBAC Denied (HTTP 403): ${data.message || 'Forbidden'}`, 'error');
        return;
      }
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }

    showToast('Request REJECTED! Notification email dispatched.', 'error');
    loadAllRequests(false);
  } catch (err) {
    showToast(`Rejection failed: ${err.message}`, 'error');
  }
}

// ==========================================
// 3. Document Repository & QR Verification
// ==========================================
async function loadGeneratedDocuments(showLoading = true) {
  const tbody = document.getElementById('documents-tbody');
  if (!tbody) return;
  if (showLoading) tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-400">Loading documents...</td></tr>';

  try {
    const res = await apiFetch('/api/documents');
    if (!res.ok) return;
    const docs = await res.json();

    if (!docs || docs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-400">No documents generated yet. Approve a request to generate one!</td></tr>';
      return;
    }

    tbody.innerHTML = docs.map(d => `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-2.5 px-3 font-mono font-bold text-blue-900 cursor-pointer hover:underline" onclick="fillVerifyInput('${d.documentId}')">
          ${d.documentId}
        </td>
        <td class="py-2.5 px-3 text-slate-600 font-semibold">${d.requestNumber}</td>
        <td class="py-2.5 px-3 text-slate-700">${d.studentName}</td>
        <td class="py-2.5 px-3 font-mono text-[11px] text-blue-800">${d.documentType.replace(/_/g, ' ')}</td>
        <td class="py-2.5 px-3 text-slate-500 text-[11px]">${new Date(d.generatedAt).toLocaleString()}</td>
        <td class="py-2.5 px-3 text-right space-x-2">
          <a href="/verify.html?doc=${encodeURIComponent(d.documentId)}" target="_blank" class="text-emerald-700 hover:underline font-semibold text-[11px]">
            🛡️ Verify Online
          </a>
          <a href="/api/documents/${d.requestId}/preview" target="_blank" class="text-blue-600 hover:underline font-medium">Preview</a>
          <a href="/api/documents/${d.requestId}/download" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[11px]">Download</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-500">Error loading documents: ${err.message}</td></tr>`;
  }
}

function fillVerifyInput(docId) {
  const input = document.getElementById('verify-input');
  if (input) {
    input.value = docId;
    verifyDocumentId();
  }
}

async function verifyDocumentId() {
  const docId = document.getElementById('verify-input').value.trim();
  const resultBox = document.getElementById('verify-result');

  if (!docId) {
    resultBox.className = 'mt-4 p-4 rounded-lg text-xs bg-amber-50 text-amber-800 border border-amber-200';
    resultBox.innerHTML = 'Please enter a Document ID to verify.';
    resultBox.classList.remove('hidden');
    return;
  }

  try {
    const res = await apiFetch(`/api/documents/verify/${encodeURIComponent(docId)}`);
    const data = await res.json();

    if (res.ok && data.valid) {
      resultBox.className = 'mt-4 p-4 rounded-lg text-xs bg-emerald-50 text-emerald-900 border border-emerald-300';
      resultBox.innerHTML = `
        <div class="font-bold text-sm text-emerald-800 flex items-center gap-1">
          <span>✅</span> Authenticated Official Document
        </div>
        <div class="mt-2 space-y-1">
          <div><strong>Student:</strong> ${data.document.studentName} (${data.document.studentNumber})</div>
          <div><strong>Document Type:</strong> ${data.document.documentType}</div>
          <div><strong>Request Number:</strong> ${data.document.requestNumber}</div>
          <div><strong>Issued Timestamp:</strong> ${data.document.generatedAt}</div>
        </div>
      `;
    } else {
      resultBox.className = 'mt-4 p-4 rounded-lg text-xs bg-red-50 text-red-900 border border-red-300';
      resultBox.innerHTML = `
        <div class="font-bold text-sm text-red-800 flex items-center gap-1">
          <span>❌</span> Verification Failed
        </div>
        <p class="mt-1">${data.message || 'Document ID not found in official university registry.'}</p>
      `;
    }
  } catch (err) {
    resultBox.className = 'mt-4 p-4 rounded-lg text-xs bg-red-50 text-red-900 border border-red-300';
    resultBox.innerHTML = `Error checking verification: ${err.message}`;
  }
  resultBox.classList.remove('hidden');
}

// ==========================================
// 4. System Health Monitor
// ==========================================
async function checkSystemHealth() {
  const grid = document.getElementById('health-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="text-xs text-slate-400">Pinging all services via Gateway...</div>';

  try {
    const res = await apiFetch('/health');
    const data = await res.json();

    grid.innerHTML = (data.services || []).map(s => `
      <div class="p-4 border rounded-xl bg-white shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="font-bold text-xs text-slate-800">${s.name}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'UP' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${s.status}
            </span>
          </div>
          <div class="text-[11px] text-slate-500 font-mono">${s.url}</div>
        </div>
        <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Latency:</span>
          <span class="font-semibold text-slate-700">${s.latencyMs !== undefined ? `${s.latencyMs} ms` : 'N/A'}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="p-4 border rounded-lg bg-red-50 text-red-700 text-xs col-span-4">Failed to reach API Gateway: ${err.message}</div>`;
  }
}

function renderStatusBadge(status) {
  if (status === 'APPROVED') {
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold status-badge-approved">APPROVED</span>';
  }
  if (status === 'REJECTED') {
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold status-badge-rejected">REJECTED</span>';
  }
  return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold status-badge-submitted">SUBMITTED</span>';
}
