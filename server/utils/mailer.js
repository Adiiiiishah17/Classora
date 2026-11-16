const nodemailer = require("nodemailer");

const isProd = process.env.NODE_ENV === "production";
const BREVO_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
const FROM_NAME = process.env.MAIL_FROM_NAME || "Classora";

// Local development only: normal SMTP (Render blocks these ports on the free plan)
let smtp = null;
if (!BREVO_KEY && process.env.SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT || 465);
  smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendViaBrevo({ to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: recipients,
      subject,
      ...(html ? { htmlContent: html } : {}),
      ...(text ? { textContent: text } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${detail.slice(0, 200)}`);
  }
}

async function sendMail({ to, subject, text, html }) {
  if (BREVO_KEY) return sendViaBrevo({ to, subject, text, html });

  if (smtp) {
    return smtp.sendMail({ from: process.env.MAIL_FROM || FROM_EMAIL, to, subject, text, html });
  }

  if (!isProd) {
    // Development fallback: print instead of sending
    console.log(`\n[mail not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
  } else {
    console.warn("Email is not configured (set BREVO_API_KEY): the email was not sent.");
  }
}

module.exports = { sendMail };