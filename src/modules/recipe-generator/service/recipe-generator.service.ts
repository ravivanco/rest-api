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
  RecipeGptResponse,
  TiempoComidaNombre,
  GenerateWeekDto,
  GenerateWeekResult,
  DiaPlanResult,
  MenuDiarioSlot,
} from '../dto/generate-recipe.dto';

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_TEMPERATURE = 0.7;
const OPENAI_MAX_TOKENS = 1200;
const MAX_CALORIAS_PLATO = 32767;

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

interface AlimentoDetalleItem {
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

interface CachedPlatoRow {
  id_plato: number;
  nombre: string;
  descripcion: string | null;
  calorias_totales: number;
  tiempo_preparacion_min: number | null;
}

interface CachedIngredienteRow {
  id_alimento_detalle: number;
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

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

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

const mapAlimentosDetalle = (rows: AlimentoDetalleRow[]): Map<number, AlimentoDetalleItem> => {
  const map = new Map<number, AlimentoDetalleItem>();
  for (const row of rows) {
    map.set(row.id_alimento_detalle, {
      id_alimento_detalle: row.id_alimento_detalle,
      nombre: row.nombre,
      categoria: row.categoria,
      calorias: Number(row.calorias),
      proteinas: Number(row.proteinas),
      carbohidratos: Number(row.carbohidratos),
      grasas: Number(row.grasas),
      fibra: row.fibra !== null ? Number(row.fibra) : null,
      sodio: row.sodio !== null ? Number(row.sodio) : null,
    });
  }
  return map;
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

const toCompactIngredientsJson = (rows: AlimentoDetalleItem[]): string => {
  const compact = rows.map(row => {
    const item: Record<string, number | string> = {
      id: row.id_alimento_detalle,
      nombre: row.nombre,
      categoria: row.categoria,
      cal: row.calorias,
      prot: row.proteinas,
      carb: row.carbohidratos,
      gras: row.grasas,
    };

    return item;
  });

  return JSON.stringify(compact);
};

const buildPrompt = (params: {
  perfil: PerfilEvaluacionRow;
  condiciones: string[];
  alimentosPreferidos: string[];
  alimentosRestringidos: string[];
  ingredientes: AlimentoDetalleItem[];
  caloriasObjetivo: number;
  tiempoComidaNombre: TiempoComidaNombre;
}): { system: string; user: string } => {
  const perfil = params.perfil;
  const condiciones = params.condiciones.length > 0 ? params.condiciones.join(', ') : 'ninguna';
  const alergias = perfil.alergias_intolerancias?.trim() || 'ninguna';
  const restricciones = perfil.restricciones_alimenticias?.trim() || 'ninguna';
  const preferidos = params.alimentosPreferidos.length > 0
    ? params.alimentosPreferidos.join(', ')
    : 'ninguno';
  const restringidos = params.alimentosRestringidos.length > 0
    ? params.alimentosRestringidos.join(', ')
    : 'ninguno';

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

  const ingredientesJson = toCompactIngredientsJson(params.ingredientes);

  const system = 'Eres un nutricionista clinico experto en recetas personalizadas.';

  const user = [
    'Perfil del paciente:',
    `- Nivel de actividad: ${perfil.nivel_actividad_fisica}`,
    `- Objetivo: ${perfil.objetivo ?? 'no especificado'}`,
    `- Condiciones medicas: ${condiciones}`,
    `- Alergias/intolerancias: ${alergias}`,
    `- Restricciones alimenticias: ${restricciones}`,
    `- Alimentos restringidos: ${restringidos}`,
    `- Alimentos preferidos: ${preferidos}`,
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
    'Ingredientes disponibles (JSON compacto):',
    ingredientesJson,
    '',
    'Instrucciones:',
    `- ${reglasMedicas}`,
    '- No usar ingredientes restringidos ni alergenos reportados.',
    '- Preferir ingredientes favoritos cuando sea posible.',
    '- Las cantidades de ingredientes DEBEN ser numeros enteros en gramos (g).',
    '- Nunca uses fracciones, decimales, tazas, cucharadas u otras unidades.',
    '- Si un ingrediente normalmente se mide en ml (aceite, leche), conviertelo a gramos (1ml ~= 1g).',
    '- Cantidad minima: 5g. Cantidad maxima: 500g por ingrediente.',
    '- Receta practica para empleado de oficina en Ecuador.',
    '- Pasos numerados en el modo de preparacion.',
    '',
    'Responde SOLO con JSON valido y sin markdown siguiendo este schema:',
    '{',
    '  "nombre": "string",',
    '  "descripcion": "string | null",',
    '  "tiempo_preparacion_min": number | null,',
    '  "modo_preparacion": "string",',
    '  "ingredientes": [',
    '    { "id_alimento_detalle": number, "cantidad_g": number }',
    '  ]',
    '}',
  ].join('\n');

  return { system, user };
};

const buildPromptGenerico = (params: {
  tiempoComidaNombre: string;
  caloriasObjetivo: number;
  restricciones: string[];
  aptitudes: string[];
  ingredientes: AlimentoDetalleItem[];
}): { system: string; user: string } => {
  const ingredientesJson = toCompactIngredientsJson(params.ingredientes);

  const system = 'Eres un nutricionista clinico experto en recetas saludables.\n'
    + 'Generas recetas equilibradas, practicas y apetitosas\n'
    + 'para adultos trabajadores en Ecuador.';

  const restriccionesTexto = params.restricciones.length > 0
    ? params.restricciones.map(r => `- ${r}`).join('\n')
    : '- Ninguna restriccion especial.';

  const aptitudesTexto = params.aptitudes.length > 0
    ? `El plato debe ser apto para: ${params.aptitudes.join(', ')}`
    : 'Apto para poblacion general.';

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
    'RESTRICCIONES CRITICAS - OBLIGATORIAS:',
    restriccionesTexto,
    '',
    'APTITUDES CLINICAS DEL PLATO:',
    aptitudesTexto,
    '',
    'REGLAS DE COHERENCIA CULINARIA - OBLIGATORIAS:',
    '1. Los ingredientes deben tener sentido juntos como un plato REAL.',
    '2. Usa entre 3 y 6 ingredientes distintos. Nunca mas de 6.',
    '3. NUNCA repitas el mismo id de ingrediente. Cada id debe aparecer UNA sola vez.',
    '4. El almidon de yuca, fecula de maiz y similares son espesantes',
    '   industriales. Usalos SOLO si son necesarios y maximo 15g.',
    '5. Prioriza ingredientes reconocibles en cocina ecuatoriana:',
    '   pollo, res, cerdo, huevo, arroz, papa, yuca, platano, tomate,',
    '   cebolla, zanahoria, brocoli, espinaca, leche, queso, avena.',
    '6. Las cantidades deben ser realistas para UNA porcion:',
    '   - Proteina principal: 100-200g',
    '   - Carbohidrato principal: 80-150g',
    '   - Vegetales: 50-150g',
    '   - Condimentos/aceites: 5-15g',
    '7. TODAS las cantidades en gramos enteros. NUNCA decimales,',
    '   tazas, cucharadas u otras unidades.',
    '8. modo_preparacion es OBLIGATORIO. Minimo 5 pasos numerados.',
    '   Cada paso debe ser una instruccion concreta de cocina.',
    '   Separar cada paso con \n. Ejemplo:',
    '   "1. Lavar y cortar el pollo en cubos.\n',
    '    2. Calentar aceite en sarten a fuego medio.\n',
    '    3. Saltear el pollo 8 minutos hasta dorar.\n',
    '    4. Agregar vegetales y cocinar 5 minutos mas.\n',
    '    5. Sazonar con sal y pimienta. Servir caliente."',
    '',
    'INGREDIENTES DISPONIBLES (usa SOLO estos, con su id exacto):',
    ingredientesJson,
    '',
    'SCHEMA JSON DE RESPUESTA - responde UNICAMENTE con este JSON:',
    '{',
    '  "nombre": "nombre descriptivo y apetitoso del plato",',
    '  "descripcion": "descripcion breve de maximo 120 caracteres",',
    '  "tiempo_preparacion_min": numero entero entre 5 y 60,',
    '  "modo_preparacion": "1. paso uno\\n2. paso dos\\n3. paso tres...",',
    '  "ingredientes": [',
    '    { "id_alimento_detalle": numero, "cantidad_g": numero entero }',
    '  ]',
    '}',
  ].join('\n');

  return { system, user };
};

const parseGptResponse = (content: string): RecipeGptResponse => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new ExternalServiceError('OpenAI', 'Respuesta JSON malformada');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ExternalServiceError('OpenAI', 'Respuesta JSON invalida');
  }

  const data = parsed as Partial<RecipeGptResponse>;

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
    ingredientes: data.ingredientes as RecipeGptResponse['ingredientes'],
  };
};

const callOpenAI = async (system: string, user: string): Promise<RecipeGptResponse> => {
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

const normalizeIngredientes = (
  ingredientes: RecipeGptResponse['ingredientes'],
  alimentosMap: Map<number, AlimentoDetalleItem>,
): Array<{ id_alimento_detalle: number; cantidad_g: number }> => {
  const invalidIds: number[] = [];
  const normalized: Array<{ id_alimento_detalle: number; cantidad_g: number }> = [];

  for (const item of ingredientes) {
    const id = Number((item as { id_alimento_detalle?: number }).id_alimento_detalle);
    const cantidadRaw = Number((item as { cantidad_g?: number }).cantidad_g);
    const cantidad = Math.round(cantidadRaw);

    if (!Number.isFinite(cantidadRaw) || cantidadRaw <= 0) {
      console.warn(
        `[recipe-generator] Ingrediente descartado: id=${id}, cantidad_raw=${(item as { cantidad_g?: number }).cantidad_g}`,
      );
      continue;
    }

    if (cantidad <= 0) {
      console.warn(
        `[recipe-generator] Ingrediente descartado tras redondeo: id=${id}, cantidad_raw=${cantidadRaw}`,
      );
      continue;
    }

    if (!alimentosMap.has(id)) {
      invalidIds.push(id);
      continue;
    }

    normalized.push({ id_alimento_detalle: id, cantidad_g: cantidad });
  }

  if (normalized.length === 0) {
    throw new ExternalServiceError('OpenAI', 'Ningun ingrediente valido despues de normalizar');
  }

  if (invalidIds.length > 0) {
    console.warn(`[recipe-generator] IDs invalidos ignorados: ${invalidIds.join(', ')}`);
  }

  return normalized;
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
    const perfilResult = await pool.query<PerfilEvaluacionRow>(
      GET_PERFIL_EVALUACION,
      [data.id_perfil, data.id_evaluacion],
    );

    if (!perfilResult.rows[0]) {
      throw new NotFoundError('Perfil o evaluacion');
    }

    const perfil = normalizePerfil(perfilResult.rows[0]);

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

    const alimentosMap = mapAlimentosDetalle(alimentosDetalleResult.rows);
    const alimentosList = Array.from(alimentosMap.values());

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

    const { system, user } = buildPrompt({
      perfil,
      condiciones,
      alimentosPreferidos,
      alimentosRestringidos,
      ingredientes: alimentosList,
      caloriasObjetivo,
      tiempoComidaNombre: data.tiempo_comida_nombre,
    });

    const gptRecipe = await callOpenAI(system, user);
    const ingredientes = normalizeIngredientes(gptRecipe.ingredientes, alimentosMap);

    const ingredientesConCalorias = ingredientes.map(item => {
      const alimento = alimentosMap.get(item.id_alimento_detalle)!;
      const caloriasAportadas = Math.round((alimento.calorias * item.cantidad_g) / 100);
      return {
        id_alimento_detalle: item.id_alimento_detalle,
        nombre: alimento.nombre,
        cantidad_g: item.cantidad_g,
        calorias_aportadas: caloriasAportadas,
      };
    });

    const caloriasTotales = ingredientesConCalorias
      .reduce((total, item) => total + item.calorias_aportadas, 0);

    if (caloriasTotales > MAX_CALORIAS_PLATO) {
      throw new ValidationError('Las calorias totales superan el maximo permitido');
    }

    const client = await pool.connect();
    let idMenuDiario: number | null = null;

    try {
      await client.query('BEGIN');

      const platoResult = await client.query<{ id_plato: number }>(
        INSERT_PLATO,
        [
          gptRecipe.nombre,
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

      for (const ingrediente of ingredientes) {
        await client.query(
          INSERT_PLATO_INGREDIENTE,
          [idPlato, ingrediente.id_alimento_detalle, ingrediente.cantidad_g],
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
        nombre: gptRecipe.nombre,
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

    const cachedPlato = await findCachedPlatoGeneric(
      data.id_tiempo_comida,
      data.calorias_objetivo,
    );

    if (cachedPlato) {
      return cachedPlato;
    }

    const aptitudIds = data.aptitudes?.filter(id => Number.isFinite(id)) ?? [];
    let aptitudesNombres: string[] = [];

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

      aptitudesNombres = aptitudesResult.rows.map(row => row.nombre);
    }

    const alimentosDetalleResult = await pool.query<AlimentoDetalleRow>(GET_ALIMENTOS_DETALLE_ALL);

    if (alimentosDetalleResult.rows.length === 0) {
      throw new ValidationError('No hay alimentos disponibles para generar la receta');
    }

    const alimentosMap = mapAlimentosDetalle(alimentosDetalleResult.rows);
    const alimentosList = Array.from(alimentosMap.values());

    const { system, user } = buildPromptGenerico({
      tiempoComidaNombre: data.tiempo_comida_nombre,
      caloriasObjetivo: data.calorias_objetivo,
      restricciones: data.restricciones ?? [],
      aptitudes: aptitudesNombres,
      ingredientes: alimentosList,
    });

    const gptRecipe = await callOpenAI(system, user);
    const ingredientes = normalizeIngredientes(gptRecipe.ingredientes, alimentosMap);

    const ingredientesConCalorias = ingredientes.map(item => {
      const alimento = alimentosMap.get(item.id_alimento_detalle)!;
      const caloriasAportadas = Math.round((alimento.calorias * item.cantidad_g) / 100);
      return {
        id_alimento_detalle: item.id_alimento_detalle,
        nombre: alimento.nombre,
        cantidad_g: item.cantidad_g,
        calorias_aportadas: caloriasAportadas,
      };
    });

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

      for (const ingrediente of ingredientes) {
        await client.query(
          INSERT_PLATO_INGREDIENTE,
          [idPlato, ingrediente.id_alimento_detalle, ingrediente.cantidad_g],
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

    if (diasResult.rows.length < 5) {
      throw new AppError(
        'La semana no tiene los 5 días configurados. Crear los días primero.',
        409,
        'INCOMPLETE_WEEK'
      );
    }

    const dias = diasResult.rows;

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
        } else {
          // Generar o regenerar receta
          // Obtener calorías diarias de la evaluación del perfil
          const perfilEvalResult = await pool.query<{ calorias_diarias_calculadas: number | null }>(
            'SELECT calorias_diarias_calculadas FROM evaluaciones_clinicas WHERE id_evaluacion = $1',
            [data.id_evaluacion]
          );

          const caloriasDiarias = perfilEvalResult.rows[0]?.calorias_diarias_calculadas ?? 2000;
          const caloriasObjetivo = Math.round(caloriasDiarias * TIEMPO_COMIDA_FACTORES[tiempo.nombre as TiempoComidaNombre]);

          let recipeResult: GeneratedRecipeResult | null = null;
          let reintentos = 0;
          const maxReintentos = 2;

          while (!recipeResult && reintentos <= maxReintentos) {
            const recipeData: GenerateRecipeDto = {
              id_perfil: idPerfil,
              id_evaluacion: data.id_evaluacion,
              id_tiempo_comida: tiempo.id_tiempo_comida,
              tiempo_comida_nombre: tiempo.nombre as TiempoComidaNombre,
              calorias_objetivo: caloriasObjetivo,
              id_dia_plan: dia.id_dia_plan,
            };

            recipeResult = await this.generateRecipe(recipeData);

            // Verificar regla de variedad
            const platoYaAsignado = platosAsignadosPorTiempo
              .get(tiempo.id_tiempo_comida)!
              .has(recipeResult.id_plato);

            if (platoYaAsignado && reintentos < maxReintentos) {
              recipeResult = null;
              reintentos++;
            }
          }

          if (!recipeResult) {
            throw new AppError(
              'No se pudo generar receta para el slot',
              500,
              'RECIPE_GENERATION_FAILED'
            );
          }

          slotsGenerados++;
          if (recipeResult.uso_gpt) {
            llamadasGpt++;
          }

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

