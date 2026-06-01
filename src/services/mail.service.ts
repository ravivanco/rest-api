import nodemailer from 'nodemailer';
import { env } from '@config/env';

type TemporaryPasswordEmailParams = {
  to: string;
  name: string;
  temporaryPassword: string;
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
  auth: env.SMTP_USER
    ? {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    }
    : undefined,
});

export const sendTemporaryPasswordEmail = async (
  params: TemporaryPasswordEmailParams,
): Promise<void> => {
  ensureMailConfig();

  const { to, name, temporaryPassword } = params;

  await transporter.sendMail({
    from: env.MAIL_FROM,
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
};
