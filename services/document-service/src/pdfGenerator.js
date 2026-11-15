import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateQrCodeBuffer } from './qrGenerator.js';
import { DOCUMENT_TYPES } from '../../../shared/contracts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, '..', 'storage');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export async function generateDocumentPdf(eventPayload, publicGatewayUrl = 'http://localhost:8000') {
  const { requestId, requestNumber, documentType, student, metadata } = eventPayload;
  const fileName = `doc-${requestId}.pdf`;
  const filePath = path.join(STORAGE_DIR, fileName);

  const documentId = `DOC-${Date.now().toString(36).toUpperCase()}-${requestId.substring(4, 9).toUpperCase()}`;
  const issueDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Data encoded in QR code points to Public Verification Portal
  const frontendUrl = process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000';
  const verificationUrl = `${frontendUrl}/verify.html?doc=${documentId}`;
  const qrData = {
    docId: documentId,
    reqNo: requestNumber,
    student: student.fullName,
    studentNo: student.studentNumber,
    university: student.university,
    type: documentType,
    issued: issueDate,
    verifyUrl: verificationUrl
  };

  const qrBuffer = await generateQrCodeBuffer(JSON.stringify(qrData));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // Decorative top border
    doc.rect(0, 0, doc.page.width, 12).fill('#1e3a8a');

    // Header: Institution Info
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#64748b').text('PEOPLE\'S DEMOCRATIC REPUBLIC OF ALGERIA', { align: 'center' });
    doc.text('MINISTRY OF HIGHER EDUCATION AND SCIENTIFIC RESEARCH', { align: 'center' });
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(student.university.toUpperCase(), { align: 'center' });
    doc.moveDown(0.5);

    // Divider line
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke();
    doc.moveDown(1.5);

    if (documentType === DOCUMENT_TYPES.TRANSCRIPT) {
      renderTranscript(doc, student, requestNumber, documentId, issueDate, qrBuffer);
    } else {
      renderCertificate(doc, student, requestNumber, documentId, issueDate, qrBuffer, metadata);
    }

    // Footer
    const bottomY = doc.page.height - 40;
    doc.fontSize(8).fillColor('#94a3b8').text(
      `Document ID: ${documentId} | Generated via E-Government SOA Portal | Verification URL: ${verificationUrl}`,
      50,
      bottomY,
      { align: 'center', width: doc.page.width - 100 }
    );

    doc.end();

    writeStream.on('finish', () => {
      console.log(`[PdfGenerator] Successfully generated ${documentType} at ${filePath}`);
      resolve({
        documentId,
        fileName,
        filePath,
        verificationUrl,
        issueDate,
        documentType
      });
    });

    writeStream.on('error', (err) => {
      console.error(`[PdfGenerator] WriteStream error:`, err);
      reject(err);
    });
  });
}

function renderCertificate(doc, student, requestNumber, documentId, issueDate, qrBuffer, metadata) {
  // Title
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a8a').text('CERTIFICATE OF ENROLLMENT', { align: 'center' });
  doc.fontSize(11).font('Helvetica-Oblique').fillColor('#64748b').text('CERTIFICAT DE SCOLARITÉ — ACADEMIC YEAR 2025/2026', { align: 'center' });
  doc.moveDown(2);

  // Body introductory text
  doc.fontSize(11).font('Helvetica').fillColor('#1e293b').lineGap(4);
  doc.text('The Administration of the Institution hereby certifies that:');
  doc.moveDown(1);

  // Student info card box
  const boxTop = doc.y;
  doc.rect(50, boxTop, doc.page.width - 100, 130).fillAndStroke('#f8fafc', '#e2e8f0');
  
  doc.fillColor('#0f172a');
  doc.font('Helvetica-Bold').text(`Full Name: `, 70, boxTop + 15, { continued: true });
  doc.font('Helvetica').text(student.fullName);

  doc.font('Helvetica-Bold').text(`Student ID Number: `, 70, boxTop + 35, { continued: true });
  doc.font('Helvetica').text(student.studentNumber);

  doc.font('Helvetica-Bold').text(`Date of Birth: `, 70, boxTop + 55, { continued: true });
  doc.font('Helvetica').text(student.birthDate || 'Not specified');

  doc.font('Helvetica-Bold').text(`Academic Degree Program: `, 70, boxTop + 75, { continued: true });
  doc.font('Helvetica').text(student.program);

  doc.font('Helvetica-Bold').text(`Enrollment Status: `, 70, boxTop + 95, { continued: true });
  doc.font('Helvetica-Bold').fillColor('#16a34a').text('REGISTERED & ACTIVE FOR FULL-TIME STUDY');

  doc.y = boxTop + 150;
  doc.fillColor('#1e293b');
  doc.font('Helvetica').text(
    'Is officially registered in regular standing for the ongoing academic term. This certificate is granted upon the student\'s formal request to serve and validate any lawful administrative and academic procedures.',
    { align: 'justify' }
  );

  doc.moveDown(2);

  // Bottom section: QR Code on left, Stamp/Signature on right
  const stampY = doc.y;
  
  // Embed QR Code
  doc.image(qrBuffer, 70, stampY, { width: 90 });
  doc.fontSize(8).fillColor('#64748b').text('Scan to verify authenticity', 65, stampY + 95, { width: 100, align: 'center' });

  // Digital Signature Box
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`Done on: ${issueDate}`, 320, stampY);
  doc.text('Director of Academic Affairs & Registrar', 320, stampY + 15);
  doc.rect(320, stampY + 35, 170, 50).dash(3, { space: 2 }).stroke('#94a3b8');
  doc.undash();
  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b').text('[ Digitally Certified & Signed ]', 330, stampY + 52);
}

function renderTranscript(doc, student, requestNumber, documentId, issueDate, qrBuffer) {
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a8a').text('OFFICIAL ACADEMIC TRANSCRIPT', { align: 'center' });
  doc.fontSize(11).font('Helvetica-Oblique').fillColor('#64748b').text('RELEVÉ DE NOTES OFFICIEL', { align: 'center' });
  doc.moveDown(1.5);

  // Student Summary
  doc.fontSize(10).font('Helvetica').fillColor('#0f172a');
  doc.text(`Student: ${student.fullName}  |  ID: ${student.studentNumber}  |  Program: ${student.program}`);
  doc.text(`Academic Year: 2025/2026  |  Term: Semester 1`);
  doc.moveDown(1);

  // Grades Table Header
  const tableTop = doc.y;
  doc.rect(50, tableTop, doc.page.width - 100, 22).fill('#1e3a8a');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
  doc.text('Course Code', 60, tableTop + 6);
  doc.text('Course Title', 150, tableTop + 6);
  doc.text('Credits', 370, tableTop + 6);
  doc.text('Grade /20', 430, tableTop + 6);
  doc.text('Status', 490, tableTop + 6);

  let currentY = tableTop + 22;
  const courses = student.academicRecord?.courses || [];

  courses.forEach((c, idx) => {
    const bgColor = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
    doc.rect(50, currentY, doc.page.width - 100, 20).fillAndStroke(bgColor, '#e2e8f0');

    doc.fontSize(9).font('Helvetica').fillColor('#1e293b');
    doc.text(c.courseCode, 60, currentY + 5);
    doc.text(c.courseName.length > 36 ? c.courseName.substring(0, 34) + '...' : c.courseName, 150, currentY + 5);
    doc.text(String(c.credits), 380, currentY + 5);
    doc.font('Helvetica-Bold').text(String(c.grade), 440, currentY + 5);
    
    if (c.status === 'PASSED') {
      doc.fillColor('#16a34a').text('PASSED', 490, currentY + 5);
    } else {
      doc.fillColor('#dc2626').text('FAILED', 490, currentY + 5);
    }

    currentY += 20;
  });

  // Summary Row (GPA & Mention)
  const gpa = student.academicRecord?.overallGpa || '15.5';
  const mention = student.academicRecord?.mention || 'Bien';
  doc.rect(50, currentY, doc.page.width - 100, 26).fillAndStroke('#eff6ff', '#bfdbfe');
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e3a8a');
  doc.text(`Semester Grade Point Average (GPA): ${gpa} / 20.00`, 60, currentY + 8);
  doc.text(`Mention: ${mention}`, 380, currentY + 8);

  currentY += 40;
  doc.y = currentY;

  // Bottom section: QR Code & Stamp
  const stampY = doc.y;
  doc.image(qrBuffer, 70, stampY, { width: 85 });
  doc.fontSize(8).fillColor('#64748b').text('Scan to verify grades', 65, stampY + 90, { width: 100, align: 'center' });

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`Issued on: ${issueDate}`, 320, stampY);
  doc.text('Dean of Academic Records', 320, stampY + 15);
  doc.rect(320, stampY + 32, 170, 48).dash(3, { space: 2 }).stroke('#94a3b8');
  doc.undash();
  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b').text('[ Officially Sealed & Verified ]', 330, stampY + 48);
}

