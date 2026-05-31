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

export interface NutritionistDetailRow {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  correo_institucional: string;
  fecha_nacimiento: string;
  sexo: 'M' | 'F' | 'O';
  numero_registro_profesional: string;
  especialidad: string | null;
  telefono_contacto: string | null;
}

export interface ActivityLogRow {
  id_actividad: number;
  usuario: string;
  rol: 'paciente' | 'nutricionista' | 'administrador';
  accion: string;
  ip: string | null;
  fecha: string;
}

export interface ActivityLogInsertData {
  id_usuario: number | null;
  usuario: string;
  rol: 'paciente' | 'nutricionista' | 'administrador';
  accion: string;
  ip?: string | null;
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

const ACTIVITY_LOG_TABLE_CANDIDATES = [
  'historial_actividad',
  'historial_actividades',
  'activity_logs',
  'activity_log',
  'logs_actividad',
  'auditoria_actividades',
];

const ACTIVITY_LOG_COLUMN_CANDIDATES = {
  id: ['id_actividad', 'id_log', 'id_historial_actividad'],
  userId: ['id_usuario', 'usuario_id', 'id_user'],
  action: ['accion', 'descripcion', 'evento'],
  ip: ['ip', 'direccion_ip', 'ip_address'],
  date: ['fecha', 'created_at', 'fecha_registro', 'fecha_actividad'],
} as const;

type ActivityLogColumns = {
  id: string;
  userId: string;
  action: string;
  ip: string;
  date: string;
};

let activityLogSchemaCache: Promise<{ schemaName: string; tableName: string; columns: ActivityLogColumns }> | null = null;

const resolveFirstMatchingColumn = (availableColumns: Set<string>, candidates: readonly string[]): string | null => {
  for (const candidate of candidates) {
    if (availableColumns.has(candidate)) {
      return candidate;
    }
  }

  return null;
};

const resolveActivityLogSchema = async (): Promise<{ schemaName: string; tableName: string; columns: ActivityLogColumns }> => {
  if (!activityLogSchemaCache) {
    activityLogSchemaCache = (async () => {
      const tableResult = await pool.query<{ table_schema: string; table_name: string }>(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_name = ANY($1::text[])
        ORDER BY array_position($1::text[], table_name) ASC, table_schema ASC
        LIMIT 1
      `, [ACTIVITY_LOG_TABLE_CANDIDATES]);

      const tableRow = tableResult.rows[0];
      if (!tableRow) {
        throw new Error('No se encontró una tabla de historial de actividad');
      }

      const columnResult = await pool.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
      `, [tableRow.table_schema, tableRow.table_name]);

      const availableColumns = new Set(columnResult.rows.map((row) => row.column_name));

      const id = resolveFirstMatchingColumn(availableColumns, ACTIVITY_LOG_COLUMN_CANDIDATES.id);
      const userId = resolveFirstMatchingColumn(availableColumns, ACTIVITY_LOG_COLUMN_CANDIDATES.userId);
      const action = resolveFirstMatchingColumn(availableColumns, ACTIVITY_LOG_COLUMN_CANDIDATES.action);
      const ip = resolveFirstMatchingColumn(availableColumns, ACTIVITY_LOG_COLUMN_CANDIDATES.ip);
      const date = resolveFirstMatchingColumn(availableColumns, ACTIVITY_LOG_COLUMN_CANDIDATES.date);

      if (!id || !userId || !action || !date) {
        throw new Error(`La tabla ${tableRow.table_schema}.${tableRow.table_name} no tiene la estructura esperada para historial de actividad`);
      }

      return {
        schemaName: tableRow.table_schema,
        tableName: tableRow.table_name,
        columns: {
          id,
          userId,
          action,
          ip: ip ?? 'NULL',
          date,
        },
      };
    })();
  }

  return activityLogSchemaCache;
};

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

  async findNutritionistDetailByUserId(idUsuario: number): Promise<NutritionistDetailRow | null> {
    const result = await pool.query<NutritionistDetailRow>(
      `SELECT
          u.id_usuario,
          u.nombres,
          u.apellidos,
          u.correo_institucional,
          u.fecha_nacimiento,
          u.sexo,
          pn.numero_registro_profesional,
          pn.especialidad,
          pn.telefono_contacto
       FROM usuarios u
       INNER JOIN perfiles_nutricionista pn ON pn.id_usuario = u.id_usuario
       WHERE u.id_usuario = $1`,
      [idUsuario],
    );

    return result.rows[0] ?? null;
  },

  async listActivityLogs(filters: {
    rol?: 'paciente' | 'nutricionista' | 'administrador';
    search?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: ActivityLogRow[]; total: number }> {
    const { schemaName, tableName, columns } = await resolveActivityLogSchema();
    const activityTable = `${schemaName}.${tableName}`;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.rol) {
      conditions.push(`COALESCE(u.rol, a.rol) = $${idx}`);
      params.push(filters.rol);
      idx++;
    }

    if (filters.search) {
      conditions.push(`(
        a.usuario ILIKE $${idx}
        OR u.correo_institucional ILIKE $${idx}
        OR u.nombres ILIKE $${idx}
        OR u.apellidos ILIKE $${idx}
        OR a.${columns.action} ILIKE $${idx}
      )`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    if (filters.fecha_desde) {
      conditions.push(`a.${columns.date}::date >= $${idx}::date`);
      params.push(filters.fecha_desde);
      idx++;
    }

    if (filters.fecha_hasta) {
      conditions.push(`a.${columns.date}::date <= $${idx}::date`);
      params.push(filters.fecha_hasta);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM ${activityTable} a
       LEFT JOIN usuarios u ON u.id_usuario = a.${columns.userId}
       ${where}`,
      params,
    );

    const dataResult = await pool.query<ActivityLogRow>(
      `SELECT
          a.${columns.id} AS id_actividad,
          COALESCE(u.correo_institucional, a.usuario) AS usuario,
          COALESCE(u.rol, a.rol) AS rol,
          a.${columns.action} AS accion,
          ${columns.ip === 'NULL' ? 'NULL' : `a.${columns.ip}`} AS ip,
          a.${columns.date} AS fecha
         FROM ${activityTable} a
       LEFT JOIN usuarios u ON u.id_usuario = a.${columns.userId}
       ${where}
       ORDER BY a.${columns.date} DESC, a.${columns.id} DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      items: dataResult.rows,
      total: parseInt(totalResult.rows[0].total, 10),
    };
  },

  async createActivityLog(data: ActivityLogInsertData): Promise<void> {
    const { schemaName, tableName, columns } = await resolveActivityLogSchema();
    const activityTable = `${schemaName}.${tableName}`;

    const idColumn = columns.id;
    const userIdColumn = columns.userId;
    const actionColumn = columns.action;
    const ipColumn = columns.ip === 'NULL' ? null : columns.ip;
    const dateColumn = columns.date;

    const columnNames = [
      idColumn,
      userIdColumn,
      'usuario',
      'rol',
      actionColumn,
      ...(ipColumn ? [ipColumn] : []),
      dateColumn,
    ];

    const values = [
      data.id_usuario,
      data.usuario,
      data.rol,
      data.accion,
      ...(ipColumn ? [data.ip ?? null] : []),
    ];

    const placeholders = [
      'DEFAULT',
      '$1',
      '$2',
      '$3',
      '$4',
      ...(ipColumn ? ['$5'] : []),
      'DEFAULT',
    ];

    await pool.query(
      `INSERT INTO ${activityTable}
         (${columnNames.join(', ')})
       VALUES (${placeholders.join(', ')})`,
      values,
    );
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
