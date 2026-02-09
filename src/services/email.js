import { Resend } from 'resend';
import logger from './logger.js';

let resend;

function getClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

async function sendVerificationCode(email, code) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const start = Date.now();

  try {
    const client = getClient();
    const result = await client.emails.send({
      from: `FamPlanner <${fromEmail}>`,
      to: email,
      subject: 'Your FamPlanner verification code',
      html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
    });

    const duration = Date.now() - start;
    logger.info('email', '2fa_sent', { to: email, duration });

    return result;
  } catch (err) {
    logger.error('email', 'send_failed', { to: email }, err.message);
    throw err;
  }
}

export default { sendVerificationCode };
