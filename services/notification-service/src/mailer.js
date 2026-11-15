import nodemailer from 'nodemailer';
import { DOCUMENT_TYPE_LABELS } from '../../../shared/contracts.js';

const SMTP_HOST = process.env.MAILPIT_SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.MAILPIT_SMTP_PORT || '1025', 10);

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false, // Mailpit uses unencrypted local SMTP
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendApprovalEmail(eventPayload, gatewayUrl = 'http://localhost:8000') {
  const { requestId, requestNumber, documentType, student } = eventPayload;
  const docTitle = DOCUMENT_TYPE_LABELS[documentType] || documentType;
  const downloadUrl = `${gatewayUrl}/api/documents/${requestId}/download`;
  const previewUrl = `${gatewayUrl}/api/documents/${requestId}/preview`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; color: #1e293b; }
        .card { background: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: #1e3a8a; color: #ffffff; padding: 24px; text-align: center; }
        .content { padding: 30px; }
        .badge { display: inline-block; background-color: #dcfce7; color: #15803d; font-weight: bold; font-size: 13px; padding: 4px 10px; border-radius: 9999px; }
        .btn { display: inline-block; background-color: #1e3a8a; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 15px; }
        .footer { background: #f8fafc; padding: 15px 30px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
        .table { width: 100%; margin-top: 15px; border-collapse: collapse; }
        .table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .table td:first-child { color: #64748b; width: 40%; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 style="margin: 0;">E-Government Academic Services</h2>
          <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Official Student Notification</p>
        </div>
        <div class="content">
          <span class="badge">REQUEST APPROVED</span>
          <h3 style="margin-top: 15px;">Dear ${student.fullName},</h3>
          <p>We are pleased to inform you that your administrative document request has been reviewed and officially <strong>approved</strong> by the University Administration.</p>
          
          <table class="table">
            <tr><td>Request Number:</td><td><strong>${requestNumber}</strong></td></tr>
            <tr><td>Document Requested:</td><td>${docTitle}</td></tr>
            <tr><td>Student ID:</td><td>${student.studentNumber}</td></tr>
            <tr><td>Institution:</td><td>${student.university}</td></tr>
          </table>

          <p style="margin-top: 25px;">Your official digital document has been generated with a verifiable QR code. You can download or preview it below:</p>

          <div style="text-align: center; margin: 25px 0;">
            <a href="${downloadUrl}" class="btn">📥 Download Official PDF</a>
            <div style="margin-top: 10px;">
              <a href="${previewUrl}" style="color: #2563eb; font-size: 13px; text-decoration: underline;">Open inline preview</a>
            </div>
          </div>

          <p style="font-size: 13px; color: #64748b;">The embedded QR code allows third parties (employers, visa officers, academic institutions) to securely verify the authenticity of this document.</p>
        </div>
        <div class="footer">
          This is an automated message sent via the Service-Oriented E-Government Platform (Group VII).
        </div>
      </div>
    </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from: '"E-Government Academic Services" <noreply@academic.univ.dz>',
    to: student.email,
    subject: `[Approved] Your ${docTitle} is ready (${requestNumber})`,
    html
  });

  console.log(`[Mailer] Approval email sent to ${student.email}. MessageId: ${info.messageId}`);
  return info;
}

export async function sendRejectionEmail(eventPayload) {
  const { requestNumber, documentType, student, rejectionReason } = eventPayload;
  const docTitle = DOCUMENT_TYPE_LABELS[documentType] || documentType;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; color: #1e293b; }
        .card { background: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { background: #991b1b; color: #ffffff; padding: 24px; text-align: center; }
        .content { padding: 30px; }
        .badge { display: inline-block; background-color: #fee2e2; color: #b91c1c; font-weight: bold; font-size: 13px; padding: 4px 10px; border-radius: 9999px; }
        .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { background: #f8fafc; padding: 15px 30px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 style="margin: 0;">E-Government Academic Services</h2>
          <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Administrative Notification</p>
        </div>
        <div class="content">
          <span class="badge">REQUEST DECLINED</span>
          <h3 style="margin-top: 15px;">Dear ${student.fullName},</h3>
          <p>We regret to inform you that your request <strong>${requestNumber}</strong> for <strong>${docTitle}</strong> could not be approved at this time.</p>
          
          <div class="reason-box">
            <strong>Reason for Rejection:</strong><br/>
            <span style="color: #7f1d1d;">${rejectionReason || 'Administrative eligibility criteria not met.'}</span>
          </div>

          <p>If you believe this is in error, or if you need to submit supplementary documentation, please contact your university department registrar.</p>
        </div>
        <div class="footer">
          This is an automated notification from the E-Government SOA Platform (Group VII).
        </div>
      </div>
    </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from: '"E-Government Academic Services" <noreply@academic.univ.dz>',
    to: student.email,
    subject: `[Notice] Update on your document request (${requestNumber})`,
    html
  });

  console.log(`[Mailer] Rejection email sent to ${student.email}. MessageId: ${info.messageId}`);
  return info;
}

