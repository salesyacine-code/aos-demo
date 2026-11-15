export const notificationSwaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Notification Service API',
    version: '1.0.0',
    description: 'Microservice for sending student notification emails via Mailpit SMTP and maintaining audit logs.'
  },
  servers: [
    { url: 'http://localhost:8004', description: 'Direct Service Port' },
    { url: 'http://localhost:8000/api/notifications', description: 'Via API Gateway' }
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
                    service: { type: 'string', example: 'notification-service' },
                    rabbitMQConnected: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/notifications': {
      get: {
        summary: 'List all dispatched notifications (Audit log)',
        responses: {
          '200': {
            description: 'Array of dispatched notification logs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/NotificationLog' }
                }
              }
            }
          }
        }
      }
    },
    '/api/notifications/test-email': {
      post: {
        summary: 'Send a diagnostic test email to Mailpit',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  to: { type: 'string', example: 'student@example.dz' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Email dispatched to Mailpit successfully' }
        }
      }
    }
  },
  components: {
    schemas: {
      NotificationLog: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'notif-1731627890-a8b9c' },
          type: { type: 'string', example: 'APPROVAL_EMAIL' },
          requestId: { type: 'string' },
          requestNumber: { type: 'string', example: 'REQ-2025-0001' },
          recipient: { type: 'string', example: 'student@example.dz' },
          studentName: { type: 'string', example: 'Abderrazak Medini' },
          status: { type: 'string', example: 'SENT' },
          messageId: { type: 'string' },
          timestamp: { type: 'string' }
        }
      }
    }
  }
};

