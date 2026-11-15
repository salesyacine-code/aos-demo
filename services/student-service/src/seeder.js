import { studentStore } from './studentStore.js';

const MOCK_UNIVERSITIES = [
  'National Higher School of Computer Science (ESI)',
  'University of Science and Technology Houari Boumediene (USTHB)',
  'Higher National School of Artificial Intelligence (ENSIA)',
  'Polytechnic School of Algiers (ENP)'
];

const MOCK_PROGRAMS = [
  'Master in Service-Oriented Computing & Cloud',
  'Master in Software Engineering & Distributed Systems',
  'Bachelor in Information Systems',
  'Master in Cybersecurity & Network Architecture'
];

const COURSES_POOL = [
  { code: 'SOA701', name: 'Service-Oriented Architecture & Microservices', credits: 5 },
  { code: 'DIT702', name: 'Distributed Systems & Message Brokers', credits: 4 },
  { code: 'DEV703', name: 'Cloud Native Application & Docker Orchestration', credits: 4 },
  { code: 'SEC704', name: 'API Security & OAuth2/Keycloak', credits: 3 },
  { code: 'DAT705', name: 'Database Architecture & Big Data', credits: 4 }
];

function generateAcademicRecord(studentIndex) {
  const grades = COURSES_POOL.map((course, i) => {
    // Deterministic grades based on student index
    const baseGrade = 12 + ((studentIndex * 3 + i * 2) % 7);
    const bonus = ((studentIndex + i) % 3) * 0.5;
    const finalGrade = Math.min(20, parseFloat((baseGrade + bonus).toFixed(1)));
    return {
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
      grade: finalGrade,
      status: finalGrade >= 10 ? 'PASSED' : 'FAILED'
    };
  });

  const totalCredits = grades.reduce((acc, c) => acc + c.credits, 0);
  const weightedSum = grades.reduce((acc, c) => acc + c.grade * c.credits, 0);
  const gpa = (weightedSum / totalCredits).toFixed(2);

  return {
    academicYear: '2025/2026',
    semester: 'S1',
    overallGpa: parseFloat(gpa),
    mention: gpa >= 16 ? 'Tres Bien' : gpa >= 14 ? 'Bien' : gpa >= 12 ? 'Assez Bien' : 'Passable',
    courses: grades
  };
}

export async function seedStudents(force = false) {
  if (!force && studentStore.students.length > 0) {
    console.log(`[Seeder] Students already loaded (${studentStore.students.length} records). Skipping.`);
    return studentStore.students;
  }

  console.log('[Seeder] Fetching students from DummyJSON (/users)...');
  let rawUsers = [];

  try {
    const res = await fetch('https://dummyjson.com/users?limit=30');
    if (!res.ok) throw new Error(`DummyJSON responded with status ${res.status}`);
    const json = await res.json();
    rawUsers = json.users || [];
    console.log(`[Seeder] Successfully retrieved ${rawUsers.length} users from DummyJSON.`);
  } catch (err) {
    console.warn(`[Seeder] Failed to fetch from DummyJSON (${err.message}). Using local fallback profiles.`);
    rawUsers = [
      { id: 1, firstName: 'Abderrazak', lastName: 'Medini', email: 'amedini@esi.dz', birthDate: '2002-04-15', university: 'ESI Algiers' },
      { id: 2, firstName: 'Yacine', lastName: 'Salles', email: 'ysalles@esi.dz', birthDate: '2001-11-20', university: 'ESI Algiers' },
      { id: 3, firstName: 'Amine', lastName: 'Kaddour', email: 'akaddour@usthb.dz', birthDate: '2002-08-12', university: 'USTHB' },
      { id: 4, firstName: 'Sarah', lastName: 'Benali', email: 'sbenali@ensia.edu.dz', birthDate: '2003-01-30', university: 'ENSIA' },
      { id: 5, firstName: 'Karim', lastName: 'Mansouri', email: 'kmansouri@enp.edu.dz', birthDate: '2001-09-05', university: 'ENP' }
    ];
  }

  const students = rawUsers.map((user, idx) => {
    const univ = user.university || MOCK_UNIVERSITIES[idx % MOCK_UNIVERSITIES.length];
    const program = MOCK_PROGRAMS[idx % MOCK_PROGRAMS.length];
    const studentNumber = `STD-2024-${String(user.id).padStart(4, '0')}`;
    const academicRecord = generateAcademicRecord(idx + 1);

    return {
      id: user.id,
      studentNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      birthDate: user.birthDate,
      phone: user.phone || '+213 555 123 456',
      university: univ,
      program,
      enrollmentYear: 2024,
      status: 'ACTIVE',
      academicRecord
    };
  });

  studentStore.setAll(students);
  console.log(`[Seeder] Database seeded with ${students.length} student profiles.`);
  return students;
}

