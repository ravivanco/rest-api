import { PoolClient } from 'pg';
import { pool } from '@database/pool';

export interface NutritionistProfileRow {
  id_perfil_nutricionista: number;
  numero_registro_profesional: string;
  especialidad: string | null;
  telefono_contacto: string | null;
  foto_perfil_url: string | null;
  horario_atencion: Record<string, { inicio: string; fin: string }> | null;
}

export interface AdminUserListItem {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  correo_institucional: string;
  rol: 'paciente' | 'nutricionista' | 'administrador';
  estado: 'activo' | 'inactivo' | 'suspendido';
  fecha_registro: string;
  ultimo_acceso: string | null;
  perfil_nutricionista: NutritionistProfileRow | null;
}

export interface AdminUserRow {
  id_usuario: number;
  correo_institucional: string;
  nombres: string;
  apellidos: string;
  edad: number;
  sexo: 'M' | 'F' | 'O';
  fecha_nacimiento: string;
  rol: 'paciente' | 'nutricionista' | 'administrador';
  estado: 'activo' | 'inactivo' | 'suspendido';
  fecha_registro: string;
}

const SORT_FIELD_MAP: Record<'fecha_registro' | 'nombres' | 'rol', string> = {
  fecha_registro: 'u.fecha_registro',
  nombres: 'u.nombres',
  rol: 'u.rol',
};

const buildUserPayload = (row: AdminUserListItem): AdminUserListItem => ({
  ...row,
  perfil_nutricionista: row.perfil_nutricionista
    ? {
      id_perfil_nutricionista: row.perfil_nutricionista.id_perfil_nutricionista,
      numero_registro_profesional: row.perfil_nutricionista.numero_registro_profesional,
      especialidad: row.perfil_nutricionista.especialidad,
      telefono_contacto: row.perfil_nutricionista.telefono_contacto,
      foto_perfil_url: row.perfil_nutricionista.foto_perfil_url,
      horario_atencion: row.perfil_nutricionista.horario_atencion,
    }
    : null,
});

export const adminRepository = {
  async listUsers(filters: {
    role?: 'paciente' | 'nutricionista' | 'administrador';
    status?: 'activo' | 'inactivo' | 'suspendido';
    search?: string;
    sortBy: 'fecha_registro' | 'nombres' | 'rol';
    sortOrder: 'asc' | 'desc';
    limit: number;
    offset: number;
  }): Promise<{ items: AdminUserListItem[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.role) {
      conditions.push(`u.rol = $${idx}`);
      params.push(filters.role);
      idx++;
    }

    if (filters.status) {
      conditions.push(`u.estado = $${idx}`);
      params.push(filters.status);
      idx++;
    }

    if (filters.search) {
      conditions.push(`(u.nombres ILIKE $${idx} OR u.apellidos ILIKE $${idx} OR u.correo_institucional ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortField = SORT_FIELD_MAP[filters.sortBy];
    const sortOrder = filters.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM usuarios u
       ${where}`,
      params,
    );

    const dataResult = await pool.query<AdminUserListItem>(
      `SELECT
          u.id_usuario,
          u.nombres,
          u.apellidos,
          u.correo_institucional,
          u.rol,
          u.estado,
          u.fecha_registro,
          la.ultimo_acceso,
          CASE WHEN pn.id_perfil_nutricionista IS NOT NULL THEN
            jsonb_build_object(
              'id_perfil_nutricionista', pn.id_perfil_nutricionista,
              'numero_registro_profesional', pn.numero_registro_profesional,
              'especialidad', pn.especialidad,
              'telefono_contacto', pn.telefono_contacto,
              'foto_perfil_url', pn.foto_perfil_url,
              'horario_atencion', pn.horario_atencion
            )
          ELSE NULL END AS perfil_nutricionista
       FROM usuarios u
       LEFT JOIN perfiles_nutricionista pn ON pn.id_usuario = u.id_usuario
       LEFT JOIN LATERAL (
         SELECT MAX(rt.created_at) AS ultimo_acceso
         FROM refresh_tokens rt
         WHERE rt.id_usuario = u.id_usuario
       ) la ON TRUE
       ${where}
       ORDER BY ${sortField} ${sortOrder}, u.id_usuario DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      items: dataResult.rows.map(buildUserPayload),
      total: parseInt(totalResult.rows[0].total, 10),
    };
  },

  async findUserById(idUsuario: number): Promise<AdminUserRow | null> {
    const result = await pool.query<AdminUserRow>(
      `SELECT
          id_usuario,
          correo_institucional,
          nombres,
          apellidos,
          edad,
          sexo,
          fecha_nacimiento,
          rol,
          estado,
          fecha_registro
       FROM usuarios
       WHERE id_usuario = $1`,
      [idUsuario],
    );

    return result.rows[0] ?? null;
  },

  async findAdminUserDetailById(idUsuario: number): Promise<AdminUserListItem | null> {
    const result = await pool.query<AdminUserListItem>(
      `SELECT
          u.id_usuario,
          u.nombres,
          u.apellidos,
          u.correo_institucional,
          u.rol,
          u.estado,
          u.fecha_registro,
          la.ultimo_acceso,
          CASE WHEN pn.id_perfil_nutricionista IS NOT NULL THEN
            jsonb_build_object(
              'id_perfil_nutricionista', pn.id_perfil_nutricionista,
              'numero_registro_profesional', pn.numero_registro_profesional,
              'especialidad', pn.especialidad,
              'telefono_contacto', pn.telefono_contacto,
              'foto_perfil_url', pn.foto_perfil_url,
              'horario_atencion', pn.horario_atencion
            )
          ELSE NULL END AS perfil_nutricionista
       FROM usuarios u
       LEFT JOIN perfiles_nutricionista pn ON pn.id_usuario = u.id_usuario
       LEFT JOIN LATERAL (
         SELECT MAX(rt.created_at) AS ultimo_acceso
         FROM refresh_tokens rt
         WHERE rt.id_usuario = u.id_usuario
       ) la ON TRUE
       WHERE u.id_usuario = $1`,
      [idUsuario],
    );

    const row = result.rows[0] ?? null;
    return row ? buildUserPayload(row) : null;
  },

  async existsEmail(correo: string, excludeUserId?: number): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1
        FROM usuarios
        WHERE correo_institucional = $1
          AND ($2::int IS NULL OR id_usuario <> $2)
      ) AS exists`,
      [correo, excludeUserId ?? null],
    );

    return result.rows[0].exists;
  },

  async existsNutritionistRegistry(numeroRegistro: string, excludeUserId?: number): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1
        FROM perfiles_nutricionista
        WHERE numero_registro_profesional = $1
          AND ($2::int IS NULL OR id_usuario <> $2)
      ) AS exists`,
      [numeroRegistro, excludeUserId ?? null],
    );

    return result.rows[0].exists;
  },

  async createNutritionistWithProfile(data: {
    correo_institucional: string;
    contrasena_hash: string;
    nombres: string;
    apellidos: string;
    edad: number;
    sexo: 'M' | 'F' | 'O';
    fecha_nacimiento: string;
    perfil_nutricionista: {
      numero_registro_profesional: string;
      especialidad?: string | null;
      telefono_contacto?: string | null;
      foto_perfil_url?: string | null;
      horario_atencion?: Record<string, { inicio: string; fin: string }> | null;
    };
  }): Promise<{ user: AdminUserRow; nutritionistProfile: NutritionistProfileRow }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query<AdminUserRow>(
        `INSERT INTO usuarios
           (correo_institucional, contrasena_hash, nombres, apellidos, edad, sexo, fecha_nacimiento, rol, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'nutricionista', 'activo')
         RETURNING
           id_usuario,
           correo_institucional,
           nombres,
           apellidos,
           edad,
           sexo,
           fecha_nacimiento,
           rol,
           estado,
           fecha_registro`,
        [
          data.correo_institucional,
          data.contrasena_hash,
          data.nombres,
          data.apellidos,
          data.edad,
          data.sexo,
          data.fecha_nacimiento,
        ],
      );

      const user = userResult.rows[0];

      const profileResult = await client.query<NutritionistProfileRow>(
        `INSERT INTO perfiles_nutricionista
           (id_usuario, numero_registro_profesional, especialidad, telefono_contacto, foto_perfil_url, horario_atencion)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING
           id_perfil_nutricionista,
           numero_registro_profesional,
           especialidad,
           telefono_contacto,
           foto_perfil_url,
           horario_atencion`,
        [
          user.id_usuario,
          data.perfil_nutricionista.numero_registro_profesional,
          data.perfil_nutricionista.especialidad ?? null,
          data.perfil_nutricionista.telefono_contacto ?? null,
          data.perfil_nutricionista.foto_perfil_url ?? null,
          data.perfil_nutricionista.horario_atencion ?? null,
        ],
      );

      await client.query('COMMIT');

      return {
        user,
        nutritionistProfile: profileResult.rows[0],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async updateUserAndProfile(data: {
    id_usuario: number;
    userFields: Partial<Pick<AdminUserRow, 'nombres' | 'apellidos' | 'correo_institucional' | 'edad' | 'sexo' | 'fecha_nacimiento'>>;
    nutritionistProfileFields?: {
      numero_registro_profesional?: string;
      especialidad?: string | null;
      telefono_contacto?: string | null;
      foto_perfil_url?: string | null;
      horario_atencion?: Record<string, { inicio: string; fin: string }> | null;
    };
  }): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (Object.keys(data.userFields).length > 0) {
        await this.updateUsuarioFields(client, data.id_usuario, data.userFields);
      }

      if (data.nutritionistProfileFields && Object.keys(data.nutritionistProfileFields).length > 0) {
        await this.updateNutritionistProfileFields(client, data.id_usuario, data.nutritionistProfileFields);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async updateUserStatus(idUsuario: number, estado: 'activo' | 'inactivo' | 'suspendido'): Promise<void> {
    await pool.query(
      `UPDATE usuarios
       SET estado = $1,
           updated_at = NOW()
       WHERE id_usuario = $2`,
      [estado, idUsuario],
    );
  },

  async updatePasswordAndRevokeTokens(data: { id_usuario: number; contrasena_hash: string }): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE usuarios
         SET contrasena_hash = $1,
             updated_at = NOW()
         WHERE id_usuario = $2`,
        [data.contrasena_hash, data.id_usuario],
      );

      await client.query(
        `UPDATE refresh_tokens
         SET revocado = TRUE,
             revocado_at = NOW()
         WHERE id_usuario = $1
           AND revocado = FALSE`,
        [data.id_usuario],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async findNutritionistProfileByUserId(idUsuario: number): Promise<NutritionistProfileRow | null> {
    const result = await pool.query<NutritionistProfileRow>(
      `SELECT
          id_perfil_nutricionista,
          numero_registro_profesional,
          especialidad,
          telefono_contacto,
          foto_perfil_url,
          horario_atencion
       FROM perfiles_nutricionista
       WHERE id_usuario = $1`,
      [idUsuario],
    );

    return result.rows[0] ?? null;
  },

  async updateUsuarioFields(
    client: PoolClient,
    idUsuario: number,
    fields: Partial<Pick<AdminUserRow, 'nombres' | 'apellidos' | 'correo_institucional' | 'edad' | 'sexo' | 'fecha_nacimiento'>>,
  ): Promise<void> {
    const updates = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (updates.length === 0) return;

    const values = updates.map(([, value]) => value);
    const setClause = updates
      .map(([column], index) => `${column} = $${index + 1}`)
      .join(', ');

    await client.query(
      `UPDATE usuarios
       SET ${setClause},
           updated_at = NOW()
       WHERE id_usuario = $${values.length + 1}`,
      [...values, idUsuario],
    );
  },

  async updateNutritionistProfileFields(
    client: PoolClient,
    idUsuario: number,
    fields: {
      numero_registro_profesional?: string;
      especialidad?: string | null;
      telefono_contacto?: string | null;
      foto_perfil_url?: string | null;
      horario_atencion?: Record<string, { inicio: string; fin: string }> | null;
    },
  ): Promise<void> {
    const updates = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (updates.length === 0) return;

    const values = updates.map(([, value]) => value);
    const setClause = updates
      .map(([column], index) => `${column} = $${index + 1}`)
      .join(', ');

    await client.query(
      `UPDATE perfiles_nutricionista
       SET ${setClause},
           updated_at = NOW()
       WHERE id_usuario = $${values.length + 1}`,
      [...values, idUsuario],
    );
  },
};
