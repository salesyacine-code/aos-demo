import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { documentStore } from './documentStore.js';
import { documentConsumer } from './rabbitmq.js';
import { generateDocumentPdf } from './pdfGenerator.js';
import { documentSwaggerDocument } from './swagger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, '..', 'storage');

const app = express();
const PORT = process.env.PORT || 8003;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Swagger Documentation UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(documentSwaggerDocument, {
  customSiteTitle: 'Document Service API Docs'
}));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'document-service',
    timestamp: new Date().toISOString(),
    totalDocuments: documentStore.documents.length,
    rabbitMQConnected: documentConsumer.isListening
  });
});

// GET /api/documents - List all generated documents
app.get(['/api/documents', '/documents', '/'], (req, res) => {
  res.json(documentStore.getAll());
});

// GET /api/documents/:requestId/download - Download PDF file
app.get(['/api/documents/:requestId/download', '/documents/:requestId/download', '/:requestId/download'], (req, res) => {
  const { requestId } = req.params;
  const docMeta = documentStore.getByRequestId(requestId);

  const fileName = docMeta?.fileName || `doc-${requestId}.pdf`;
  const filePath = path.join(STORAGE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `PDF document not found for request ${requestId}` });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// GET /api/documents/:requestId/preview - Inline PDF viewing in browser
app.get(['/api/documents/:requestId/preview', '/documents/:requestId/preview', '/:requestId/preview'], (req, res) => {
  const { requestId } = req.params;
  const docMeta = documentStore.getByRequestId(requestId);

  const fileName = docMeta?.fileName || `doc-${requestId}.pdf`;
  const filePath = path.join(STORAGE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `PDF document not found for request ${requestId}` });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// GET /api/documents/verify/:documentId - Public QR code verification endpoint
app.get(['/api/documents/verify/:documentId', '/documents/verify/:documentId', '/verify/:documentId'], (req, res) => {
  const { documentId } = req.params;
  const docMeta = documentStore.getByDocumentId(documentId);

  if (!docMeta) {
    return res.status(404).json({
      valid: false,
      message: `Document ${documentId} is invalid or has not been issued by the university portal.`
    });
  }

  res.json({
    valid: true,
    message: 'Official Academic Document Authenticated and Verified',
    document: docMeta
  });
});

// POST /api/documents/actions/generate - Manual test endpoint
app.post(['/api/documents/actions/generate', '/actions/generate'], async (req, res) => {
  const { request, student } = req.body;
  if (!request || !student) {
    return res.status(400).json({ error: 'Payload must include "request" and "student" objects.' });
  }

  try {
    const payload = {
      requestId: request.id || `req-${Date.now()}`,
      requestNumber: request.requestNumber || 'REQ-MANUAL',
      documentType: request.documentType || 'CERTIFICATE_OF_ENROLLMENT',
      student,
      metadata: { remarks: 'Manually triggered generation' }
    };

    const pdfResult = await generateDocumentPdf(payload, process.env.GATEWAY_PUBLIC_URL || 'http://localhost:8000');

    const meta = documentStore.recordDocument({
      requestId: payload.requestId,
      requestNumber: payload.requestNumber,
      documentId: pdfResult.documentId,
      documentType: payload.documentType,
      fileName: pdfResult.fileName,
      studentName: student.fullName,
      studentNumber: student.studentNumber,
      verificationUrl: pdfResult.verificationUrl,
      generatedAt: new Date().toISOString()
    });

    res.json({ message: 'Document generated successfully', document: meta });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate document', details: err.message });
  }
});

// Bootstrap server and start RabbitMQ consumer in background
async function bootstrap() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [DocumentService] Running on port ${PORT}`);
    console.log(`📖 [DocumentService] Swagger docs available at http://localhost:${PORT}/docs`);
  });

  documentConsumer.start().catch(err => {
    console.warn('[DocumentService] RabbitMQ background consumer notice:', err.message);
  });
}

bootstrap().catch(err => {
  console.error('[DocumentService] Bootstrap error:', err);
});

