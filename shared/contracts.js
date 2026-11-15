/**
 * Shared Domain Constants and Messaging Contracts for SOA Project - Group VII
 */

// Request Status State Machine
export const REQUEST_STATUS = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

// Supported Document Types
export const DOCUMENT_TYPES = {
  CERTIFICATE: 'CERTIFICATE_OF_ENROLLMENT',
  TRANSCRIPT: 'ACADEMIC_TRANSCRIPT'
};

export const DOCUMENT_TYPE_LABELS = {
  [DOCUMENT_TYPES.CERTIFICATE]: 'Certificate of Enrollment (Certificat de Scolarité)',
  [DOCUMENT_TYPES.TRANSCRIPT]: 'Official Academic Transcript (Relevé de Notes)'
};

// RabbitMQ Topology & Routing Keys
export const RABBITMQ_CONFIG = {
  EXCHANGE: 'soa.administrative.events',
  EXCHANGE_TYPE: 'topic',
  QUEUES: {
    DOCUMENT_GENERATION: 'document.generation.queue',
    NOTIFICATION: 'notification.dispatch.queue'
  },
  ROUTING_KEYS: {
    REQUEST_SUBMITTED: 'request.submitted',
    REQUEST_APPROVED: 'request.approved',
    REQUEST_REJECTED: 'request.rejected'
  }
};

