import { BusinessRuleError } from '@errors/AppError';

/**
 * Retorna la fecha actual del servidor en formato YYYY-MM-DD.
 * SIEMPRE usa la fecha del servidor — nunca confiar en la fecha del cliente.
 */
export const getTodayServer = (): string =>
  new Date().toISOString().split('T')[0];

/**
 * Valida que una fecha sea la fecha actual del servidor.
 * Implementa RN-03: solo se puede registrar cumplimiento hoy.
 *
 * @throws BusinessRuleError si la fecha no es hoy
 */
export const assertIsToday = (fechaAVerificar: string): void => {
  const today = getTodayServer();

  if (fechaAVerificar !== today) {
    throw new BusinessRuleError(
      `Solo puedes registrar cumplimiento en el día actual (${today}). ` +
      `La fecha del menú es ${fechaAVerificar}.`
    );
  }
};

/**
 * Retorna true si la fecha dada es la fecha actual del servidor.
 */
export const isToday = (fecha: string): boolean =>
  fecha === getTodayServer();