import { RABBITMQ_CONFIG, REQUEST_STATUS } from './contracts.js';

/**
 * Event Factory for RequestApproved Event
 */
export function buildRequestApprovedEvent({ request, student }) {
  return {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    eventType: RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_APPROVED,
    timestamp: new Date().toISOString(),
    payload: {
      requestId: request.id,
      requestNumber: request.requestNumber,
      documentType: request.documentType,
      status: REQUEST_STATUS.APPROVED,
      submittedAt: request.createdAt,
      decidedAt: request.updatedAt || new Date().toISOString(),
      student: {
        id: student.id,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: student.fullName,
        email: student.email,
        birthDate: student.birthDate,
        university: student.university,
        program: student.program,
        enrollmentYear: student.enrollmentYear,
        academicRecord: student.academicRecord
      },
      metadata: {
        approverRemarks: request.remarks || 'Approved by Administration Office',
        issuedBy: 'E-Government Academic Services'
      }
    }
  };
}

/**
 * Event Factory for RequestRejected Event
 */
export function buildRequestRejectedEvent({ request, student }) {
  return {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    eventType: RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_REJECTED,
    timestamp: new Date().toISOString(),
    payload: {
      requestId: request.id,
      requestNumber: request.requestNumber,
      documentType: request.documentType,
      status: REQUEST_STATUS.REJECTED,
      rejectionReason: request.rejectionReason || 'Missing required eligibility criteria',
      submittedAt: request.createdAt,
      decidedAt: request.updatedAt || new Date().toISOString(),
      student: {
        id: student.id,
        studentNumber: student.studentNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: student.fullName,
        email: student.email
      }
    }
  };
}

