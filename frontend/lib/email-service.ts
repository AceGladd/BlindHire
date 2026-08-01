import nodemailer from "nodemailer";

/**
 * Mock email service — simulates sending interview credentials.
 * Replace with a real transactional email provider (e.g., Resend, SendGrid).
 */

interface InterviewCredentials {
  readonly candidateId: number;
  readonly email: string;
  readonly fullName: string;
  readonly interviewPassword: string;
  readonly interviewLink: string;
}

function generatePassword(length: number = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateInterviewLink(candidateId: number): string {
  const token = crypto.randomUUID().slice(0, 12);
  return `/interview/password-check?cid=${candidateId}&token=${token}`;
}

export function sendInterviewInvitation(
  candidateId: number,
  email: string,
  fullName: string
): InterviewCredentials {
  const interviewPassword = generatePassword();
  const interviewLink = generateInterviewLink(candidateId);

  const credentials: InterviewCredentials = {
    candidateId,
    email,
    fullName,
    interviewPassword,
    interviewLink,
  };

  // ── Mock: Log to console instead of sending a real email ──
  console.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.info("📧 MOCK EMAIL — Mülakat Daveti");
  console.info(`   Alıcı: ${fullName} <${email}>`);
  console.info(`   Aday ID: #${candidateId}`);
  console.info(`   Mülakat Şifresi: ${interviewPassword}`);
  console.info(`   Mülakat Linki: ${interviewLink}`);
  console.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return credentials;
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  fullName?: string
): Promise<boolean> {
  try {
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      tls: { rejectUnauthorized: false }
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #0d0d12; color: #ffffff; padding: 40px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #222;">
        <h2 style="color: #22d3ee; margin-top: 0;">BlindHire — Şifre Sıfırlama</h2>
        <p style="color: #cccccc; font-size: 14px;">Merhaba ${fullName || "Kullanıcı"},</p>
        <p style="color: #cccccc; font-size: 14px;">Hesabınız için şifre sıfırlama talebinde bulunulmuştur. Doğrulama kodunuz aşağıdadır:</p>
        <div style="background: rgba(34, 211, 238, 0.1); border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ffffff; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #888888; font-size: 12px;">Bu kod 10 dakika süreyle geçerlidir. Eğer şifre sıfırlama talebinde bulunmadıysanız bu e-postayı dikkate almayınız.</p>
        <hr style="border: 0; border-top: 1px solid #222; margin-top: 30px;" />
        <p style="color: #555555; font-size: 11px; text-align: center;">© BlindHire AI Recruitment Systems</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"BlindHire Güvenlik" <noreply@blindhire.ai>',
      to: email,
      subject: "BlindHire — Şifre Sıfırlama Doğrulama Kodu",
      html: htmlContent,
    });

    console.info(`[EMAIL] 6 Haneli Şifre Sıfırlama Kodu ${email} adresine e-posta ile gönderildi.`);
    return true;
  } catch (err) {
    console.error("[EMAIL_SEND_ERROR]", err);
    return false;
  }
}

export type { InterviewCredentials };
