const https = require('https');
const nodemailer = require('nodemailer');
const { config } = require('./environment');
const { logger } = require('../utils/logger');
const { getDb } = require('./firebaseAdmin');

const isSmtpConfigured = Boolean(
  config.email.host &&
  config.email.user &&
  config.email.password
);

const isResendConfigured = Boolean(config.email.resendApiKey);

let transporter = null;

if (isSmtpConfigured) {
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.password
    }
  });
  logger.info('Email service initialized with SMTP transport', { host: config.email.host });
} else if (isResendConfigured) {
  logger.info('Email service initialized with Resend API transport');
} else {
  logger.warn('Email service unconfigured. Emails will be logged to console and database rather than dispatched.');
}

function sendViaResend({ to, subject, html, text }) {
  return new Promise((resolve) => {
    // If sender email is not on a verified custom domain, Resend requires onboarding@resend.dev
    const from = config.email.from && !config.email.from.includes('gmail.com')
      ? config.email.from
      : 'The Lane4 Performance Store <onboarding@resend.dev>';

    const postData = JSON.stringify({
      from,
      to,
      subject,
      html,
      text: text || undefined
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, messageId: body.id, status: 'sent' });
          } else {
            resolve({
              success: false,
              status: 'resend_sandbox_restricted',
              error: body.message || 'Resend delivery failed'
            });
          }
        } catch (_) {
          resolve({ success: false, status: 'failed', error: 'Malformed response from Resend' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, status: 'failed', error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Base email dispatch function
 */
async function sendMail({ to, subject, html, text = '', templateName = 'custom' }) {
  const db = getDb();

  if (config.env === 'test' || process.env.NODE_ENV === 'test') {
    logger.info(`[EMAIL SIMULATION] To: ${to} | Subject: ${subject}`);
    return { success: true, status: 'test_simulated', messageId: 'test_msg_id' };
  }

  // 1. Try SMTP if configured
  if (isSmtpConfigured && transporter) {
    try {
      const info = await transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        text,
        html
      });

      logger.info('Email sent successfully via SMTP', { messageId: info.messageId, to, subject });

      if (db) {
        await db.collection('emailLogs').add({
          to,
          subject,
          template: templateName,
          status: 'sent',
          messageId: info.messageId,
          timestamp: new Date()
        });
      }

      return { success: true, messageId: info.messageId, status: 'sent' };
    } catch (error) {
      logger.error('Failed to send email via SMTP', error);

      if (db) {
        await db.collection('emailLogs').add({
          to,
          subject,
          template: templateName,
          status: 'failed',
          error: error.message,
          timestamp: new Date()
        });
      }

      return { success: false, status: 'failed', error: error.message };
    }
  }

  // 2. Try Resend API if configured
  if (isResendConfigured) {
    const result = await sendViaResend({ to, subject, html, text });
    if (result.success) {
      logger.info('Email sent successfully via Resend', { messageId: result.messageId, to, subject });
      if (db) {
        await db.collection('emailLogs').add({
          to,
          subject,
          template: templateName,
          status: 'sent',
          messageId: result.messageId,
          timestamp: new Date()
        });
      }
      return result;
    } else {
      logger.info(`[EMAIL LOGGED] To: ${to} | Subject: ${subject} (${result.error})`);
      if (db) {
        await db.collection('emailLogs').add({
          to,
          subject,
          template: templateName,
          status: 'sandbox_logged',
          error: result.error,
          timestamp: new Date()
        });
      }
      return { success: false, status: 'logged', message: result.error };
    }
  }

  // 3. Fallback when unconfigured
  logger.info(`[EMAIL SIMULATION] To: ${to} | Subject: ${subject}`);
  try {
    if (db) {
      await db.collection('emailLogs').add({
        to,
        subject,
        template: templateName,
        status: 'unconfigured',
        error: 'SMTP credentials not configured in .env',
        timestamp: new Date()
      });
    }
  } catch (e) {}

  return {
    success: false,
    status: 'unconfigured',
    message: 'Email credentials not configured in .env'
  };
}

// Reusable branded email layout
function wrapBrandedTemplate(title, bodyHtml) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9fa; color: #1a1a1a; margin: 0; padding: 24px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
          .header { background: #000000; color: #ffffff; padding: 24px 32px; text-align: center; }
          .logo { font-size: 24px; font-weight: 800; letter-spacing: 2px; }
          .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #334155; }
          .h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
          .footer { background: #f8fafc; padding: 20px 32px; font-size: 13px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
          .btn { display: inline-block; background: #000000; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">LANE4</div>
            <div style="font-size: 12px; opacity: 0.8; letter-spacing: 1px; margin-top: 4px;">THE PERFORMANCE STORE · NAGPUR</div>
          </div>
          <div class="content">
            <div class="h1">${title}</div>
            ${bodyHtml}
          </div>
          <div class="footer">
            <p>The Lane4 Performance Store · Nagpur, Maharashtra, India</p>
            <p>Phone: +91 79725 41297 · Email: Lane4performancestore@gmail.com</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

module.exports = {
  sendMail,
  isEmailConfigured: () => isConfigured,
  wrapBrandedTemplate
};

