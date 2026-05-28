import { pool } from '@database/pool';

export interface RecommendationResult {
  id_ejercicio: number;
  nombre: string;
  deporte: string | null;
  intensidad: string;
  minutos_sugeridos: number;
  calorias_quemadas_estimadas: number;
  preferido: boolean;
  advertencia_clinica: string | null;
}

export const exerciseRecommendationsService = {
  /**
   * Genera recomendaciones personalizadas de ejercicio para compensar calorías extras.
   */
  async getRecommendations(perfilId: number, calories: number): Promise<RecommendationResult[]> {
    // 1. Obtener los deportes de interés del paciente
    const deportesResult = await pool.query<{ deporte: string }>(
      `SELECT deporte FROM actividades_fisicas_intereses WHERE id_perfil = $1`,
      [perfilId],
    );
    const deportesPreferidos = deportesResult.rows.map(r => r.deporte.toLowerCase());

    // 2. Obtener las condiciones médicas del paciente
    const condicionesResult = await pool.query<{ nombre: string }>(
      `SELECT cm.nombre
       FROM paciente_condiciones pc
       JOIN condiciones_medicas cm ON cm.id_condicion = pc.id_condicion
       WHERE pc.id_perfil = $1`,
      [perfilId],
    );
    const condiciones = condicionesResult.rows.map(r => r.nombre.toLowerCase());
    
    // Buscar la condición de hipertensión (puede venir sin tilde como en los seeds)
    const tieneHipertension = condiciones.some(c => c.includes('hipertension') || c.includes('hipertensión'));

    // 3. Obtener todos los ejercicios activos del catálogo
    const ejerciciosResult = await pool.query<{
      id_ejercicio: number;
      nombre: string;
      categoria: string;
      duracion_min: number;
      intensidad: string;
      deporte: string | null;
    }>(
      `SELECT id_ejercicio, nombre, categoria, duracion_min, intensidad, deporte
       FROM ejercicios
       WHERE activo = TRUE`,
    );

    const recomendaciones: RecommendationResult[] = [];

    for (const ejer of ejerciciosResult.rows) {
      const intensidad = ejer.intensidad.toLowerCase();
      
      // Regla de seguridad: Si tiene hipertensión, evitar ejercicios de intensidad alta
      if (tieneHipertension && intensidad === 'alta') {
        continue;
      }

      // Determinar burn rate por minuto según la intensidad
      let burnRate = 8; // Por defecto intensidad media
      if (intensidad === 'baja') {
        burnRate = 5;
      } else if (intensidad === 'alta') {
        burnRate = 12;
      }

      // Calcular minutos sugeridos para quemar la cantidad de calorías solicitada
      let minutosSugeridos = Math.ceil(calories / burnRate);

      // Limitar a un rango lógico razonable (ej. min 10 min, max 90 min)
      if (minutosSugeridos < 10) minutosSugeridos = 10;
      if (minutosSugeridos > 90) minutosSugeridos = 90;

      // Calcular calorías quemadas estimadas reales
      const caloriasQuemadas = minutosSugeridos * burnRate;

      // Verificar si pertenece a los deportes preferidos del paciente
      const esPreferido = ejer.deporte ? deportesPreferidos.includes(ejer.deporte.toLowerCase()) : false;

      // Mensaje de advertencia clínica si es pertinente
      let advertencia: string | null = null;
      if (tieneHipertension && intensidad === 'media') {
        advertencia = 'Controla tu ritmo cardíaco y consulta con tu médico ante cualquier molestia.';
      }

      recomendaciones.push({
        id_ejercicio: ejer.id_ejercicio,
        nombre: ejer.nombre,
        deporte: ejer.deporte,
        intensidad: ejer.intensidad,
        minutos_sugeridos: minutosSugeridos,
        calorias_quemadas_estimadas: caloriasQuemadas,
        preferido: esPreferido,
        advertencia_clinica: advertencia,
      });
    }

    // 4. Ordenar las recomendaciones:
    //    - Primero los deportes preferidos del paciente.
    //    - Luego por la cercanía entre calorias_quemadas_estimadas y las calorías deseadas.
    //    - Por último, orden alfabético para que sea consistente.
    recomendaciones.sort((a, b) => {
      // Prioridad 1: Preferido vs No Preferido
      if (a.preferido && !b.preferido) return -1;
      if (!a.preferido && b.preferido) return 1;

      // Prioridad 2: Cercanía al objetivo de calorías
      const diffA = Math.abs(a.calorias_quemadas_estimadas - calories);
      const diffB = Math.abs(b.calorias_quemadas_estimadas - calories);
      if (diffA !== diffB) {
        return diffA - diffB;
      }

      // Prioridad 3: Orden alfabético
      return a.nombre.localeCompare(b.nombre);
    });

    // Retornar las mejores 4 recomendaciones
    return recomendaciones.slice(0, 4);
  }
};
