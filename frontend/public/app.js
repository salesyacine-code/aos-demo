// Frontend Client Logic for SOA Group VII
const GATEWAY_URL = window.ENV?.GATEWAY_URL || 'http://localhost:8000';

let currentStudents = [];
let allRequests = [];
let currentFilter = 'ALL';
let currentUser = null;
let authToken = null;

// RBAC Persona Authentication
async function initAuth(personaId = 'user-reg-1') {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
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

    updateRbacUI();
  } catch (err) {
    console.error('[Auth] Failed to initialize persona:', err);
  }
}

async function onPersonaChanged() {
  const select = document.getElementById('persona-select');
  await initAuth(select.value);
  showToast(`Authenticated as ${currentUser.fullName} (${currentUser.role})`, 'info');
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

  // Update Admin Dashboard Banner
  const banner = document.getElementById('rbac-admin-banner');
  const bannerIcon = document.getElementById('rbac-banner-icon');
  const bannerText = document.getElementById('rbac-banner-text');
  const bannerBadge = document.getElementById('rbac-banner-badge');

  if (banner) {
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  loadStudents();
  loadAllRequests();
  loadGeneratedDocuments();
  checkSystemHealth();

  // Periodic background refresh for admin table
  setInterval(() => {
    loadAllRequests(false);
    loadGeneratedDocuments(false);
  }, 10000);
});

// Toast notification helper
function showToast(message, type = 'success') {
  const banner = document.getElementById('toast-banner');
  const msgEl = document.getElementById('toast-message');
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
  document.getElementById('toast-banner').classList.add('hidden');
}

// Tab Switching
function switchTab(tabId) {
  const tabs = ['student', 'admin', 'documents', 'system'];
  tabs.forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (t === tabId) {
      section.classList.remove('hidden');
      btn.className = 'py-3 px-2 tab-active transition';
    } else {
      section.classList.add('hidden');
      btn.className = 'py-3 px-2 text-blue-200 hover:text-white transition';
    }
  });

  if (tabId === 'admin') loadAllRequests();
  if (tabId === 'documents') loadGeneratedDocuments();
  if (tabId === 'system') checkSystemHealth();
}

// ==========================================
// 1. Student Portal Logic
// ==========================================
async function loadStudents() {
  const select = document.getElementById('student-select');
  select.innerHTML = '<option value="">Loading students from Student Service...</option>';

  const endpoints = [
    `${GATEWAY_URL}/api/students?limit=30`,
    'http://localhost:8000/api/students?limit=30',
    'http://127.0.0.1:8000/api/students?limit=30',
    'http://localhost:8001/api/students?limit=30'
  ];

  let data = null;
  let lastErr = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (data && data.data && data.data.length > 0) {
    currentStudents = data.data;
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
  } else {
    select.innerHTML = `<option value="">Error loading students (${lastErr?.message || 'Check Gateway connection'})</option>`;
  }
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
    const res = await fetch(`${GATEWAY_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${GATEWAY_URL}/api/requests?studentId=${studentId}`);
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
              <a href="${GATEWAY_URL}/api/documents/${r.id}/download" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[11px] font-semibold">
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
  if (showLoading) tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-400">Loading requests...</td></tr>';

  try {
    const res = await fetch(`${GATEWAY_URL}/api/requests?limit=100`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allRequests = data.data || [];
    renderRequestsTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-red-500">Error: ${err.message}</td></tr>`;
  }
}

function filterRequestsTable(status) {
  currentFilter = status;
  ['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED'].forEach(s => {
    const btn = document.getElementById(`filter-${s.toLowerCase()}`);
    if (s === status) {
      btn.className = 'px-3 py-1 rounded-full bg-slate-800 text-white font-semibold';
    } else {
      btn.className = 'px-3 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200';
    }
  });
  renderRequestsTable();
}

function renderRequestsTable() {
  const tbody = document.getElementById('admin-requests-tbody');
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
          <a href="${GATEWAY_URL}/api/documents/${r.id}/download" target="_blank" class="text-blue-600 hover:underline font-semibold text-[11px]">
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
    const res = await fetch(`${GATEWAY_URL}/api/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify({
        status: 'APPROVED',
        comment,
        actor: currentUser?.fullName || 'Academic Officer'
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
    const res = await fetch(`${GATEWAY_URL}/api/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify({
        status: 'REJECTED',
        rejectionReason,
        actor: currentUser?.fullName || 'Academic Officer'
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

  try {
    const res = await fetch(`${GATEWAY_URL}/api/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', rejectionReason, actor: 'Academic Officer' })
    });

    if (!res.ok) throw new Error((await res.json()).error);
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
  if (showLoading) tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-400">Loading documents...</td></tr>';

  try {
    const res = await fetch(`${GATEWAY_URL}/api/documents`);
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
        <td class="py-2.5 px-3 text-slate-600">${d.requestNumber}</td>
        <td class="py-2.5 px-3 font-medium text-slate-800">${d.studentName}</td>
        <td class="py-2.5 px-3 text-[11px] font-semibold text-slate-500">${d.documentType.replace('_', ' ')}</td>
        <td class="py-2.5 px-3 text-slate-400 text-[11px]">${new Date(d.generatedAt).toLocaleString()}</td>
        <td class="py-2.5 px-3 text-right space-x-2">
          <a href="/verify.html?doc=${encodeURIComponent(d.documentId)}" target="_blank" class="text-emerald-700 hover:underline font-semibold text-[11px]">
            🛡️ Verify Online
          </a>
          <a href="${GATEWAY_URL}/api/documents/${d.requestId}/preview" target="_blank" class="text-blue-600 hover:underline font-medium">Preview</a>
          <a href="${GATEWAY_URL}/api/documents/${d.requestId}/download" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[11px]">Download</a>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-red-500">Error loading documents: ${err.message}</td></tr>`;
  }
}

function fillVerifyInput(docId) {
  document.getElementById('verify-input').value = docId;
  verifyDocumentId();
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
    const res = await fetch(`${GATEWAY_URL}/api/documents/verify/${encodeURIComponent(docId)}`);
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
  grid.innerHTML = '<div class="text-xs text-slate-400">Pinging all services via Gateway...</div>';

  try {
    const res = await fetch(`${GATEWAY_URL}/health`);
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

