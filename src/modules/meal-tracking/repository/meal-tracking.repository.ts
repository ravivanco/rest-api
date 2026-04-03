import { pool } from '@database/pool';

export interface SeguimientoComidaRow {
  id_seguimiento_comida: number;
  id_menu_diario:        number;
  id_perfil:             number;
  fecha_registro:        string;
  realizado:             boolean;
  hora_registro:         string | null;
  hora_inicio?:          string;
  created_at:            string;
  // Datos del menú (JOIN)
  nombre_plato?:         string;
  nombre_tiempo?:        string;
  calorias_aportadas?:   number;
  dia_semana?:           string;
  fecha_menu?:           string;
}

export const mealTrackingRepository = {

  /**
   * Crea o actualiza el seguimiento de una comida.
   * ON CONFLICT actualiza si ya existe — el paciente puede cambiar de no realizado a realizado.
   */
  async upsert(data: {
    id_menu_diario: number;
    id_perfil:      number;
    realizado:      boolean;
    hora_registro?: string | null;
  }): Promise<SeguimientoComidaRow> {

    const result = await pool.query<SeguimientoComidaRow>(
      `INSERT INTO seguimiento_comidas
         (id_menu_diario, id_perfil, fecha_registro, realizado, hora_registro)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)
       ON CONFLICT (id_menu_diario, id_perfil)
       DO UPDATE SET
         realizado      = EXCLUDED.realizado,
         hora_registro  = EXCLUDED.hora_registro,
         fecha_registro = CURRENT_DATE,
         updated_at     = NOW()
       RETURNING *`,
      [
        data.id_menu_diario,
        data.id_perfil,
        data.realizado,
        data.hora_registro ?? null,
      ],
    );
    return result.rows[0];
  },


  /**
   * Busca el seguimiento de un menú específico para un perfil.
   */
  async findByMenuAndPerfil(
    menuId:   number,
    perfilId: number,
  ): Promise<SeguimientoComidaRow | null> {

    const result = await pool.query<SeguimientoComidaRow>(
      `SELECT sc.*,
              p.nombre    AS nombre_plato,
              tc.nombre   AS nombre_tiempo,
              md.calorias_aportadas,
              dp.dia_semana,
              dp.fecha    AS fecha_menu
       FROM   seguimiento_comidas sc
       JOIN   menus_diarios       md ON md.id_menu_diario  = sc.id_menu_diario
       JOIN   platos               p  ON p.id_plato        = md.id_plato
       JOIN   tiempos_comida       tc ON tc.id_tiempo_comida = md.id_tiempo_comida
       JOIN   dias_plan            dp ON dp.id_dia_plan    = md.id_dia_plan
       WHERE  sc.id_menu_diario = $1
         AND  sc.id_perfil      = $2`,
      [menuId, perfilId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Obtiene el seguimiento de todas las comidas del día actual del paciente.
   */
  async findTodayByPerfil(perfilId: number): Promise<SeguimientoComidaRow[]> {
    const result = await pool.query<SeguimientoComidaRow>(
      `SELECT md.id_menu_diario,
              md.calorias_aportadas,
              tc.nombre      AS nombre_tiempo,
              tc.orden,
              tc.hora_inicio,
              p.nombre       AS nombre_plato,
              dp.dia_semana,
              dp.fecha       AS fecha_menu,
              sc.id_seguimiento_comida,
              sc.realizado,
              sc.hora_registro,
              sc.fecha_registro
       FROM   dias_plan             dp
       JOIN   planes_semanales      ps  ON ps.id_semana       = dp.id_semana
       JOIN   planes_nutricionales  pn  ON pn.id_plan         = ps.id_plan
       JOIN   menus_diarios         md  ON md.id_dia_plan     = dp.id_dia_plan
       JOIN   tiempos_comida        tc  ON tc.id_tiempo_comida = md.id_tiempo_comida
       JOIN   platos                p   ON p.id_plato         = md.id_plato
       LEFT JOIN seguimiento_comidas sc
         ON sc.id_menu_diario = md.id_menu_diario
        AND sc.id_perfil      = $1
       WHERE  pn.id_perfil   = $1
         AND  pn.estado       = 'activo'
         AND  pn.modulo_habilitado = TRUE
         AND  dp.fecha        = CURRENT_DATE
       ORDER BY tc.orden ASC`,
      [perfilId],
    );
    return result.rows;
  },


  /**
   * Obtiene el historial de seguimiento de comidas de un paciente por fecha.
   * Usado por la nutricionista en la web.
   */
  async findByPerfilAndDate(
    perfilId: number,
    fecha:    string,
  ): Promise<SeguimientoComidaRow[]> {

    const result = await pool.query<SeguimientoComidaRow>(
      `SELECT sc.*,
              p.nombre    AS nombre_plato,
              tc.nombre   AS nombre_tiempo,
              md.calorias_aportadas,
              dp.dia_semana,
              dp.fecha    AS fecha_menu
       FROM   seguimiento_comidas sc
       JOIN   menus_diarios       md ON md.id_menu_diario   = sc.id_menu_diario
       JOIN   platos               p  ON p.id_plato         = md.id_plato
       JOIN   tiempos_comida       tc ON tc.id_tiempo_comida = md.id_tiempo_comida
       JOIN   dias_plan            dp ON dp.id_dia_plan     = md.id_dia_plan
       WHERE  sc.id_perfil    = $1
         AND  sc.fecha_registro = $2
       ORDER  BY tc.orden ASC`,
      [perfilId, fecha],
    );
    return result.rows;
  },


  /**
   * Obtiene las calorías totales realizadas hoy por el paciente.
   * Solo suma las comidas marcadas como realizadas.
   */
  async getTodayCaloriesFromPlan(perfilId: number): Promise<number> {
    const result = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(md.calorias_aportadas), 0) AS total
       FROM   seguimiento_comidas sc
       JOIN   menus_diarios       md ON md.id_menu_diario = sc.id_menu_diario
       WHERE  sc.id_perfil      = $1
         AND  sc.realizado      = TRUE
         AND  sc.fecha_registro = CURRENT_DATE`,
      [perfilId],
    );
    return parseInt(result.rows[0].total);
  },


  /**
   * Obtiene las calorías del menú de un día específico (con JOIN al menú).
   * Se usa para saber cuántas calorías actualizar en control_calorico.
   */
  async getMenuCalories(menuId: number): Promise<number> {
    const result = await pool.query<{ calorias: number }>(
      `SELECT calorias_aportadas AS calorias
       FROM menus_diarios
       WHERE id_menu_diario = $1`,
      [menuId],
    );
    return result.rows[0]?.calorias ?? 0;
  },


  /**
   * Obtiene la fecha del menú (fecha del día del plan al que pertenece).
   */
  async getMenuDate(menuId: number): Promise<string | null> {
    const result = await pool.query<{ fecha: string; id_perfil_plan: number }>(
      `SELECT dp.fecha, pn.id_perfil AS id_perfil_plan
       FROM   menus_diarios        md
       JOIN   dias_plan            dp ON dp.id_dia_plan = md.id_dia_plan
       JOIN   planes_semanales     ps ON ps.id_semana   = dp.id_semana
       JOIN   planes_nutricionales pn ON pn.id_plan     = ps.id_plan
       WHERE  md.id_menu_diario = $1`,
      [menuId],
    );
    return result.rows[0]?.fecha ?? null;
  },

};