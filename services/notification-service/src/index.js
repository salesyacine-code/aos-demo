import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { notificationStore } from './notificationStore.js';
import { notificationConsumer } from './rabbitmq.js';
import { transporter } from './mailer.js';
import { notificationSwaggerDocument } from './swagger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8004;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Swagger Documentation UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(notificationSwaggerDocument, {
  customSiteTitle: 'Notification Service API Docs'
}));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    totalNotificationsSent: notificationStore.notifications.length,
    rabbitMQConnected: notificationConsumer.isListening
  });
});

// GET /api/notifications - List all notifications sent
app.get(['/api/notifications', '/notifications', '/'], (req, res) => {
  res.json(notificationStore.getAll());
});

// POST /api/notifications/test-email - Diagnostic email to Mailpit
app.post(['/api/notifications/test-email', '/notifications/test-email', '/test-email'], async (req, res) => {
  const { to } = req.body;
  try {
    const info = await transporter.sendMail({
      from: '"E-Government System" <noreply@academic.univ.dz>',
      to: to || 'test.student@example.dz',
      subject: 'Test Notification from SOA Platform (Group VII)',
      text: 'This is a test notification confirming that Mailpit SMTP integration is operational.',
      html: '<p>This is a <strong>test notification</strong> confirming that Mailpit SMTP integration is operational.</p>'
    });

    notificationStore.record({
      type: 'DIAGNOSTIC_EMAIL',
      requestId: 'N/A',
      requestNumber: 'TEST-0001',
      recipient: to || 'test.student@example.dz',
      studentName: 'Test Student',
      status: 'SENT',
      messageId: info.messageId
    });

    res.json({ message: 'Diagnostic email sent successfully', messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test email', details: err.message });
  }
});

// Bootstrap server and start RabbitMQ consumer in background
async function bootstrap() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [NotificationService] Running on port ${PORT}`);
    console.log(`📖 [NotificationService] Swagger docs available at http://localhost:${PORT}/docs`);
  });

  notificationConsumer.start().catch(err => {
    console.warn('[NotificationService] RabbitMQ background consumer notice:', err.message);
  });
}

bootstrap().catch(err => {
  console.error('[NotificationService] Bootstrap error:', err);
});

