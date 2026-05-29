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

/**
 * Normaliza cualquier valor de fecha (Date o String) al formato YYYY-MM-DD.
 */
export const formatDate = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    // Evitar desfase de zona horaria usando getUTCFullYear/Month/Date o toISOString
    return val.toISOString().split('T')[0];
  }
  return String(val).split('T')[0];
};