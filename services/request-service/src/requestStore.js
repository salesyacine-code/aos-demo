import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'requests.json');

export const VALID_STATUSES = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

export const ALLOWED_TRANSITIONS = {
  [VALID_STATUSES.SUBMITTED]: [VALID_STATUSES.APPROVED, VALID_STATUSES.REJECTED],
  [VALID_STATUSES.APPROVED]: [], // Terminal state
  [VALID_STATUSES.REJECTED]: []  // Terminal state
};

class RequestStore {
  constructor() {
    this.requests = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.requests = JSON.parse(raw);
        console.log(`[RequestStore] Loaded ${this.requests.length} requests from ${DATA_FILE}`);
      } else {
        this.requests = [];
        this.save();
        console.log(`[RequestStore] Initialized empty request file at ${DATA_FILE}`);
      }
    } catch (err) {
      console.error(`[RequestStore] Error loading data:`, err.message);
      this.requests = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.requests, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[RequestStore] Error saving requests:`, err.message);
    }
  }

  getAll({ status = '', studentId = '', page = 1, limit = 50 } = {}) {
    let result = [...this.requests];

    if (status) {
      result = result.filter(r => r.status.toUpperCase() === status.toUpperCase());
    }

    if (studentId) {
      result = result.filter(r => String(r.studentId) === String(studentId));
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = result.length;
    const startIndex = (page - 1) * limit;
    const paginated = result.slice(startIndex, startIndex + limit);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
      data: paginated
    };
  }

  getById(id) {
    return this.requests.find(r => r.id === id || r.requestNumber === id);
  }

  create({ studentId, student, documentType, purpose = '' }) {
    const nextSeq = this.requests.length + 1;
    const requestNumber = `REQ-2025-${String(nextSeq).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const newRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      requestNumber,
      studentId,
      studentSummary: {
        id: student.id,
        studentNumber: student.studentNumber,
        fullName: student.fullName,
        email: student.email,
        university: student.university,
        program: student.program
      },
      documentType,
      purpose,
      status: VALID_STATUSES.SUBMITTED,
      history: [
        {
          from: null,
          to: VALID_STATUSES.SUBMITTED,
          timestamp: now,
          actor: 'Student',
          comment: 'Request submitted online'
        }
      ],
      remarks: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now
    };

    this.requests.unshift(newRequest);
    this.save();
    return newRequest;
  }

  updateStatus(id, newStatus, { actor = 'Administration Officer', comment = '', rejectionReason = '' } = {}) {
    const request = this.getById(id);
    if (!request) {
      throw new Error(`Request ${id} not found`);
    }

    const currentStatus = request.status;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: [${allowed.join(', ')}]`);
    }

    const now = new Date().toISOString();
    request.status = newStatus;
    request.updatedAt = now;

    if (newStatus === VALID_STATUSES.REJECTED) {
      request.rejectionReason = rejectionReason || comment || 'Request rejected by administrative agent.';
    } else if (newStatus === VALID_STATUSES.APPROVED) {
      request.remarks = comment || 'Approved by administrative agent.';
    }

    request.history.push({
      from: currentStatus,
      to: newStatus,
      timestamp: now,
      actor,
      comment: comment || rejectionReason
    });

    this.save();
    return request;
  }
}

export const requestStore = new RequestStore();

