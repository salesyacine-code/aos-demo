export const requestSwaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Request Service API',
    version: '1.0.0',
    description: 'Microservice handling administrative document requests, state transitions, and event publishing.'
  },
  servers: [
    { url: 'http://localhost:8002', description: 'Direct Service Port' },
    { url: 'http://localhost:8000/api/requests', description: 'Via API Gateway' }
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
                    service: { type: 'string', example: 'request-service' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/requests': {
      get: {
        summary: 'List document requests with filtering and pagination',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['SUBMITTED', 'APPROVED', 'REJECTED'] }, description: 'Filter by request status' },
          { name: 'studentId', in: 'query', schema: { type: 'string' }, description: 'Filter by student ID' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': {
            description: 'List of requests',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/DocumentRequest' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Submit a new document request',
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
                  purpose: { type: 'string', example: 'Visa application requirement' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Request successfully submitted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DocumentRequest' }
              }
            }
          },
          '400': { description: 'Missing required fields or invalid document type' },
          '404': { description: 'Student not found' }
        }
      }
    },
    '/api/requests/{id}': {
      get: {
        summary: 'Get request details by ID or request number',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Request details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DocumentRequest' }
              }
            }
          },
          '404': { description: 'Request not found' }
        }
      }
    },
    '/api/requests/{id}/status': {
      patch: {
        summary: 'Admin decision: Approve or Reject request',
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
                  status: {
                    type: 'string',
                    enum: ['APPROVED', 'REJECTED'],
                    example: 'APPROVED'
                  },
                  comment: { type: 'string', example: 'All student tuition fees cleared.' },
                  rejectionReason: { type: 'string', example: 'Incomplete registration documents.' },
                  actor: { type: 'string', example: 'Administration Officer' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Status successfully updated and event published',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    request: { $ref: '#/components/schemas/DocumentRequest' },
                    eventPublished: { type: 'boolean' }
                  }
                }
              }
            }
          },
          '400': { description: 'Invalid state transition' },
          '404': { description: 'Request not found' }
        }
      }
    }
  },
  components: {
    schemas: {
      DocumentRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'req-1731627890-a8b9c' },
          requestNumber: { type: 'string', example: 'REQ-2025-0001' },
          studentId: { type: 'string', example: '1' },
          documentType: { type: 'string', example: 'CERTIFICATE_OF_ENROLLMENT' },
          purpose: { type: 'string', example: 'Scholarship renewal' },
          status: { type: 'string', example: 'SUBMITTED' },
          remarks: { type: 'string' },
          rejectionReason: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' }
        }
      }
    }
  }
};

