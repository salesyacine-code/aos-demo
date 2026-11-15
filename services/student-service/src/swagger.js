export const studentSwaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Student Service API',
    version: '1.0.0',
    description: 'Microservice managing student identities, enrollments, and academic transcripts for Group VII.'
  },
  servers: [
    { url: 'http://localhost:8001', description: 'Direct Service Port' },
    { url: 'http://localhost:8000/api/students', description: 'Via API Gateway' }
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Service Health Check',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'UP' },
                    service: { type: 'string', example: 'student-service' },
                    timestamp: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/students': {
      get: {
        summary: 'List students with search and pagination',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name, email, or student number' },
          { name: 'university', in: 'query', schema: { type: 'string' }, description: 'Filter by university name' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Page size' }
        ],
        responses: {
          '200': {
            description: 'Paginated list of students',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    totalPages: { type: 'integer' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Student' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/students/{id}': {
      get: {
        summary: 'Get student by ID or student number',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Numeric ID or STD-2024-XXXX format' }
        ],
        responses: {
          '200': {
            description: 'Student profile with academic transcript',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Student' }
              }
            }
          },
          '404': {
            description: 'Student not found'
          }
        }
      }
    },
    '/api/students/actions/seed': {
      post: {
        summary: 'Trigger re-seeding from DummyJSON',
        responses: {
          '200': {
            description: 'Seeding completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    count: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      CourseGrade: {
        type: 'object',
        properties: {
          courseCode: { type: 'string', example: 'SOA701' },
          courseName: { type: 'string', example: 'Service-Oriented Architecture' },
          credits: { type: 'integer', example: 5 },
          grade: { type: 'number', example: 16.5 },
          status: { type: 'string', example: 'PASSED' }
        }
      },
      AcademicRecord: {
        type: 'object',
        properties: {
          academicYear: { type: 'string', example: '2025/2026' },
          semester: { type: 'string', example: 'S1' },
          overallGpa: { type: 'number', example: 15.2 },
          mention: { type: 'string', example: 'Bien' },
          courses: {
            type: 'array',
            items: { $ref: '#/components/schemas/CourseGrade' }
          }
        }
      },
      Student: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          studentNumber: { type: 'string', example: 'STD-2024-0001' },
          firstName: { type: 'string', example: 'Abderrazak' },
          lastName: { type: 'string', example: 'Medini' },
          fullName: { type: 'string', example: 'Abderrazak Medini' },
          email: { type: 'string', example: 'amedini@esi.dz' },
          birthDate: { type: 'string', example: '2002-04-15' },
          phone: { type: 'string', example: '+213 555 123 456' },
          university: { type: 'string', example: 'National Higher School of Computer Science (ESI)' },
          program: { type: 'string', example: 'Master in Service-Oriented Computing & Cloud' },
          enrollmentYear: { type: 'integer', example: 2024 },
          status: { type: 'string', example: 'ACTIVE' },
          academicRecord: { $ref: '#/components/schemas/AcademicRecord' }
        }
      }
    }
  }
};

