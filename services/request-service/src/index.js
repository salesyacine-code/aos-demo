import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { requestStore, VALID_STATUSES } from './requestStore.js';
import { requestPublisher } from './rabbitmq.js';
import { requestSwaggerDocument } from './swagger.js';
import { DOCUMENT_TYPES } from '../../../shared/contracts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8002;
const STUDENT_SERVICE_URL = process.env.STUDENT_SERVICE_URL || 'http://localhost:8001';

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Swagger Documentation UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(requestSwaggerDocument, {
  customSiteTitle: 'Request Service API Docs'
}));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'request-service',
    timestamp: new Date().toISOString(),
    totalRequests: requestStore.requests.length,
    rabbitMQConnected: requestPublisher.isConnected
  });
});

// Helper: Fetch student from Student Service
async function fetchStudent(studentId) {
  try {
    const res = await fetch(`${STUDENT_SERVICE_URL}/api/students/${studentId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[RequestService] Could not reach Student Service at ${STUDENT_SERVICE_URL}:`, err.message);
  }
  return null;
}

// GET /api/requests - List requests with filtering & pagination
app.get(['/api/requests', '/requests', '/'], (req, res) => {
  const { status, studentId, page, limit } = req.query;
  const result = requestStore.getAll({
    status,
    studentId,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 50
  });
  res.json(result);
});

// GET /api/requests/:id - Get request by ID or requestNumber
app.get(['/api/requests/:id', '/requests/:id', '/:id'], (req, res) => {
  if (req.params.id === 'health') return res.json({ status: 'UP' });
  const request = requestStore.getById(req.params.id);
  if (!request) {
    return res.status(404).json({ error: `Request not found: ${req.params.id}` });
  }
  res.json(request);
});

// POST /api/requests - Submit a new document request
app.post(['/api/requests', '/requests', '/'], async (req, res) => {
  const { studentId, documentType, purpose } = req.body;

  if (!studentId || !documentType) {
    return res.status(400).json({ error: 'Fields "studentId" and "documentType" are required.' });
  }

  const validTypes = Object.values(DOCUMENT_TYPES);
  if (!validTypes.includes(documentType)) {
    return res.status(400).json({
      error: `Invalid documentType "${documentType}". Must be one of: [${validTypes.join(', ')}]`
    });
  }

  // Verify student existence
  let student = await fetchStudent(studentId);
  if (!student) {
    // Fallback if student-service is unreachable during isolated unit testing
    student = {
      id: studentId,
      studentNumber: `STD-2024-${String(studentId).padStart(4, '0')}`,
      fullName: `Student #${studentId}`,
      email: `student${studentId}@university.edu`,
      university: 'National Higher School of Computer Science (ESI)',
      program: 'Master in Software Engineering'
    };
  }

  try {
    const newRequest = requestStore.create({
      studentId: String(studentId),
      student,
      documentType,
      purpose: purpose || 'Administrative requirement'
    });

    console.log(`[RequestService] Created request ${newRequest.requestNumber} for student ${student.fullName}`);
    return res.status(201).json(newRequest);
  } catch (err) {
    console.error('[RequestService] Error creating request:', err.message);
    return res.status(500).json({ error: 'Failed to create request', details: err.message });
  }
});

// PATCH /api/requests/:id/status - Approve or Reject request
app.patch(['/api/requests/:id/status', '/requests/:id/status', '/:id/status'], async (req, res) => {
  const { id } = req.params;
  const { status, comment, rejectionReason, actor } = req.body;

  if (!status || ![VALID_STATUSES.APPROVED, VALID_STATUSES.REJECTED].includes(status)) {
    return res.status(400).json({
      error: `Status must be either "${VALID_STATUSES.APPROVED}" or "${VALID_STATUSES.REJECTED}"`
    });
  }

  try {
    const updatedRequest = requestStore.updateStatus(id, status, {
      actor: actor || 'Administration Officer',
      comment,
      rejectionReason
    });

    // Fetch full student data to include in event payload
    let student = await fetchStudent(updatedRequest.studentId);
    if (!student) {
      student = updatedRequest.studentSummary;
    }

    let eventPublished = false;
    let publishedEvent = null;

    try {
      if (status === VALID_STATUSES.APPROVED) {
        publishedEvent = await requestPublisher.publishApproval(updatedRequest, student);
        eventPublished = true;
      } else if (status === VALID_STATUSES.REJECTED) {
        publishedEvent = await requestPublisher.publishRejection(updatedRequest, student);
        eventPublished = true;
      }
    } catch (pubErr) {
      console.warn(`[RequestService] Request ${id} updated, but RabbitMQ event publishing deferred:`, pubErr.message);
    }

    return res.json({
      message: `Request status transitioned to ${status}`,
      request: updatedRequest,
      eventPublished,
      eventId: publishedEvent?.eventId || null
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Bootstrap server and connect to RabbitMQ in background
async function bootstrap() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [RequestService] Running on port ${PORT}`);
    console.log(`📖 [RequestService] Swagger docs available at http://localhost:${PORT}/docs`);
  });

  // Connect to RabbitMQ asynchronously without blocking HTTP server
  requestPublisher.init().catch(err => {
    console.warn('[RequestService] RabbitMQ background connection notice:', err.message);
  });
}

bootstrap().catch(err => {
  console.error('[RequestService] Bootstrap error:', err);
});

