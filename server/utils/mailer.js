const nodemailer = require("nodemailer");

const isProd = process.env.NODE_ENV === "production";
let transporter = null;

if (process.env.SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    if (!isProd) {
      // Development fallback: print instead of sending
      console.log(`\n[mail not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    } else {
      console.warn("SMTP is not configured: email was not sent.");
    }
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail };