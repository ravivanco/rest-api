/**
 * Clase base para todos los errores de la API.
 * Al lanzar un AppError, el errorHandler sabe exactamente
 * qué código HTTP y qué mensaje enviar al cliente.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 — Datos de entrada no válidos */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/** 401 — Sin autenticación o token inválido */
export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 403 — Autenticado pero sin permiso para esta acción */
export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 — El recurso solicitado no existe */
export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, 404, 'NOT_FOUND');
  }
}

/** 409 — Conflicto: el recurso ya existe */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/** 422 — Violación de regla de negocio */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION');
  }
}

/** 429 — Demasiadas peticiones */
export class RateLimitError extends AppError {
  constructor(message = 'Demasiadas peticiones. Intenta en unos minutos.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}