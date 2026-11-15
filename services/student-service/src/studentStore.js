import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'students.json');

class StudentStore {
  constructor() {
    this.students = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.students = JSON.parse(raw);
        console.log(`[StudentStore] Loaded ${this.students.length} students from ${DATA_FILE}`);
      } else {
        this.students = [];
        console.log(`[StudentStore] No existing data file found at ${DATA_FILE}. Ready to seed.`);
      }
    } catch (err) {
      console.error(`[StudentStore] Error loading data:`, err.message);
      this.students = [];
    }
  }

  save() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.students, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[StudentStore] Error saving students:`, err.message);
    }
  }

  getAll({ search = '', university = '', limit = 50, page = 1 } = {}) {
    let result = [...this.students];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => 
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q)
      );
    }

    if (university) {
      result = result.filter(s => s.university.toLowerCase().includes(university.toLowerCase()));
    }

    const total = result.length;
    const startIndex = (page - 1) * limit;
    const paginated = result.slice(startIndex, startIndex + limit);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      data: paginated
    };
  }

  getById(id) {
    return this.students.find(s => String(s.id) === String(id) || s.studentNumber === id);
  }

  setAll(newStudents) {
    this.students = newStudents;
    this.save();
    return this.students.length;
  }
}

export const studentStore = new StudentStore();

