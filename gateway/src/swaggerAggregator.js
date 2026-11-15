export const gatewaySwaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'E-Government Academic Services — Unified API Gateway',
    version: '1.0.0',
    description: `Single Entry Point for SOA Group VII Microservices:
- **Student Service**: Student profiles, transcripts, and DummyJSON seeder.
- **Request Service**: Administrative document requests and state machine.
- **Document Service**: Verifiable PDF generation (certificates, transcripts) & QR code validation.
- **Notification Service**: Student email notifications via Mailpit SMTP.`
  },
  servers: [
    { url: 'http://localhost:8000', description: 'API Gateway (Single Entry Point)' }
  ],
  tags: [
    { name: 'Gateway Health', description: 'System-wide health probe' },
    { name: 'Students', description: 'Student registry and academic records' },
    { name: 'Requests', description: 'Document request state machine and workflows' },
    { name: 'Documents', description: 'PDF downloads, preview, and QR code verification' },
    { name: 'Notifications', description: 'Dispatched notification audit trail' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Gateway Health'],
        summary: 'Global System Healthcheck',
        description: 'Pings all 4 microservices and reports their operational status.',
        responses: {
          '200': { description: 'All downstream services operational' },
          '503': { description: 'One or more services unavailable' }
        }
      }
    },
    '/api/students': {
      get: {
        tags: ['Students'],
        summary: 'List students with search and pagination',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'university', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: { '200': { description: 'Paginated list of students' } }
      }
    },
    '/api/students/{id}': {
      get: {
        tags: ['Students'],
        summary: 'Get student profile and semester transcript',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Student profile' }, '404': { description: 'Not found' } }
      }
    },
    '/api/requests': {
      get: {
        tags: ['Requests'],
        summary: 'List document requests with filtering',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['SUBMITTED', 'APPROVED', 'REJECTED'] } },
          { name: 'studentId', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'List of requests' } }
      },
      post: {
        tags: ['Requests'],
        summary: 'Student submits a document request',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['studentId', 'documentType'],
                properties: {
                  studentId: { type: 'string', example: '1' },
                  documentType: {
                    type: 'string',
                    enum: ['CERTIFICATE_OF_ENROLLMENT', 'ACADEMIC_TRANSCRIPT'],
                    example: 'CERTIFICATE_OF_ENROLLMENT'
                  },
                  purpose: { type: 'string', example: 'Scholarship renewal' }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Request created with status SUBMITTED' } }
      }
    },
    '/api/requests/{id}/status': {
      patch: {
        tags: ['Requests'],
        summary: 'Admin reviews and changes request status',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
                  comment: { type: 'string', example: 'Approved for issuance' },
                  rejectionReason: { type: 'string', example: 'Missing documents' }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'Status updated; RabbitMQ event dispatched' } }
      }
    },
    '/api/documents': {
      get: {
        tags: ['Documents'],
        summary: 'List all generated documents',
        responses: { '200': { description: 'Document metadata records' } }
      }
    },
    '/api/documents/{requestId}/download': {
      get: {
        tags: ['Documents'],
        summary: 'Download official PDF document',
        parameters: [
          { name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'PDF stream' } }
      }
    },
    '/api/documents/{requestId}/preview': {
      get: {
        tags: ['Documents'],
        summary: 'Preview official PDF in browser',
        parameters: [
          { name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Inline PDF stream' } }
      }
    },
    '/api/documents/verify/{documentId}': {
      get: {
        tags: ['Documents'],
        summary: 'Verify document authenticity via QR code scan',
        parameters: [
          { name: 'documentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Verification metadata' }, '404': { description: 'Invalid QR / Document' } }
      }
    },
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List dispatched email logs',
        responses: { '200': { description: 'Notification audit logs' } }
      }
    }
  }
};

