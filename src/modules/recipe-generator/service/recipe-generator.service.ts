import { pool } from '@database/pool';
import {
  AppError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from '@errors/AppError';
import {
  GET_ALIMENTOS_DETALLE_ALL,
  GET_ALIMENTOS_DETALLE_BY_CATEGORIAS,
  GET_APTITUDES_CLINICAS_BY_IDS,
  GET_CONDICIONES,
  GET_INGREDIENTES_PLATO,
  GET_PERFIL_EVALUACION,
  GET_PREFERENCIAS,
  FIND_CACHED_PLATO,
  FIND_CACHED_PLATO_GENERIC,
  INSERT_MENU_DIARIO,
  INSERT_PLATO,
  INSERT_PLATO_APTITUD,
  INSERT_PLATO_INGREDIENTE,
  MATCH_INGREDIENTE_POR_NOMBRE,
  MATCH_ALIMENTO_POR_NOMBRE,
  GET_CATALOGO_NOMBRES,
  GET_PLAN_CON_PERFIL,
  GET_SEMANA_DEL_PLAN,
  GET_DIAS_SEMANA,
  GET_TIEMPOS_COMIDA_ACTIVOS,
  GET_MENUS_SEMANA,
  GET_TIEMPO_COMIDA_BY_ID,
} from '../recipe-generator.queries';
import {
  GenerateRecipeDto,
  GenerateGenericDto,
  GeneratedRecipeResult,
  TiempoComidaNombre,
  GenerateWeekDto,
  GenerateWeekResult,
  DiaPlanResult,
  MenuDiarioSlot,
} from '../dto/generate-recipe.dto';

const OPENAI_MODEL = 'gpt-4o';
const OPENAI_TEMPERATURE = 0.7;
const OPENAI_MAX_TOKENS = 1200;
const MAX_CALORIAS_PLATO = 32767;
const MAX_INTENTOS_GPT = 3;
const MIN_RECETAS_PARA_CACHE = 3;
const PROBABILIDAD_CACHE = 0.70;

const APTITUD_A_INSTRUCCION: Record<number, string> = {
  1: 'apta para pacientes en general sin restricciones especiales',
  2: 'ESTRICTAMENTE sin azucares simples, sin miel, sin mermelada, sin harinas refinadas, bajo indice glucemico — apta para diabeticos',
  3: 'ESTRICTAMENTE baja en sodio, sin ultraprocesados, sin embutidos, sin enlatados — apta para hipertensos',
  4: 'ESTRICTAMENTE sin gluten: sin trigo, cebada, centeno, avena (a menos que sea avena certificada sin gluten) — apta para celiacos',
  5: 'ESTRICTAMENTE sin lactosa: sin leche, queso, yogur, mantequilla, crema — apta para intolerantes a la lactosa',
  6: 'ESTRICTAMENTE sin carne, sin pollo, sin pescado, sin mariscos — apta para vegetarianos. Puede incluir huevo y lacteos',
  7: 'ESTRICTAMENTE sin ningun producto de origen animal: sin carne, sin pollo, sin pescado, sin huevo, sin leche, sin queso, sin miel, sin mantequilla — apta para veganos',
  8: 'ESTRICTAMENTE baja en proteinas (maximo 15g por porcion) y baja en sodio — apta para insuficiencia renal',
};

interface PerfilEvaluacionRow {
  id_perfil: number;
  nivel_actividad_fisica: string;
  objetivo: string | null;
  alergias_intolerancias: string | null;
  restricciones_alimenticias: string | null;
  peso_kg: number;
  imc: number;
  calorias_diarias_calculadas: number | null;
  distribucion_carbohidratos_pct: number | null;
  distribucion_proteinas_pct: number | null;
  distribucion_grasas_pct: number | null;
}

interface CondicionRow {
  nombre: string;
}

interface PreferenciaRow {
  nombre: string;
  categoria: string;
  tipo: 'preferido' | 'restringido';
}

interface AlimentoDetalleRow {
  id_alimento_detalle: number;
  nombre: string;
  categoria: string;
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra: number | null;
  sodio: number | null;
}

interface AptitudClinicaRow {
  id_aptitud: number;
  nombre: string;
}

interface RecipeGptPromptIngredient {
  nombre_ingrediente: string;
  cantidad_g: unknown;
}

interface RecipeGptPromptResponse {
  nombre: string;
  descripcion: string | null;
  tiempo_preparacion_min: number | null;
  modo_preparacion: string;
  ingredientes: RecipeGptPromptIngredient[];
}

interface AlimentoMatchado {
  id_alimento_detalle?: number | null;
  id_alimento?: number | null;
  nombre: string;
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra: number | null;
  sodio: number | null;
}

interface IngredienteResuelto {
  id_alimento_detalle?: number | null;
  id_alimento?: number | null;
  nombre: string;
  cantidad_g: number;
  calorias_aportadas: number;
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra: number | null;
  sodio: number | null;
}

class IngredientesNoResueltosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngredientesNoResueltosError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface CachedPlatoRow {
  id_plato: number;
  nombre: string;
  descripcion: string | null;
  calorias_totales: number;
  tiempo_preparacion_min: number | null;
}

interface CachedIngredienteRow {
  id_alimento_detalle?: number | null;
  id_alimento?: number | null;
  nombre: string;
  cantidad_g: number;
  calorias_aportadas: number;
}

const TIEMPO_COMIDA_FACTORES: Record<TiempoComidaNombre, number> = {
  desayuno: 0.25,
  media_manana: 0.1,
  almuerzo: 0.35,
  media_tarde: 0.1,
  cena: 0.2,
};

// Mapea el nombre de la BD al TiempoComidaNombre del sistema
const mapearNombreTiempo = (nombre: string): TiempoComidaNombre => {
  const normalized = normalizeText(nombre);
  const mapa: Record<string, TiempoComidaNombre> = {
    'desayuno': 'desayuno',
    'refrigerio manana': 'media_manana',
    'refrigerio mañana': 'media_manana',
    'media manana': 'media_manana',
    'almuerzo': 'almuerzo',
    'refrigerio tarde': 'media_tarde',
    'media tarde': 'media_tarde',
    'cena': 'cena',
  };
  return mapa[normalized] ?? 'almuerzo';
};

const buscarRecetaSimilar = async (
  ingredientesResueltos: IngredienteResuelto[],
  idTiempoComida: number,
  caloriasObjetivo: number,
): Promise<number | null> => {
  const tolerancia = 100;

  const candidatos = await pool.query<{ id_plato: number }>(
    `SELECT id_plato FROM platos
     WHERE id_tiempo_comida = $1
       AND generado_por_ia = true
       AND activo = true
       AND calorias_totales BETWEEN $2 AND $3`,
    [idTiempoComida, caloriasObjetivo - tolerancia, caloriasObjetivo + tolerancia],
  );

  if (candidatos.rows.length === 0) return null;

  const idsNuevos = new Set(
    ingredientesResueltos
      .map(i => i.id_alimento_detalle)
      .filter((id): id is number => typeof id === 'number'),
  );

  for (const { id_plato } of candidatos.rows) {
    const ingsResult = await pool.query<{ id_alimento_detalle: number }>(
      `SELECT id_alimento_detalle FROM plato_ingredientes
       WHERE id_plato = $1 AND id_alimento_detalle IS NOT NULL`,
      [id_plato],
    );

    const idsExistentes = new Set(
      ingsResult.rows.map(r => r.id_alimento_detalle),
    );

    const coincidencias = [...idsNuevos]
      .filter(id => idsExistentes.has(id)).length;
    const total = Math.max(idsNuevos.size, idsExistentes.size);
    const similitud = total > 0 ? coincidencias / total : 0;

    if (similitud >= 0.8) {
      console.log(
        `[recipe-generator] Receta similar: id=${id_plato},`,
        `similitud=${Math.round(similitud * 100)}%`,
      );
      return id_plato;
    }
  }

  return null;
};

const resolverNombreUnico = async (nombre: string): Promise<string> => {
  const existeResult = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM platos WHERE nombre = $1',
    [nombre],
  );

  if (parseInt(existeResult.rows[0].count) === 0) {
    return nombre;
  }

  const sufijoResult = await pool.query<{ nombre: string }>(
    `SELECT nombre FROM platos
     WHERE nombre LIKE $1
     ORDER BY LENGTH(nombre) DESC, nombre DESC
     LIMIT 1`,
    [`${nombre} v%`],
  );

  if (sufijoResult.rows.length === 0) {
    return `${nombre} v2`;
  }

  const ultimoNombre = sufijoResult.rows[0].nombre;
  const match = ultimoNombre.match(/ v(\d+)$/);
  const ultimoNumero = match ? parseInt(match[1]) : 1;
  return `${nombre} v${ultimoNumero + 1}`;
};

const contarRecetasCompatibles = async (
  idTiempoComida: number,
  caloriasObjetivo: number,
  idPerfil: number,
): Promise<number> => {
  const tolerancia = 80;
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM platos p
     WHERE p.id_tiempo_comida = $1
       AND p.activo = true
       AND p.generado_por_ia = true
       AND p.calorias_totales BETWEEN $2 AND $3`,
    [idTiempoComida, caloriasObjetivo - tolerancia, caloriasObjetivo + tolerancia],
  );
  return parseInt(result.rows[0].count);
};

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const UNIDADES_A_GRAMOS: Record<string, number> = {
  taza_arroz: 185,
  taza_avena: 90,
  taza_harina: 120,
  taza_leche: 240,
  taza_agua: 240,
  taza_default: 150,
  cucharada: 14,
  cucharadita: 5,
  huevo: 60,
  platano: 120,
  manzana: 180,
};

const normalizarCantidad = (cantidad: unknown): number => {
  const numero = Number(cantidad);
  if (Number.isFinite(numero) && numero > 0) {
    return Math.round(numero);
  }

  if (typeof cantidad !== 'string') {
    return 0;
  }

  const texto = cantidad.toLowerCase().trim();

  const gramosMatch = texto.match(/^(\d+(?:[\.,]\d+)?)\s*(?:g|gr|gramos?)\b/);
  if (gramosMatch) {
    return Math.round(parseFloat(gramosMatch[1].replace(',', '.')));
  }

  const esMedia = texto.startsWith('media ');
  const textoSinMedia = esMedia ? texto.replace(/^media\s+/, '') : texto;

  if (textoSinMedia.includes('taza')) {
    let base = UNIDADES_A_GRAMOS.taza_default;

    if (textoSinMedia.includes('arroz')) {
      base = UNIDADES_A_GRAMOS.taza_arroz;
    } else if (textoSinMedia.includes('avena')) {
      base = UNIDADES_A_GRAMOS.taza_avena;
    } else if (textoSinMedia.includes('harina')) {
      base = UNIDADES_A_GRAMOS.taza_harina;
    } else if (textoSinMedia.includes('leche')) {
      base = UNIDADES_A_GRAMOS.taza_leche;
    } else if (textoSinMedia.includes('agua')) {
      base = UNIDADES_A_GRAMOS.taza_agua;
    }

    return esMedia ? Math.round(base / 2) : base;
  }

  if (textoSinMedia.includes('cucharadita')) {
    return esMedia ? Math.round(UNIDADES_A_GRAMOS.cucharadita / 2) : UNIDADES_A_GRAMOS.cucharadita;
  }

  if (textoSinMedia.includes('cucharada')) {
    return esMedia ? Math.round(UNIDADES_A_GRAMOS.cucharada / 2) : UNIDADES_A_GRAMOS.cucharada;
  }

  if (textoSinMedia.includes('huevo')) {
    return UNIDADES_A_GRAMOS.huevo;
  }

  if (textoSinMedia.includes('platano')) {
    return UNIDADES_A_GRAMOS.platano;
  }

  if (textoSinMedia.includes('manzana')) {
    return UNIDADES_A_GRAMOS.manzana;
  }

  return 0;
};

const getMacroDistribution = (objetivo: string | null): {
  carbs: number;
  proteinas: number;
  grasas: number;
} => {
  if (!objetivo) {
    return { carbs: 50, proteinas: 25, grasas: 25 };
  }

  const goal = normalizeText(objetivo);

  if (goal.includes('reducir') || goal.includes('disminuir') || goal.includes('bajar')) {
    return { carbs: 40, proteinas: 35, grasas: 25 };
  }

  if (goal.includes('ganar') || goal.includes('masa') || goal.includes('musculo')) {
    return { carbs: 45, proteinas: 30, grasas: 25 };
  }

  return { carbs: 50, proteinas: 25, grasas: 25 };
};

const buildMedicalRules = (condiciones: string[]): string[] => {
  const normalized = condiciones.map(normalizeText);
  const rules: string[] = [];

  if (normalized.some(c => c.includes('diabetes'))) {
    rules.push('sin azucares simples y con bajo indice glucemico');
  }

  if (normalized.some(c => c.includes('hipertension') || c.includes('presion alta'))) {
    rules.push('bajo sodio y evitar ultraprocesados');
  }

  if (normalized.some(c => c.includes('colesterol') || c.includes('dislipidemia'))) {
    rules.push('limitar grasas saturadas y frituras');
  }

  if (normalized.some(c => c.includes('celia') || c.includes('gluten'))) {
    rules.push('sin gluten');
  }

  if (normalized.some(c => c.includes('lactosa'))) {
    rules.push('evitar lactosa');
  }

  if (normalized.some(c => c.includes('renal') || c.includes('rinon'))) {
    rules.push('moderar proteinas y sodio');
  }

  return rules;
};

const normalizePerfil = (row: PerfilEvaluacionRow): PerfilEvaluacionRow => {
  const caloriasDiarias = row.calorias_diarias_calculadas !== null
    ? Number(row.calorias_diarias_calculadas)
    : null;

  if (caloriasDiarias !== null && !Number.isFinite(caloriasDiarias)) {
    throw new ValidationError('calorias_diarias_calculadas invalida en la evaluacion');
  }

  const carbs = row.distribucion_carbohidratos_pct !== null
    ? Number(row.distribucion_carbohidratos_pct)
    : null;
  const proteinas = row.distribucion_proteinas_pct !== null
    ? Number(row.distribucion_proteinas_pct)
    : null;
  const grasas = row.distribucion_grasas_pct !== null
    ? Number(row.distribucion_grasas_pct)
    : null;

  return {
    ...row,
    peso_kg: Number(row.peso_kg),
    imc: Number(row.imc),
    calorias_diarias_calculadas: caloriasDiarias,
    distribucion_carbohidratos_pct: Number.isFinite(carbs) ? carbs : null,
    distribucion_proteinas_pct: Number.isFinite(proteinas) ? proteinas : null,
    distribucion_grasas_pct: Number.isFinite(grasas) ? grasas : null,
  };
};

const matchIngrediente = async (
  nombreGpt: string,
  idPerfil: number | null,
): Promise<AlimentoMatchado | null> => {
  const nombreLimpio = nombreGpt
    .replace(/^\d+(?:[\.,]\d+)?\s*(?:g|gr|gramos?)?\s+de\s+/i, '')
    .replace(/^(media|medio|un|una|uno|dos)\s+/i, '')
    .trim();

  if (!nombreLimpio) return null;

  // 1. Intentar en alimentos_detalle (global)
  // Intento 1.1: match con el nombre completo
  let resultado1 = await pool.query<AlimentoMatchado>(
    MATCH_INGREDIENTE_POR_NOMBRE,
    [`%${nombreLimpio.toLowerCase()}%`, nombreLimpio],
  );
  if (resultado1.rows[0]) return { ...resultado1.rows[0], id_alimento_detalle: resultado1.rows[0].id_alimento_detalle };

  // Intento 1.2: solo la primera palabra
  const primeraPalabra = nombreLimpio.split(' ')[0];
  if (primeraPalabra && primeraPalabra.length > 3) {
    const resultado2 = await pool.query<AlimentoMatchado>(
      MATCH_INGREDIENTE_POR_NOMBRE,
      [`%${primeraPalabra.toLowerCase()}%`, primeraPalabra],
    );
    if (resultado2.rows[0]) return { ...resultado2.rows[0], id_alimento_detalle: resultado2.rows[0].id_alimento_detalle };
  }

  // 2. Intentar en alimentos (custom/globales de la otra tabla)
  // Intento 2.1: match con el nombre completo
  let resultado3 = await pool.query<AlimentoMatchado>(
    MATCH_ALIMENTO_POR_NOMBRE,
    [idPerfil, `%${nombreLimpio.toLowerCase()}%`, nombreLimpio],
  );
  if (resultado3.rows[0]) return { ...resultado3.rows[0], id_alimento: resultado3.rows[0].id_alimento };

  // Intento 2.2: solo la primera palabra
  if (primeraPalabra && primeraPalabra.length > 3) {
    const resultado4 = await pool.query<AlimentoMatchado>(
      MATCH_ALIMENTO_POR_NOMBRE,
      [idPerfil, `%${primeraPalabra.toLowerCase()}%`, primeraPalabra],
    );
    if (resultado4.rows[0]) return { ...resultado4.rows[0], id_alimento: resultado4.rows[0].id_alimento };
  }

  return null;
};

const resolverIngredientes = async (
  ingredientesGpt: RecipeGptPromptIngredient[],
  idPerfil: number | null,
): Promise<IngredienteResuelto[]> => {
  const resueltos: IngredienteResuelto[] = [];
  const noEncontrados: string[] = [];
  const idsDetalleUsados = new Set<number>();
  const idsAlimentoUsados = new Set<number>();

  for (const ingrediente of ingredientesGpt) {
    const cantidad = normalizarCantidad(ingrediente.cantidad_g);

    if (cantidad <= 0 || cantidad > 500) {
      console.warn(
        `[recipe-generator] Cantidad invalida: ${String(ingrediente.cantidad_g)} para "${ingrediente.nombre_ingrediente}"`,
      );
      noEncontrados.push(ingrediente.nombre_ingrediente);
      continue;
    }

    const alimento = await matchIngrediente(ingrediente.nombre_ingrediente, idPerfil);

    if (!alimento) {
      console.warn(`[recipe-generator] Sin match: "${ingrediente.nombre_ingrediente}"`);
      noEncontrados.push(ingrediente.nombre_ingrediente);
      continue;
    }

    if (alimento.id_alimento_detalle && idsDetalleUsados.has(alimento.id_alimento_detalle)) {
      console.warn(`[recipe-generator] Duplicado detalle ignorado: "${ingrediente.nombre_ingrediente}"`);
      continue;
    }
    if (alimento.id_alimento && idsAlimentoUsados.has(alimento.id_alimento)) {
      console.warn(`[recipe-generator] Duplicado alimento ignorado: "${ingrediente.nombre_ingrediente}"`);
      continue;
    }

    if (alimento.id_alimento_detalle) {
      idsDetalleUsados.add(alimento.id_alimento_detalle);
    }
    if (alimento.id_alimento) {
      idsAlimentoUsados.add(alimento.id_alimento);
    }

    resueltos.push({
      id_alimento_detalle: alimento.id_alimento_detalle,
      id_alimento: alimento.id_alimento,
      nombre: alimento.nombre,
      cantidad_g: cantidad,
      calorias_aportadas: Math.round((Number(alimento.calorias) * cantidad) / 100),
      calorias: Number(alimento.calorias),
      proteinas: Number(alimento.proteinas),
      carbohidratos: Number(alimento.carbohidratos),
      grasas: Number(alimento.grasas),
      fibra: alimento.fibra !== null ? Number(alimento.fibra) : null,
      sodio: alimento.sodio !== null ? Number(alimento.sodio) : null,
    });
  }

  const totalGpt = ingredientesGpt.length;
  const totalResueltos = resueltos.length;
  const porcentajeExito = totalGpt > 0 ? totalResueltos / totalGpt : 0;
  console.warn(`[resolverIngredientes] GPT envió: ${JSON.stringify(ingredientesGpt.map(i => i.nombre_ingrediente))}`);
  console.warn(`[resolverIngredientes] Sin match: ${JSON.stringify(noEncontrados)}`);
  console.warn(`[resolverIngredientes] Resueltos: ${totalResueltos}/${totalGpt}`);

  if (totalResueltos === 0 || porcentajeExito < 0.5) {
    throw new IngredientesNoResueltosError(
      `Solo ${totalResueltos}/${totalGpt} ingredientes encontrados: sin match para [${noEncontrados.join(', ')}]`,
    );
  }

  return resueltos;
};

const generarRecetaConReintentos = async (
  buildPromptFn: () => { system: string; user: string },
  idPerfil: number | null,
): Promise<{
  gptRecipe: RecipeGptPromptResponse;
  ingredientesResueltos: IngredienteResuelto[];
}> => {
  for (let intentoActual = 1; intentoActual <= MAX_INTENTOS_GPT; intentoActual++) {
    console.log(`[recipe-generator] Intento ${intentoActual}/${MAX_INTENTOS_GPT}`);

    try {
      const { system, user } = buildPromptFn();
      const gptRecipe = await callOpenAI(system, user);
      const ingredientesResueltos = await resolverIngredientes(gptRecipe.ingredientes, idPerfil);

      return { gptRecipe, ingredientesResueltos };
    } catch (error) {
      if (error instanceof IngredientesNoResueltosError) {
        console.warn(`[recipe-generator] Reintentando: ${error.message}`);

        if (intentoActual >= MAX_INTENTOS_GPT) {
          throw new ExternalServiceError(
            'OpenAI',
            `No se pudo generar una receta valida despues de ${MAX_INTENTOS_GPT} intentos`,
          );
        }

        continue;
      }

      throw error;
    }
  }

  throw new ExternalServiceError('OpenAI', 'Error inesperado en generacion');
};

const buildPrompt = (params: {
  perfil: PerfilEvaluacionRow;
  condiciones: string[];
  alimentosPreferidos: string[];
  alimentosRestringidos: string[];
  catalogoNombres: string[];
  caloriasObjetivo: number;
  tiempoComidaNombre: TiempoComidaNombre;
}): { system: string; user: string } => {
  const perfil = params.perfil;
  const condiciones = params.condiciones.length > 0 ? params.condiciones.join(', ') : 'ninguna';
  const alergias = perfil.alergias_intolerancias?.trim() || 'ninguna';
  const restricciones = perfil.restricciones_alimenticias?.trim() || 'ninguna';
  const seccionPreferencias = params.alimentosPreferidos.length > 0
    ? [
      '',
      'PREFERENCIAS ALIMENTICIAS DEL PACIENTE — ALTA PRIORIDAD:',
      'El paciente ha indicado que le gustan estos alimentos:',
      params.alimentosPreferidos.map(a => `- ${a}`).join('\n'),
      '',
      'INSTRUCCION OBLIGATORIA: Debes incluir AL MENOS UNO de estos',
      'alimentos preferidos como ingrediente principal de la receta.',
      'Si el alimento preferido no es adecuado para este tiempo de comida,',
      'incluye el siguiente de la lista que si lo sea.',
    ].join('\n')
    : '';

  const seccionRestringidos = params.alimentosRestringidos.length > 0
    ? [
      '',
      'ALIMENTOS PROHIBIDOS — NO INCLUIR BAJO NINGUNA CIRCUNSTANCIA:',
      params.alimentosRestringidos.map(a => `- ${a}`).join('\n'),
    ].join('\n')
    : '';

  const macros = {
    carbohidratos: perfil.distribucion_carbohidratos_pct,
    proteinas: perfil.distribucion_proteinas_pct,
    grasas: perfil.distribucion_grasas_pct,
  };

  const fallbackMacros = getMacroDistribution(perfil.objetivo);
  const macroText = `carbohidratos ${macros.carbohidratos ?? fallbackMacros.carbs}% | `
    + `proteinas ${macros.proteinas ?? fallbackMacros.proteinas}% | `
    + `grasas ${macros.grasas ?? fallbackMacros.grasas}%`;

  const rules = buildMedicalRules(params.condiciones);
  const reglasMedicas = rules.length > 0
    ? `Condiciones especiales: ${rules.join('; ')}.`
    : 'Condiciones especiales: ninguna.';

  const catalogoTexto = params.catalogoNombres.length > 0
    ? params.catalogoNombres.join('\n')
    : '- Sin catalogo disponible.';

  const system = 'Eres un nutricionista clinico experto en recetas personalizadas.';

  const user = [
    'Perfil del paciente:',
    `- Nivel de actividad: ${perfil.nivel_actividad_fisica}`,
    `- Objetivo: ${perfil.objetivo ?? 'no especificado'}`,
    `- Condiciones medicas: ${condiciones}`,
    `- Alergias/intolerancias: ${alergias}`,
    `- Restricciones alimenticias: ${restricciones}`,
    `- Peso: ${perfil.peso_kg} kg`,
    `- IMC: ${perfil.imc}`,
    '',
    'Requerimiento calorico:',
    `- Calorias diarias: ${perfil.calorias_diarias_calculadas ?? 'no disponible'}`,
    `- Distribucion macros: ${macroText}`,
    `- Calorias objetivo ${params.tiempoComidaNombre}: ${params.caloriasObjetivo} (tolerancia +/- 80 kcal)`,
    '',
    `Tiempo de comida actual: ${params.tiempoComidaNombre}`,
    '',
    'CATALOGO DE INGREDIENTES DISPONIBLES:',
    'Usa SOLO ingredientes cuyos nombres aparezcan en esta lista.',
    'Si un ingrediente que necesitas no esta, usa el mas similar disponible.',
    catalogoTexto,
    '',
    'Instrucciones:',
    `- ${reglasMedicas}`,
    '- No usar ingredientes restringidos ni alergenos reportados.',
    'REGLAS DE CANTIDADES - OBLIGATORIAS:',
    '- cantidad_g SIEMPRE debe ser un numero entero en gramos.',
    '- NUNCA uses decimales, fracciones, tazas, cucharadas u otras unidades.',
    '- Convierte mentalmente antes de responder:',
    '  * 1 taza de arroz = 185g',
    '  * 1 taza de avena = 90g',
    '  * 1 cucharada de aceite = 14g',
    '  * 1 cucharadita = 5g',
    '  * 1 huevo grande = 60g',
    '  * media taza = la mitad de la taza correspondiente',
    '- Cantidades minimas: 5g. Maximas: 500g por ingrediente.',
    '- USA SOLO nombres de ingredientes que aparezcan en el CATALOGO.',
    '',
    ...(seccionPreferencias ? [seccionPreferencias] : []),
    ...(seccionRestringidos ? [seccionRestringidos] : []),
    '',
    'TIPO DE PLATO ESPERADO SEGUN TIEMPO DE COMIDA:',
    '- desayuno: avena, huevos revueltos/cocidos, tostadas, batido,',
    '  yogur con frutas, pancakes de avena, granola.',
    '- media_manana o media_tarde (snack): fruta, yogur, nueces,',
    '  galletas integrales, batido pequeno.',
    '- almuerzo: proteina principal (pollo/res/cerdo/pescado/huevo) +',
    '  carbohidrato (arroz/papa/yuca/platano/quinoa) + vegetal/ensalada.',
    '  Este es el plato mas completo del dia.',
    '- cena: proteina ligera + vegetal salteado o ensalada.',
    '  Mas ligero que el almuerzo, bajo en carbohidratos simples.',
    '',
    'IDENTIDAD CULINARIA — IMPORTANTE:',
    'Las recetas son para empleados ecuatorianos. Combina recetas internacionales',
    'con platos tipicos ecuatorianos usando ingredientes del catalogo.',
    'Ejemplos de platos ecuatorianos que puedes generar:',
    '- Desayuno: tigrillo (platano verde + huevo + queso), colada de avena,',
    '  pan con queso y cafe, batido de mora, platano con huevo.',
    '- Almuerzo: seco de pollo con arroz, arroz con menestra y carne,',
    '  sopa de verduras, caldo de pollo con papa y zanahoria.',
    '- Cena: crema de verduras, arroz con atun, ensalada con proteina.',
    '- Snack: batido de frutas tropicales, platano maduro con queso,',
    '  yogur con frutas ecuatorianas (mora, taxo, maracuya).',
    'No es obligatorio generar siempre platos ecuatorianos —',
    'alterna entre cocina ecuatoriana e internacional para dar variedad.',
    '',
    'REGLAS DE COHERENCIA DE PLATO - CRITICAS:',
    '1. Cada receta debe ser UN SOLO PLATO coherente, no varios platos mezclados.',
    '2. desayuno dulce (avena, granola, yogur): NO mezclar con huevos fritos ni salados.',
    '3. desayuno proteico (huevos): NO mezclar con frutas dulces encima.',
    '4. TODOS los ingredientes del JSON deben usarse en la preparacion, sin excepcion.',
    '5. Si un ingrediente no aparece en la preparacion, NO lo incluyas en los ingredientes.',
    '6. La preparacion debe describir exactamente los ingredientes listados, no otros imaginarios.',
    '7. NUNCA uses ingredientes genericos como frutas frescas, verduras mixtas o especias.',
    '   Usa nombres especificos del catalogo: manzana, zanahoria, oregano.',
    '8. Para frutas, elige UNA fruta especifica del catalogo, no un concepto generico.',
    '9. Antes de responder, verifica: cada ingrediente del JSON aparece en modo_preparacion.',
    '   Si no aparece, eliminalo de los ingredientes.',
    '',
    '- Receta practica para empleado de oficina en Ecuador.',
    '- Pasos numerados en el modo de preparacion.',
    '',
    'Responde SOLO con JSON valido sin markdown siguiendo EXACTAMENTE este schema:',
    '{',
    '  "nombre": "nombre descriptivo y apetitoso del plato",',
    '  "descripcion": "descripcion breve max 120 caracteres",',
    '  "tiempo_preparacion_min": numero entero entre 5 y 60,',
    '  "modo_preparacion": "1. paso\\n2. paso\\n3. paso...",',
    '  "ingredientes": [',
    '    {',
    '      "nombre_ingrediente": "nombre simple del ingrediente",',
    '      "cantidad_g": numero entero en gramos',
    '    }',
    '  ]',
    '}',
  ].join('\n');

  return { system, user };
};

const buildPromptGenerico = (params: {
  tiempoComidaNombre: string;
  caloriasObjetivo: number;
  restricciones: string[];
  aptitudes: number[];
  catalogoNombres: string[];
}): { system: string; user: string } => {
  const catalogoTexto = params.catalogoNombres.length > 0
    ? params.catalogoNombres.join('\n')
    : '- Sin catalogo disponible.';

  const instruccionesAptitud = params.aptitudes
    .map(id => APTITUD_A_INSTRUCCION[id])
    .filter((instruccion): instruccion is string => Boolean(instruccion));

  const system = 'Eres un nutricionista clinico experto en recetas saludables.\n'
    + 'Generas recetas equilibradas, practicas y apetitosas\n'
    + 'para adultos trabajadores en Ecuador.';

  const restriccionesTexto = params.restricciones.length > 0
    ? params.restricciones.map(r => `- ${r}`).join('\n')
    : '- Ninguna restriccion especial.';

  const user = [
    `Genera una receta REAL, coherente y apetitosa para: ${params.tiempoComidaNombre}`,
    `Calorias objetivo: ${params.caloriasObjetivo} kcal (tolerancia +/-80 kcal)`,
    '',
    'TIPO DE PLATO ESPERADO SEGUN TIEMPO DE COMIDA:',
    '- desayuno: avena, huevos revueltos/cocidos, tostadas, batido,',
    '  yogur con frutas, pancakes de avena, granola.',
    '- media_manana o media_tarde (snack): fruta, yogur, nueces,',
    '  galletas integrales, batido pequeno.',
    '- almuerzo: proteina principal (pollo/res/cerdo/pescado/huevo) +',
    '  carbohidrato (arroz/papa/yuca/platano/quinoa) + vegetal/ensalada.',
    '  Este es el plato mas completo del dia.',
    '- cena: proteina ligera + vegetal salteado o ensalada.',
    '  Mas ligero que el almuerzo, bajo en carbohidratos simples.',
    '',
    'IDENTIDAD CULINARIA — IMPORTANTE:',
    'Las recetas son para empleados ecuatorianos. Combina recetas internacionales',
    'con platos tipicos ecuatorianos usando ingredientes del catalogo.',
    'Ejemplos de platos ecuatorianos que puedes generar:',
    '- Desayuno: tigrillo (platano verde + huevo + queso), colada de avena,',
    '  pan con queso y cafe, batido de mora, platano con huevo.',
    '- Almuerzo: seco de pollo con arroz, arroz con menestra y carne,',
    '  sopa de verduras, caldo de pollo con papa y zanahoria.',
    '- Cena: crema de verduras, arroz con atun, ensalada con proteina.',
    '- Snack: batido de frutas tropicales, platano maduro con queso,',
    '  yogur con frutas ecuatorianas (mora, taxo, maracuya).',
    'No es obligatorio generar siempre platos ecuatorianos —',
    'alterna entre cocina ecuatoriana e internacional para dar variedad.',
    '',
    'RESTRICCIONES CRITICAS - OBLIGATORIAS:',
    restriccionesTexto,
    '',
    'APTITUDES CLINICAS - RESTRICCIONES ABSOLUTAS E INNEGOCIABLES:',
    instruccionesAptitud.length > 0
      ? instruccionesAptitud.map(instruccion => `- ${instruccion}`).join('\n')
      : '- Apta para poblacion general sin restricciones especiales',
    'COMPROBAR ANTES DE RESPONDER: Revisa cada ingrediente que propones y verifica que no viole ninguna restriccion anterior. Si un ingrediente viola una restriccion, NO lo incluyas.',
    '',
    'CATALOGO DE INGREDIENTES DISPONIBLES:',
    'Usa SOLO ingredientes cuyos nombres aparezcan en esta lista.',
    'Si un ingrediente que necesitas no esta, usa el mas similar disponible.',
    catalogoTexto,
    '',
    'REGLAS DE COHERENCIA CULINARIA - OBLIGATORIAS:',
    '1. Los ingredientes deben tener sentido juntos como un plato REAL.',
    '2. Usa entre 3 y 6 ingredientes distintos. Nunca mas de 6.',
    '3. El almidon de yuca, fecula de maiz y similares son espesantes industriales. Usalos SOLO si son necesarios y maximo 15g.',
    '4. Prioriza ingredientes reconocibles en cocina ecuatoriana: pollo, res, cerdo, huevo, arroz, papa, yuca, platano, tomate, cebolla, zanahoria, brocoli, espinaca, leche, queso, avena.',
    '5. Las cantidades deben ser realistas para UNA porcion:',
    '   - Proteina principal: 100-200g',
    '   - Carbohidrato principal: 80-150g',
    '   - Vegetales: 50-150g',
    '   - Condimentos/aceites: 5-15g',
    '6. TODAS las cantidades en gramos enteros. NUNCA decimales, tazas, cucharadas u otras unidades.',
    '7. modo_preparacion es OBLIGATORIO. Minimo 5 pasos numerados.',
    '   Cada paso debe ser una instruccion concreta de cocina.',
    '   Separar cada paso con \n. Ejemplo:',
    '   "1. Lavar y cortar el pollo en cubos.\n2. Calentar aceite en sarten a fuego medio.\n3. Saltear el pollo 8 minutos hasta dorar.\n4. Agregar vegetales y cocinar 5 minutos mas.\n5. Sazonar con sal y pimienta. Servir caliente."',
    '8. NUNCA uses ingredientes genericos como "frutas frescas", "verduras mixtas", "especias".',
    '   Usa nombres especificos que existan en el catalogo, por ejemplo: "manzana", "zanahoria", "oregano".',
    '9. Para frutas, elige UNA fruta especifica del catalogo, no un concepto generico.',
    '10. Los ingredientes que coloques deben ser especificos.',
    '    Ejemplo: no puedes decir solo "aceite" debes ser mas claron en el ingrediente que se usara: "aceite de olvia", "aceite de girasol".',
    '11. Si el catalogo no tiene exactamente lo que necesitas, usa el ingrediente mas similar.',
    '    Ejemplo: si necesitas "granola en barra" y el catalogo tiene "Granola", usa "Granola".',
    'REGLAS DE COHERENCIA DE PLATO - CRITICAS:',
    '- Cada receta debe ser UN SOLO PLATO coherente, no varios platos mezclados.',
    '- EJEMPLO:',
    '- desayuno dulce (avena, granola, yogur): NO mezclar con huevos fritos ni ingredientes salados.',
    '- desayuno proteico (huevos): NO mezclar con frutas dulces encima ni cereales. Lo mismo para los demas tiempos de comida: cada receta debe tener sentido como un plato unico.',
    '- Si usas un ingrediente en especifico, DEBE aparecer en la preparacion. Si no lo usas en la preparacion, NO lo incluyas en los ingredientes.',
    '- TODOS los ingredientes listados deben usarse en la preparacion, sin excepcion.',
    '- La preparacion debe ser para los ingredientes exactos listados, no para ingredientes imaginarios.',
    '- Antes de responder, verifica: ¿cada ingrediente del JSON aparece en el modo_preparacion? Si no, eliminalo.',
    'REGLAS DE CANTIDADES - OBLIGATORIAS:',
    '- cantidad_g SIEMPRE debe ser un numero entero en gramos.',
    '- NUNCA uses decimales, fracciones, tazas, cucharadas u otras unidades.',
    '- Convierte mentalmente antes de responder:',
    '  * 1 taza de arroz = 185g',
    '  * 1 taza de avena = 90g',
    '  * 1 cucharada de aceite = 14g',
    '  * 1 cucharadita = 5g',
    '  * 1 huevo grande = 60g',
    '  * media taza = la mitad de la taza correspondiente',
    '- Cantidades minimas: 5g. Maximas: 500g por ingrediente.',
    '- USA SOLO nombres de ingredientes que aparezcan en el CATALOGO.',
    '',
    'Responde SOLO con JSON valido sin markdown siguiendo EXACTAMENTE este schema:',
    '{',
    '  "nombre": "nombre descriptivo y apetitoso del plato",',
    '  "descripcion": "descripcion breve max 120 caracteres",',
    '  "tiempo_preparacion_min": numero entero entre 5 y 60,',
    '  "modo_preparacion": "1. paso uno\\n2. paso dos\\n3. paso tres...",',
    '  "ingredientes": [',
    '    {',
    '      "nombre_ingrediente": "nombre simple del ingrediente",',
    '      "cantidad_g": numero entero en gramos',
    '    }',
    '  ]',
    '}',
  ].join('\n');

  return { system, user };
};

const parseGptResponse = (content: string): RecipeGptPromptResponse => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new ExternalServiceError('OpenAI', 'Respuesta JSON malformada');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ExternalServiceError('OpenAI', 'Respuesta JSON invalida');
  }

  const data = parsed as Partial<RecipeGptPromptResponse>;

  if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim().length === 0) {
    throw new ExternalServiceError('OpenAI', 'Respuesta sin nombre de receta');
  }

  if (!data.modo_preparacion || typeof data.modo_preparacion !== 'string'
    || data.modo_preparacion.trim().length === 0) {
    throw new ExternalServiceError('OpenAI', 'Respuesta sin modo_preparacion');
  }

  if (!Array.isArray(data.ingredientes) || data.ingredientes.length === 0) {
    throw new ExternalServiceError('OpenAI', 'Respuesta sin ingredientes');
  }

  for (const ingrediente of data.ingredientes) {
    if (!ingrediente || typeof ingrediente !== 'object') {
      throw new ExternalServiceError('OpenAI', 'Respuesta con ingrediente invalido');
    }
  }

  const tiempoPreparacion =
    typeof data.tiempo_preparacion_min === 'number' && Number.isFinite(data.tiempo_preparacion_min)
      ? Math.round(data.tiempo_preparacion_min)
      : null;

  return {
    nombre: data.nombre.trim(),
    descripcion: typeof data.descripcion === 'string' ? data.descripcion.trim() : null,
    tiempo_preparacion_min: tiempoPreparacion && tiempoPreparacion > 0
      ? tiempoPreparacion
      : null,
    modo_preparacion: data.modo_preparacion.trim(),
    ingredientes: data.ingredientes as RecipeGptPromptIngredient[],
  };
};

const callOpenAI = async (system: string, user: string): Promise<RecipeGptPromptResponse> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OPENAI_API_KEY no definida', 500, 'INTERNAL_ERROR');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
      max_tokens: OPENAI_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ExternalServiceError('OpenAI', `HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new ExternalServiceError('OpenAI', 'Respuesta sin contenido');
  }

  return parseGptResponse(content);
};

const findCachedPlato = async (
  idTiempoComida: number,
  caloriasObjetivo: number,
  idPerfil: number,
): Promise<GeneratedRecipeResult | null> => {
  const tolerancia = 80;

  const result = await pool.query<CachedPlatoRow>(FIND_CACHED_PLATO, [
    idTiempoComida,
    caloriasObjetivo - tolerancia,
    caloriasObjetivo + tolerancia,
    idPerfil,
  ]);

  if (!result.rows[0]) return null;

  const plato = result.rows[0];

  const ingredientesResult = await pool.query<CachedIngredienteRow>(
    GET_INGREDIENTES_PLATO,
    [plato.id_plato],
  );

  return {
    id_plato: plato.id_plato,
    nombre: plato.nombre,
    descripcion: plato.descripcion ?? null,
    calorias_totales: Number(plato.calorias_totales),
    tiempo_preparacion_min: plato.tiempo_preparacion_min ?? null,
    ingredientes: ingredientesResult.rows.map(row => ({
      id_alimento_detalle: row.id_alimento_detalle,
      id_alimento: row.id_alimento,
      nombre: row.nombre,
      cantidad_g: Number(row.cantidad_g),
      calorias_aportadas: Number(row.calorias_aportadas),
    })),
    guardado_en_menu: false,
    id_menu_diario: null,
    uso_gpt: false,
  };
};

const findCachedPlatoGeneric = async (
  idTiempoComida: number,
  caloriasObjetivo: number,
): Promise<GeneratedRecipeResult | null> => {
  const tolerancia = 80;

  const result = await pool.query<CachedPlatoRow>(FIND_CACHED_PLATO_GENERIC, [
    idTiempoComida,
    caloriasObjetivo - tolerancia,
    caloriasObjetivo + tolerancia,
  ]);

  if (!result.rows[0]) return null;

  const plato = result.rows[0];

  const ingredientesResult = await pool.query<CachedIngredienteRow>(
    GET_INGREDIENTES_PLATO,
    [plato.id_plato],
  );

  return {
    id_plato: plato.id_plato,
    nombre: plato.nombre,
    descripcion: plato.descripcion ?? null,
    calorias_totales: Number(plato.calorias_totales),
    tiempo_preparacion_min: plato.tiempo_preparacion_min ?? null,
    ingredientes: ingredientesResult.rows.map(row => ({
      id_alimento_detalle: row.id_alimento_detalle,
      id_alimento: row.id_alimento,
      nombre: row.nombre,
      cantidad_g: Number(row.cantidad_g),
      calorias_aportadas: Number(row.calorias_aportadas),
    })),
    guardado_en_menu: false,
    id_menu_diario: null,
    uso_gpt: false,
  };
};

const assertTiempoComidaExiste = async (idTiempoComida: number): Promise<void> => {
  const result = await pool.query<{ id_tiempo_comida: number }>(
    GET_TIEMPO_COMIDA_BY_ID,
    [idTiempoComida],
  );

  if (!result.rows[0]) {
    throw new NotFoundError('Tiempo de comida');
  }
};

export const recipeGeneratorService = {
  async generateRecipe(data: GenerateRecipeDto): Promise<GeneratedRecipeResult> {
    console.log('[generateRecipe] data recibida:', JSON.stringify({
      id_perfil: data.id_perfil,
      id_evaluacion: data.id_evaluacion,
      tiempo_comida_nombre: data.tiempo_comida_nombre,
      calorias_objetivo: data.calorias_objetivo,
    }));

    const perfilResult = await pool.query<PerfilEvaluacionRow>(
      GET_PERFIL_EVALUACION,
      [data.id_perfil, data.id_evaluacion],
    );

    if (!perfilResult.rows[0]) {
      throw new NotFoundError('Perfil o evaluacion');
    }

    const perfil = normalizePerfil(perfilResult.rows[0]);

    console.log('[generateRecipe] perfil obtenido:', JSON.stringify({
      calorias_diarias_calculadas: perfil.calorias_diarias_calculadas,
      imc: perfil.imc,
    }));

    const [condicionesResult, preferenciasResult] = await Promise.all([
      pool.query<CondicionRow>(GET_CONDICIONES, [data.id_perfil]),
      pool.query<PreferenciaRow>(GET_PREFERENCIAS, [data.id_perfil]),
    ]);

    const condiciones = condicionesResult.rows.map(row => row.nombre);
    const alimentosPreferidos = preferenciasResult.rows
      .filter(row => row.tipo === 'preferido')
      .map(row => row.nombre);
    const alimentosRestringidos = preferenciasResult.rows
      .filter(row => row.tipo === 'restringido')
      .map(row => row.nombre);

    const categoriasPreferidas = Array.from(
      new Set(
        preferenciasResult.rows
          .filter(row => row.tipo === 'preferido')
          .map(row => row.categoria)
          .filter(Boolean),
      ),
    );

    const alimentosDetalleResult = categoriasPreferidas.length > 0
      ? await pool.query<AlimentoDetalleRow>(
        GET_ALIMENTOS_DETALLE_BY_CATEGORIAS,
        [categoriasPreferidas],
      )
      : await pool.query<AlimentoDetalleRow>(GET_ALIMENTOS_DETALLE_ALL);

    if (alimentosDetalleResult.rows.length === 0) {
      throw new ValidationError('No hay alimentos disponibles para generar la receta');
    }

    const catalogoResult = await pool.query<{ nombre: string }>(GET_CATALOGO_NOMBRES, [data.id_perfil]);
    const catalogoNombres = catalogoResult.rows.map(row => row.nombre);

    let caloriasObjetivo = data.calorias_objetivo;
    if (!caloriasObjetivo) {
      if (!perfil.calorias_diarias_calculadas) {
        throw new ValidationError('No se pudo calcular calorias objetivo sin calorias_diarias_calculadas');
      }

      const factor = TIEMPO_COMIDA_FACTORES[data.tiempo_comida_nombre];
      caloriasObjetivo = Math.round(perfil.calorias_diarias_calculadas * factor);
    }

    const cachedPlato = await findCachedPlato(
      data.id_tiempo_comida,
      caloriasObjetivo,
      data.id_perfil,
    );

    if (cachedPlato) {
      console.log(`[generateRecipe] Cache hit: ${cachedPlato.nombre} (forzar_cache=${data.forzar_cache})`);
      if (data.id_dia_plan) {
        const menuResult = await pool.query<{ id_menu_diario: number }>(
          INSERT_MENU_DIARIO,
          [
            data.id_dia_plan,
            data.id_tiempo_comida,
            cachedPlato.id_plato,
            cachedPlato.calorias_totales,
          ],
        );
        cachedPlato.guardado_en_menu = true;
        cachedPlato.id_menu_diario = menuResult.rows[0].id_menu_diario;
      }

      return cachedPlato;
    }

    if (data.forzar_cache) {
      console.log('[generateRecipe] Cache miss con forzar_cache=true, generando con GPT');
    }

    const { gptRecipe, ingredientesResueltos } = await generarRecetaConReintentos(() => buildPrompt({
      perfil,
      condiciones,
      alimentosPreferidos,
      alimentosRestringidos,
      catalogoNombres,
      caloriasObjetivo,
      tiempoComidaNombre: data.tiempo_comida_nombre,
    }), data.id_perfil);

    const ingredientesConCalorias = ingredientesResueltos.map(item => ({
      id_alimento_detalle: item.id_alimento_detalle,
      id_alimento: item.id_alimento,
      nombre: item.nombre,
      cantidad_g: item.cantidad_g,
      calorias_aportadas: item.calorias_aportadas,
    }));

    const caloriasTotales = ingredientesConCalorias
      .reduce((total, item) => total + item.calorias_aportadas, 0);

    if (caloriasTotales > MAX_CALORIAS_PLATO) {
      throw new ValidationError('Las calorias totales superan el maximo permitido');
    }

    const client = await pool.connect();
    let idMenuDiario: number | null = null;

    try {
      await client.query('BEGIN');

      // Verificar si existe una receta suficientemente similar
      // SOLO cuando no hay id_dia_plan o cuando se requiere nueva receta
      const plataSimilarId = await buscarRecetaSimilar(
        ingredientesResueltos,
        data.id_tiempo_comida,
        caloriasTotales,
      );

      if (plataSimilarId) {
        // Reutilizar receta existente sin insertar nada nuevo en platos
        let idMenuDiario: number | null = null;

        if (data.id_dia_plan) {
          const menuResult = await client.query<{ id_menu_diario: number }>(
            INSERT_MENU_DIARIO,
            [data.id_dia_plan, data.id_tiempo_comida,
              plataSimilarId, caloriasTotales],
          );
          idMenuDiario = menuResult.rows[0].id_menu_diario;
        }

        await client.query('COMMIT');

        const platoExistente = await pool.query<{
          id_plato: number; nombre: string;
          descripcion: string | null;
          calorias_totales: number;
          tiempo_preparacion_min: number | null;
        }>(
          `SELECT id_plato, nombre, descripcion,
            calorias_totales, tiempo_preparacion_min
           FROM platos WHERE id_plato = $1`,
          [plataSimilarId],
        );

        return {
          id_plato: plataSimilarId,
          nombre: platoExistente.rows[0].nombre,
          descripcion: platoExistente.rows[0].descripcion ?? null,
          calorias_totales: caloriasTotales,
          tiempo_preparacion_min:
            platoExistente.rows[0].tiempo_preparacion_min ?? null,
          ingredientes: ingredientesConCalorias,
          guardado_en_menu: Boolean(data.id_dia_plan),
          id_menu_diario: idMenuDiario,
          uso_gpt: true,
        };
      }

      const nombreFinal = await resolverNombreUnico(gptRecipe.nombre);

      const platoResult = await client.query<{ id_plato: number }>(
        INSERT_PLATO,
        [
          nombreFinal,
          gptRecipe.descripcion ?? null,
          gptRecipe.modo_preparacion,
          // enlace_video
          null,
          caloriasTotales,
          gptRecipe.tiempo_preparacion_min ?? null,
          data.id_tiempo_comida,
        ],
      );

      const idPlato = platoResult.rows[0].id_plato;

      for (const ingrediente of ingredientesResueltos) {
        await client.query(
          INSERT_PLATO_INGREDIENTE,
          [
            idPlato,
            ingrediente.id_alimento ?? null,
            ingrediente.id_alimento_detalle ?? null,
            ingrediente.cantidad_g,
          ],
        );
      }

      if (data.id_dia_plan) {
        const menuResult = await client.query<{ id_menu_diario: number }>(
          INSERT_MENU_DIARIO,
          [data.id_dia_plan, data.id_tiempo_comida, idPlato, caloriasTotales],
        );
        idMenuDiario = menuResult.rows[0].id_menu_diario;
      }

      await client.query('COMMIT');

      return {
        id_plato: idPlato,
        nombre: nombreFinal,
        descripcion: gptRecipe.descripcion ?? null,
        calorias_totales: caloriasTotales,
        tiempo_preparacion_min: gptRecipe.tiempo_preparacion_min ?? null,
        ingredientes: ingredientesConCalorias,
        guardado_en_menu: Boolean(data.id_dia_plan),
        id_menu_diario: idMenuDiario,
        uso_gpt: true,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async generateGenericRecipe(data: GenerateGenericDto): Promise<GeneratedRecipeResult> {
    if (data.calorias_objetivo < 100 || data.calorias_objetivo > 1500) {
      throw new ValidationError('calorias_objetivo fuera de rango (100-1500)');
    }

    await assertTiempoComidaExiste(data.id_tiempo_comida);

    if (!data.forzar_nuevo) {
      const cachedPlato = await findCachedPlatoGeneric(
        data.id_tiempo_comida,
        data.calorias_objetivo,
      );

      if (cachedPlato) {
        console.log(`[generateGenericRecipe] Cache hit: ${cachedPlato.nombre}`);
        return cachedPlato;
      }
    }

    const aptitudIds = data.aptitudes?.filter(id => Number.isFinite(id)) ?? [];

    if (aptitudIds.length > 0) {
      const aptitudesResult = await pool.query<AptitudClinicaRow>(
        GET_APTITUDES_CLINICAS_BY_IDS,
        [aptitudIds],
      );

      const idsValidos = new Set(aptitudesResult.rows.map(row => row.id_aptitud));
      const idsInvalidos = aptitudIds.filter(id => !idsValidos.has(id));

      if (idsInvalidos.length > 0) {
        throw new ValidationError(`Aptitudes invalidas: ${idsInvalidos.join(', ')}`);
      }
    }

    const catalogoResult = await pool.query<{ nombre: string }>(GET_CATALOGO_NOMBRES, [null]);

    if (catalogoResult.rows.length === 0) {
      throw new ValidationError('No hay alimentos disponibles para generar la receta');
    }

    const catalogoNombres = catalogoResult.rows.map(row => row.nombre);

    const { gptRecipe, ingredientesResueltos } = await generarRecetaConReintentos(() => buildPromptGenerico({
      tiempoComidaNombre: data.tiempo_comida_nombre,
      caloriasObjetivo: data.calorias_objetivo,
      restricciones: data.restricciones ?? [],
      aptitudes: aptitudIds,
      catalogoNombres,
    }), null);

    const ingredientesConCalorias = ingredientesResueltos.map(item => ({
      id_alimento_detalle: item.id_alimento_detalle,
      id_alimento: item.id_alimento,
      nombre: item.nombre,
      cantidad_g: item.cantidad_g,
      calorias_aportadas: item.calorias_aportadas,
    }));

    const caloriasTotales = ingredientesConCalorias
      .reduce((total, item) => total + item.calorias_aportadas, 0);

    if (caloriasTotales > MAX_CALORIAS_PLATO) {
      throw new ValidationError('Las calorias totales superan el maximo permitido');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const platoResult = await client.query<{ id_plato: number }>(
        INSERT_PLATO,
        [
          gptRecipe.nombre,
          gptRecipe.descripcion ?? null,
          gptRecipe.modo_preparacion,
          null,
          caloriasTotales,
          gptRecipe.tiempo_preparacion_min ?? null,
          data.id_tiempo_comida,
        ],
      );

      const idPlato = platoResult.rows[0].id_plato;

      for (const ingrediente of ingredientesResueltos) {
        await client.query(
          INSERT_PLATO_INGREDIENTE,
          [
            idPlato,
            ingrediente.id_alimento ?? null,
            ingrediente.id_alimento_detalle ?? null,
            ingrediente.cantidad_g,
          ],
        );
      }

      for (const idAptitud of aptitudIds) {
        await client.query(
          INSERT_PLATO_APTITUD,
          [idPlato, idAptitud],
        );
      }

      await client.query('COMMIT');

      return {
        id_plato: idPlato,
        nombre: gptRecipe.nombre,
        descripcion: gptRecipe.descripcion ?? null,
        calorias_totales: caloriasTotales,
        tiempo_preparacion_min: gptRecipe.tiempo_preparacion_min ?? null,
        ingredientes: ingredientesConCalorias,
        guardado_en_menu: false,
        id_menu_diario: null,
        uso_gpt: true,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async generateWeekPlan(data: GenerateWeekDto): Promise<GenerateWeekResult> {
    // Paso 1: Validar el plan y la semana
    const planResult = await pool.query<{
      id_plan: number;
      id_perfil: number;
      id_nutricionista: number;
      estado: string;
      modulo_habilitado: boolean;
    }>(GET_PLAN_CON_PERFIL, [data.id_plan]);

    if (!planResult.rows[0]) {
      throw new NotFoundError('Plan nutricional');
    }

    const plan = planResult.rows[0];
    if (!['activo', 'pendiente'].includes(plan.estado)) {
      throw new AppError(
        'El plan no está en estado activo o pendiente',
        409,
        'PLAN_INVALID_STATE'
      );
    }

    const idPerfil = plan.id_perfil;

    // Verificar que la semana pertenece al plan
    const semanaResult = await pool.query<{
      id_semana: number;
      id_plan: number;
      numero: number;
      fecha_inicio_semana: string;
      fecha_fin_semana: string;
    }>(GET_SEMANA_DEL_PLAN, [data.id_semana, data.id_plan]);

    if (!semanaResult.rows[0]) {
      throw new NotFoundError('Semana del plan');
    }

    const semana = semanaResult.rows[0];

    // Verificar que la evaluación existe y pertenece al mismo perfil
    const evalResult = await pool.query<{ id_evaluacion: number }>(
      'SELECT id_evaluacion FROM evaluaciones_clinicas WHERE id_evaluacion = $1 AND id_perfil = $2',
      [data.id_evaluacion, idPerfil]
    );

    if (!evalResult.rows[0]) {
      throw new NotFoundError('Evaluación clínica');
    }

    // Paso 2: Obtener los 5 días de la semana
    const diasResult = await pool.query<{
      id_dia_plan: number;
      id_semana: number;
      dia_semana: string;
      fecha: string;
    }>(GET_DIAS_SEMANA, [data.id_semana]);

    let dias = diasResult.rows;

    if (dias.length < 5) {
      const fechaInicio = new Date(semana.fecha_inicio_semana);
      const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

      for (let i = 0; i < 5; i++) {
        const fecha = new Date(fechaInicio);
        fecha.setDate(fechaInicio.getDate() + i);
        const fechaStr = fecha.toISOString().split('T')[0];

        await pool.query(
          `INSERT INTO dias_plan (id_semana, dia_semana, fecha)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
          [semana.id_semana, diasSemana[i], fechaStr],
        );
      }

      const diasRecreados = await pool.query<{
        id_dia_plan: number;
        id_semana: number;
        dia_semana: string;
        fecha: string;
      }>(GET_DIAS_SEMANA, [semana.id_semana]);

      dias = diasRecreados.rows;

      if (dias.length < 5) {
        throw new AppError(
          'No se pudieron crear los dias de la semana',
          500,
          'DAYS_CREATION_FAILED',
        );
      }
    }

    // Paso 3: Obtener los 5 tiempos de comida activos
    const tiemposResult = await pool.query<{
      id_tiempo_comida: number;
      nombre: string;
    }>(GET_TIEMPOS_COMIDA_ACTIVOS);

    if (tiemposResult.rows.length < 5) {
      throw new AppError(
        'No hay 5 tiempos de comida activos configurados',
        500,
        'INCOMPLETE_MEAL_TIMES'
      );
    }

    const tiempos = tiemposResult.rows;

    // Paso 4: Obtener los menús ya existentes para esta semana
    const menusResult = await pool.query<{
      id_menu_diario: number;
      id_dia_plan: number;
      id_tiempo_comida: number;
      id_plato: number;
      calorias_aportadas: number;
      nombre_plato: string;
    }>(GET_MENUS_SEMANA, [data.id_semana]);

    const existingMenusMap = new Map<string, {
      id_menu_diario: number;
      id_tiempo_comida: number;
      id_plato: number;
      calorias_aportadas: number;
      nombre_plato: string;
    }>();

    for (const menu of menusResult.rows) {
      const key = `${menu.id_dia_plan}-${menu.id_tiempo_comida}`;
      existingMenusMap.set(key, {
        id_menu_diario: menu.id_menu_diario,
        id_tiempo_comida: menu.id_tiempo_comida,
        id_plato: menu.id_plato,
        calorias_aportadas: menu.calorias_aportadas,
        nombre_plato: menu.nombre_plato,
      });
    }

    // Paso 5: Iterar sobre los 25 slots (5 días × 5 tiempos)
    let slotsReutilizados = 0;
    let slotsGenerados = 0;
    let llamadasGpt = 0;

    const resultadosDias: DiaPlanResult[] = [];
    const platosAsignadosPorTiempo = new Map<number, Set<number>>();
    const platosUsadosEnSemana = new Set<number>();

    // Inicializar map de tiempos con IDs de platos ya asignados
    for (const tiempo of tiempos) {
      platosAsignadosPorTiempo.set(tiempo.id_tiempo_comida, new Set());
    }

    for (const dia of dias) {
      const menusDelDia: MenuDiarioSlot[] = [];

      for (const tiempo of tiempos) {
        const slotKey = `${dia.id_dia_plan}-${tiempo.id_tiempo_comida}`;
        const existingMenu = existingMenusMap.get(slotKey);

        if (existingMenu && !data.regenerar) {
          // Reutilizar menú existente
          slotsReutilizados++;
          menusDelDia.push({
            id_menu_diario: existingMenu.id_menu_diario,
            id_tiempo_comida: existingMenu.id_tiempo_comida,
            tiempo_comida: tiempo.nombre,
            id_plato: existingMenu.id_plato,
            nombre_plato: existingMenu.nombre_plato,
            calorias_aportadas: existingMenu.calorias_aportadas,
            es_nuevo: false,
          });

          platosAsignadosPorTiempo.get(tiempo.id_tiempo_comida)!.add(existingMenu.id_plato);
          platosUsadosEnSemana.add(existingMenu.id_plato);
        } else {
          const perfilEvalResult = await pool.query<{
            calorias_diarias_calculadas: number | null;
          }>(
            `SELECT calorias_diarias_calculadas
     FROM evaluaciones_clinicas WHERE id_evaluacion = $1`,
            [data.id_evaluacion],
          );

          const caloriasDiarias = Number(
            perfilEvalResult.rows[0]?.calorias_diarias_calculadas ?? 2000,
          );
          const tiempoNombre = mapearNombreTiempo(tiempo.nombre);
          const factor = TIEMPO_COMIDA_FACTORES[tiempoNombre];
          const caloriasObjetivo = Number.isFinite(factor)
            ? Math.round(caloriasDiarias * factor)
            : 400;

          const totalCompatibles = await contarRecetasCompatibles(
            tiempo.id_tiempo_comida,
            caloriasObjetivo,
            idPerfil,
          );

          const usarCache =
            totalCompatibles >= MIN_RECETAS_PARA_CACHE &&
            Math.random() < PROBABILIDAD_CACHE;

          let recipeResult: GeneratedRecipeResult | null = null;
          let reintentos = 0;
          const maxReintentos = 2;

          while (!recipeResult && reintentos <= maxReintentos) {
            const recipeData: GenerateRecipeDto = {
              id_perfil: idPerfil,
              id_evaluacion: data.id_evaluacion,
              id_tiempo_comida: tiempo.id_tiempo_comida,
              tiempo_comida_nombre: tiempoNombre,
              calorias_objetivo: caloriasObjetivo,
              id_dia_plan: dia.id_dia_plan,
              // En reintentos forzar GPT para romper el loop de caché
              forzar_cache: reintentos === 0 ? usarCache : false,
            };

            const candidato = await this.generateRecipe(recipeData);

            // Verificar variedad ANTES de aceptar el resultado
            const platoYaUsado =
              platosAsignadosPorTiempo.get(tiempo.id_tiempo_comida)!.has(candidato.id_plato);

            if (platoYaUsado) {
              if (reintentos < maxReintentos) {
                reintentos++;
                // forzar_cache=false en próximo intento para que GPT genere algo distinto
                continue;
              }
              // Agotamos reintentos — aceptar el duplicado como último recurso
              console.warn(`[generateWeekPlan] Duplicado aceptado por falta de opciones: ${candidato.nombre}`);
              recipeResult = candidato;
            } else {
              recipeResult = candidato;
            }
          }

          if (!recipeResult) {
            throw new AppError(
              'No se pudo generar receta unica para el slot',
              500,
              'RECIPE_GENERATION_FAILED',
            );
          }

          slotsGenerados++;
          if (recipeResult.uso_gpt) llamadasGpt++;

          menusDelDia.push({
            id_menu_diario: recipeResult.id_menu_diario ?? 0,
            id_tiempo_comida: tiempo.id_tiempo_comida,
            tiempo_comida: tiempo.nombre,
            id_plato: recipeResult.id_plato,
            nombre_plato: recipeResult.nombre,
            calorias_aportadas: recipeResult.calorias_totales,
            es_nuevo: true,
          });

          platosAsignadosPorTiempo.get(tiempo.id_tiempo_comida)!.add(recipeResult.id_plato);
          platosUsadosEnSemana.add(recipeResult.id_plato);
        }
      }

      resultadosDias.push({
        id_dia_plan: dia.id_dia_plan,
        dia_semana: dia.dia_semana,
        fecha: dia.fecha,
        menus: menusDelDia,
      });
    }

    // Paso 6: Construir y devolver el resumen
    return {
      id_semana: data.id_semana,
      semana_numero: semana.numero,
      fecha_inicio: semana.fecha_inicio_semana,
      fecha_fin: semana.fecha_fin_semana,
      dias: resultadosDias,
      resumen: {
        total_slots: 25,
        slots_reutilizados: slotsReutilizados,
        slots_generados: slotsGenerados,
        llamadas_gpt: llamadasGpt,
      },
    };
  },
};

