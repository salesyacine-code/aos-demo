import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { studentStore } from './studentStore.js';
import { seedStudents } from './seeder.js';
import { studentSwaggerDocument } from './swagger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Swagger Documentation UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(studentSwaggerDocument, {
  customSiteTitle: 'Student Service API Docs'
}));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'student-service',
    timestamp: new Date().toISOString(),
    studentCount: studentStore.students.length
  });
});

// GET /api/students - List students with search and pagination (supports multiple path aliases)
app.get(['/api/students', '/students', '/'], (req, res) => {
  const { search, university, page, limit } = req.query;
  const result = studentStore.getAll({
    search,
    university,
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20
  });
  res.json(result);
});

// GET /api/students/:id - Get student profile by ID or studentNumber
app.get(['/api/students/:id', '/students/:id', '/:id'], (req, res) => {
  if (req.params.id === 'health') return res.json({ status: 'UP' });
  const student = studentStore.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ error: `Student not found with ID or number: ${req.params.id}` });
  }
  res.json(student);
});

// POST /api/students/actions/seed - Force re-seed from DummyJSON
app.post(['/api/students/actions/seed', '/actions/seed'], async (req, res) => {
  try {
    const students = await seedStudents(true);
    res.json({
      message: 'Students successfully seeded from DummyJSON',
      count: students.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed students', details: err.message });
  }
});

// Auto-seed on startup if store is empty
async function bootstrap() {
  if (studentStore.students.length === 0) {
    console.log('[StudentService] Store is empty. Running initial seeding...');
    await seedStudents(false);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(` [StudentService] Running on port ${PORT}`);
    console.log(` [StudentService] Swagger docs available at http://localhost:${PORT}/docs`);
  });
}

bootstrap().catch(err => {
  console.error('[StudentService] Bootstrap error:', err);
});

