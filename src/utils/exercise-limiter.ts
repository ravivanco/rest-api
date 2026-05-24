import { pool } from '@database/pool';

/**
 * Limita una lista de ejercicios a una duración total máxima de 60 minutos.
 * Prioriza mantener los ejercicios completados en el listado para conservar el seguimiento del paciente,
 * y luego agrega los demás hasta alcanzar el límite diario de 60 minutos.
 */
export function limitExercisesTo60Minutes<T extends { duracion_min?: number; completado?: boolean; id_seguimiento_ejercicio?: any }>(
  exercises: T[]
): { limited: T[]; totalDuration: number } {
  let totalDuration = 0;
  const limited: T[] = [];

  // Clasificar completados (para preservar el registro del usuario)
  const completed = exercises.filter(
    e => e.completado === true || (e.id_seguimiento_ejercicio && e.completado !== false)
  );
  const other = exercises.filter(e => !completed.includes(e));

  for (const e of completed) {
    const dur = e.duracion_min || 0;
    if (totalDuration + dur <= 60) {
      limited.push(e);
      totalDuration += dur;
    }
  }

  for (const e of other) {
    const dur = e.duracion_min || 0;
    if (totalDuration + dur <= 60) {
      limited.push(e);
      totalDuration += dur;
    }
  }

  return { limited, totalDuration };
}

/**
 * Asegura que existan ejercicios programados para un día específico del plan de un paciente.
 * Si no existen, los autogenera de forma variada a partir del catálogo de ejercicios de su deporte de interés,
 * limitando el total a un máximo de 60 minutos, y los guarda en la base de datos para mantener consistencia.
 */
export async function ensureDailyExercisesExist(perfilId: number, idDiaPlan: number): Promise<any[]> {
  // 1. Verificar si ya existen ejercicios programados para este día
  const checkRes = await pool.query(
    `SELECT ed.id_ejercicio_diario,
            ed.id_ejercicio,
            e.nombre       AS nombre_ejercicio,
            e.duracion_min,
            e.intensidad,
            e.categoria,
            e.descripcion  AS descripcion_ejercicio
     FROM   ejercicios_diarios ed
     JOIN   ejercicios          e ON e.id_ejercicio = ed.id_ejercicio
     WHERE  ed.id_dia_plan = $1
     ORDER  BY e.nombre ASC`,
    [idDiaPlan]
  );

  if (checkRes.rows.length > 0) {
    return checkRes.rows;
  }

  // 2. Si no existen, obtener el deporte de interés del paciente
  const sportRes = await pool.query<{ deporte: string }>(
    `SELECT deporte FROM actividades_fisicas_intereses WHERE id_perfil = $1 LIMIT 1`,
    [perfilId]
  );
  const deporte = sportRes.rows[0]?.deporte || 'gimnasio';

  // 3. Obtener los ejercicios disponibles para ese deporte
  const exercisesRes = await pool.query<{
    id_ejercicio: number;
    nombre: string;
    duracion_min: number;
    intensidad: string;
    categoria: string;
    descripcion: string;
  }>(
    `SELECT id_ejercicio, nombre, duracion_min, intensidad, categoria, descripcion
     FROM   ejercicios
     WHERE  deporte = $1 AND activo = true`,
    [deporte]
  );

  if (exercisesRes.rows.length === 0) {
    return [];
  }

  // 4. Barajar (shuffle) los ejercicios aleatoriamente para garantizar variedad/rotación
  const poolEjercicios = [...exercisesRes.rows];
  for (let i = poolEjercicios.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poolEjercicios[i], poolEjercicios[j]] = [poolEjercicios[j], poolEjercicios[i]];
  }

  // 5. Seleccionar un subconjunto que sume un máximo de 60 minutos
  let totalDuration = 0;
  const seleccionados: typeof poolEjercicios = [];

  for (const ex of poolEjercicios) {
    const dur = ex.duracion_min || 0;
    if (totalDuration + dur <= 60) {
      seleccionados.push(ex);
      totalDuration += dur;
    }
  }

  // Si todos los ejercicios individuales superan los 60 minutos (caso atípico), agregar al menos el primero
  if (seleccionados.length === 0 && poolEjercicios.length > 0) {
    seleccionados.push(poolEjercicios[0]);
  }

  // 6. Insertar los ejercicios seleccionados en la base de datos
  const insertedRows: any[] = [];
  for (const ex of seleccionados) {
    const insertRes = await pool.query(
      `INSERT INTO ejercicios_diarios (id_dia_plan, id_ejercicio)
       VALUES ($1, $2)
       ON CONFLICT (id_dia_plan, id_ejercicio) DO NOTHING
       RETURNING *`,
      [idDiaPlan, ex.id_ejercicio]
    );

    if (insertRes.rows[0]) {
      insertedRows.push({
        id_ejercicio_diario: insertRes.rows[0].id_ejercicio_diario,
        id_ejercicio: ex.id_ejercicio,
        nombre_ejercicio: ex.nombre,
        duracion_min: ex.duracion_min,
        intensidad: ex.intensidad,
        categoria: ex.categoria,
        descripcion_ejercicio: ex.descripcion
      });
    }
  }

  return insertedRows;
}
