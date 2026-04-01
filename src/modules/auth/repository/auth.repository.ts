import { pool } from '@database/pool';

/**
 * Tipos que representan las filas de la base de datos.
 * Coinciden exactamente con las columnas de las tablas.
 */
export interface UsuarioRow {
  id_usuario:              number;
  correo_institucional:    string;
  contrasena_hash:         string;
  nombres:                 string;
  apellidos:               string;
  edad:                    number;
  sexo:                    string;
  fecha_nacimiento:        string;
  rol:                     string;
  estado:                  string;
  fecha_registro:          string;
}

export interface PerfilPacienteRow {
  id_perfil:            number;
  id_usuario:           number;
  formulario_completado: boolean;
}

export interface RefreshTokenRow {
  id_token:   number;
  id_usuario: number;
  token_hash: string;
  expires_at: string;
  revocado:   boolean;
}

/**
 * Repository de autenticación.
 * Todas las consultas SQL relacionadas con auth viven aquí.
 */
export const authRepository = {

  /**
   * Busca un usuario por su correo institucional.
   * Retorna null si no existe.
   */
  async findByEmail(correo: string): Promise<UsuarioRow | null> {
    const result = await pool.query<UsuarioRow>(
      `SELECT id_usuario, correo_institucional, contrasena_hash,
              nombres, apellidos, edad, sexo, fecha_nacimiento,
              rol, estado, fecha_registro
       FROM   usuarios
       WHERE  correo_institucional = $1
         AND  estado != 'eliminado'`,
      [correo],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Busca un usuario por su ID.
   * Retorna null si no existe.
   */
  async findById(id: number): Promise<UsuarioRow | null> {
    const result = await pool.query<UsuarioRow>(
      `SELECT id_usuario, correo_institucional, contrasena_hash,
              nombres, apellidos, edad, sexo, fecha_nacimiento,
              rol, estado, fecha_registro
       FROM   usuarios
       WHERE  id_usuario = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Verifica si un correo ya está registrado.
   * Más eficiente que findByEmail cuando solo necesitas saber si existe.
   */
  async existsByEmail(correo: string): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM usuarios WHERE correo_institucional = $1
       ) as exists`,
      [correo],
    );
    return result.rows[0].exists;
  },


  /**
   * Crea un nuevo usuario y su perfil de paciente en una transacción.
   * Si falla cualquier INSERT, se revierte todo (atomicidad).
   */
  async createUserWithProfile(data: {
    correo:          string;
    contrasenaHash:  string;
    nombres:         string;
    apellidos:       string;
    edad:            number;
    sexo:            string;
    fechaNacimiento: string;
  }): Promise<{ usuario: UsuarioRow; perfil: PerfilPacienteRow }> {

    // Obtener una conexión del pool para la transacción
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Crear el usuario
      const usuarioResult = await client.query<UsuarioRow>(
        `INSERT INTO usuarios
           (correo_institucional, contrasena_hash, nombres, apellidos,
            edad, sexo, fecha_nacimiento, rol, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'paciente', 'activo')
         RETURNING id_usuario, correo_institucional, contrasena_hash,
                   nombres, apellidos, edad, sexo, fecha_nacimiento,
                   rol, estado, fecha_registro`,
        [
          data.correo,
          data.contrasenaHash,
          data.nombres,
          data.apellidos,
          data.edad,
          data.sexo,
          data.fechaNacimiento,
        ],
      );

      const usuario = usuarioResult.rows[0];

      // Crear el perfil del paciente (vacío, formulario_completado = false)
      const perfilResult = await client.query<PerfilPacienteRow>(
        `INSERT INTO perfiles_paciente (id_usuario)
         VALUES ($1)
         RETURNING id_perfil, id_usuario, formulario_completado`,
        [usuario.id_usuario],
      );

      await client.query('COMMIT');

      return {
        usuario,
        perfil: perfilResult.rows[0],
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // SIEMPRE liberar la conexión de vuelta al pool
      client.release();
    }
  },


  /**
   * Obtiene el perfil del paciente por id_usuario.
   */
  async findPerfilByUserId(userId: number): Promise<PerfilPacienteRow | null> {
    const result = await pool.query<PerfilPacienteRow>(
      `SELECT id_perfil, id_usuario, formulario_completado
       FROM   perfiles_paciente
       WHERE  id_usuario = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Guarda un refresh token en la base de datos.
   * El token se guarda hasheado para que si la BD es comprometida,
   * los tokens no puedan usarse directamente.
   */
  async saveRefreshToken(data: {
    userId:    number;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO refresh_tokens (id_usuario, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [data.userId, data.tokenHash, data.expiresAt],
    );
  },


  /**
   * Busca un refresh token por su hash.
   * Retorna null si no existe o está revocado.
   */
  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
    const result = await pool.query<RefreshTokenRow>(
      `SELECT id_token, id_usuario, token_hash, expires_at, revocado
       FROM   refresh_tokens
       WHERE  token_hash = $1
         AND  revocado = FALSE
         AND  expires_at > NOW()`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Revoca un refresh token específico (logout).
   */
  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await pool.query(
      `UPDATE refresh_tokens
       SET    revocado    = TRUE,
              revocado_at = NOW()
       WHERE  token_hash  = $1`,
      [tokenHash],
    );
  },


  /**
   * Revoca TODOS los refresh tokens de un usuario.
   * Se usa cuando se detecta reutilización sospechosa de un token.
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    await pool.query(
      `UPDATE refresh_tokens
       SET    revocado    = TRUE,
              revocado_at = NOW()
       WHERE  id_usuario  = $1
         AND  revocado    = FALSE`,
      [userId],
    );
  },


  /**
   * Actualiza la contraseña de un usuario.
   */
  async updatePassword(userId: number, newHash: string): Promise<void> {
    await pool.query(
      `UPDATE usuarios
       SET    contrasena_hash = $1,
              updated_at      = NOW()
       WHERE  id_usuario      = $2`,
      [newHash, userId],
    );
  },

};