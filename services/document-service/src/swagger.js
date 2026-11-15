export const documentSwaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Document Service API',
    version: '1.0.0',
    description: 'Microservice generating official PDF certificates and transcripts with embedded verifiable QR codes.'
  },
  servers: [
    { url: 'http://localhost:8003', description: 'Direct Service Port' },
    { url: 'http://localhost:8000/api/documents', description: 'Via API Gateway' }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health Check',
        responses: {
          '200': {
            description: 'Service status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'UP' },
                    service: { type: 'string', example: 'document-service' },
                    rabbitMQListening: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/documents': {
      get: {
        summary: 'List all generated documents',
        responses: {
          '200': {
            description: 'Array of generated document metadata',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DocumentMeta' }
                }
              }
            }
          }
        }
      }
    },
    '/api/documents/{requestId}/download': {
      get: {
        summary: 'Download generated PDF document',
        parameters: [
          { name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'PDF binary stream',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          },
          '404': { description: 'Document not found' }
        }
      }
    },
    '/api/documents/{requestId}/preview': {
      get: {
        summary: 'Preview generated PDF in browser',
        parameters: [
          { name: 'requestId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Inline PDF stream',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' }
              }
            }
          },
          '404': { description: 'Document not found' }
        }
      }
    },
    '/api/documents/verify/{documentId}': {
      get: {
        summary: 'Verify document authenticity via QR code scan',
        parameters: [
          { name: 'documentId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Document verification payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    valid: { type: 'boolean', example: true },
                    document: { $ref: '#/components/schemas/DocumentMeta' }
                  }
                }
              }
            }
          },
          '404': { description: 'Document ID not recognized or forged' }
        }
      }
    }
  },
  components: {
    schemas: {
      DocumentMeta: {
        type: 'object',
        properties: {
          requestId: { type: 'string', example: 'req-1731627890-a8b9c' },
          requestNumber: { type: 'string', example: 'REQ-2025-0001' },
          documentId: { type: 'string', example: 'DOC-M1AB2C-A8B9C' },
          documentType: { type: 'string', example: 'CERTIFICATE_OF_ENROLLMENT' },
          fileName: { type: 'string', example: 'doc-req-1731627890-a8b9c.pdf' },
          studentName: { type: 'string', example: 'Abderrazak Medini' },
          studentNumber: { type: 'string', example: 'STD-2024-0001' },
          verificationUrl: { type: 'string' },
          generatedAt: { type: 'string' }
        }
      }
    }
  }
};

