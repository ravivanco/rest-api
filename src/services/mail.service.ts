import nodemailer from 'nodemailer';
import { env } from '@config/env';

type TemporaryPasswordEmailParams = {
  to: string;
  name: string;
  temporaryPassword: string;
};

type MailErrorLike = {
  name?: string;
  message?: string;
  code?: string;
  command?: string;
  response?: string;
  responseCode?: number;
  stack?: string;
};

const MAIL_LOG_PREFIX = '[mail]';
const SMTP_TIMEOUT_MS = 15_000;

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email ? '***' : '(empty)';

  const visible = local.length <= 2 ? local[0] : `${local[0]}${local[local.length - 1]}`;
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
};

const logMailConfig = (): void => {
  console.info(`${MAIL_LOG_PREFIX} SMTP config`, {
    host: env.SMTP_HOST || '(empty)',
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER ? maskEmail(env.SMTP_USER) : '(empty)',
    passConfigured: Boolean(env.SMTP_PASS),
    passLength: env.SMTP_PASS?.length ?? 0,
    from: env.MAIL_FROM || '(empty)',
  });
};

const normalizeMailFrom = (from: string): string => {
  const trimmed = from.trim();
  const isWrappedInQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');

  if (isWrappedInQuotes && trimmed.includes('<') && trimmed.includes('>')) {
    const normalized = trimmed.slice(1, -1);
    console.warn(`${MAIL_LOG_PREFIX} MAIL_FROM has wrapping quotes. Normalizing value.`, {
      configured: trimmed,
      normalized,
    });
    return normalized;
  }

  return trimmed;
};

const logMailError = (context: string, error: unknown): void => {
  const mailError = error as MailErrorLike;
  const hint = mailError?.code === 'ETIMEDOUT' && mailError?.command === 'CONN'
    ? 'No se pudo abrir conexion TCP con el servidor SMTP. Revisa bloqueo de red/salida desde Render, host, puerto 587, firewall o proveedor SMTP.'
    : undefined;

  console.error(`${MAIL_LOG_PREFIX} ${context} failed`, {
    name: mailError?.name,
    message: mailError?.message,
    code: mailError?.code,
    command: mailError?.command,
    responseCode: mailError?.responseCode,
    response: mailError?.response,
    hint,
    stack: env.NODE_ENV !== 'production' ? mailError?.stack : undefined,
  });
};

const ensureMailConfig = (): void => {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.MAIL_FROM) {
    throw new Error('Configuracion SMTP incompleta. Revisa SMTP_HOST, SMTP_PORT y MAIL_FROM.');
  }

  if ((env.SMTP_USER && !env.SMTP_PASS) || (!env.SMTP_USER && env.SMTP_PASS)) {
    throw new Error('Configuracion SMTP incompleta. Revisa SMTP_USER y SMTP_PASS.');
  }
};

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  requireTLS: env.SMTP_PORT === 587,
  family: 4,
  connectionTimeout: SMTP_TIMEOUT_MS,
  greetingTimeout: SMTP_TIMEOUT_MS,
  socketTimeout: SMTP_TIMEOUT_MS,
  auth: env.SMTP_USER
    ? {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    }
    : undefined,
  tls: {
    minVersion: 'TLSv1.2',
  },
});

export const sendTemporaryPasswordEmail = async (
  params: TemporaryPasswordEmailParams,
): Promise<void> => {
  ensureMailConfig();

  const { to, name, temporaryPassword } = params;
  const from = normalizeMailFrom(env.MAIL_FROM);

  console.info(`${MAIL_LOG_PREFIX} Preparing temporary password email`, {
    to: maskEmail(to),
    name,
  });
  logMailConfig();

  try {
    await verifyMailConnection();

    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Acceso temporal a DK Fitt',
      html: `
        <div style="font-family: Arial, sans-serif; color: #222;">
          <h2>Bienvenido a DK Fitt</h2>
          <p>Hola ${name},</p>
          <p>Se ha generado una contrasena temporal para acceder al sistema.</p>
          <div style="padding: 12px; background: #f4f4f4; border-radius: 8px; font-size: 18px; font-weight: bold;">
            ${temporaryPassword}
          </div>
          <p>Al ingresar por primera vez, el sistema te pedira cambiar esta contrasena.</p>
          <p>Si no solicitaste este acceso, contacta con el administrador.</p>
        </div>
      `,
    });

    console.info(`${MAIL_LOG_PREFIX} Temporary password email sent`, {
      to: maskEmail(to),
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending,
      response: info.response,
    });
  } catch (error) {
    logMailError('Temporary password email', error);
    throw error;
  }
};

export const verifyMailConnection = async (): Promise<void> => {
  ensureMailConfig();
  logMailConfig();

  try {
    console.info(`${MAIL_LOG_PREFIX} Verifying SMTP connection...`);
    await transporter.verify();
    console.info(`${MAIL_LOG_PREFIX} SMTP connection verified`);
  } catch (error) {
    logMailError('SMTP verification', error);
    throw error;
  }
};
