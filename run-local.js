import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICES = [
  { name: 'STUDENT_SVC', dir: 'services/student-service', file: 'src/index.js', port: 8001 },
  { name: 'REQUEST_SVC', dir: 'services/request-service', file: 'src/index.js', port: 8002 },
  { name: 'DOCUMENT_SVC', dir: 'services/document-service', file: 'src/index.js', port: 8003 },
  { name: 'NOTIF_SVC', dir: 'services/notification-service', file: 'src/index.js', port: 8004 },
  { name: 'GATEWAY', dir: 'gateway', file: 'src/index.js', port: 8000 },
  { name: 'FRONTEND', dir: 'frontend', file: 'server.js', port: 3000 }
];

console.log('=====================================================');
console.log('🚀 Starting E-Government Microservices (Local Mode)');
console.log('=====================================================\n');

SERVICES.forEach(svc => {
  const cwd = path.join(__dirname, svc.dir);
  const proc = spawn('node', [svc.file], {
    cwd,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, PORT: svc.port }
  });

  proc.stdout.on('data', data => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => console.log(`[${svc.name}] ${line}`));
  });

  proc.stderr.on('data', data => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => console.error(`[${svc.name} ERROR] ${line}`));
  });

  proc.on('close', code => {
    console.log(`[${svc.name}] Exited with code ${code}`);
  });
});

