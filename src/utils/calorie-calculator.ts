/**
 * Fórmula de Mifflin-St Jeor para calcular el Metabolismo Basal (TMB).
 * Es la más precisa y recomendada actualmente.
 *
 * Hombre: TMB = (10 × peso_kg) + (6.25 × altura_cm) − (5 × edad) + 5
 * Mujer:  TMB = (10 × peso_kg) + (6.25 × altura_cm) − (5 × edad) − 161
 * Otro:   Promedio de ambas fórmulas
 */
export const calcularTMB = (
  peso_kg:    number,
  altura_cm:  number,
  edad:       number,
  sexo:       string,
): number => {
  const base = (10 * peso_kg) + (6.25 * altura_cm) - (5 * edad);

  if (sexo === 'M') return Math.round(base + 5);
  if (sexo === 'F') return Math.round(base - 161);
  return Math.round(base - 78); // 'O' — promedio
};

/**
 * Factores de actividad para ajustar el TMB.
 */
const FACTORES_ACTIVIDAD: Record<string, number> = {
  sedentario: 1.2,
  bajo:       1.375,
  medio:      1.55,
  alto:       1.725,
};

/**
 * Distribución de macronutrientes según el objetivo del paciente.
 * Porcentajes de carbohidratos, proteínas y grasas.
 */
const DISTRIBUCION_MACROS: Record<string, { carbs: number; proteinas: number; grasas: number }> = {
  'Reducir mi peso corporal':          { carbs: 40, proteinas: 35, grasas: 25 },
  'Disminuir mi grasa corporal':       { carbs: 40, proteinas: 35, grasas: 25 },
  'Mejorar mis hábitos alimenticios':  { carbs: 50, proteinas: 25, grasas: 25 },
  'Mejorar mi condición física':       { carbs: 45, proteinas: 30, grasas: 25 },
  'Sentirme más saludable':            { carbs: 50, proteinas: 25, grasas: 25 },
  default:                             { carbs: 50, proteinas: 25, grasas: 25 },
};

/**
 * Calcula las calorías diarias y distribución de macros completa.
 *
 * @param peso_kg           Peso actual del paciente
 * @param altura_cm         Altura del paciente
 * @param edad              Edad del paciente
 * @param sexo              M, F u O
 * @param nivel_actividad   sedentario | bajo | medio | alto
 * @param objetivo          Objetivo declarado en el formulario inicial
 */
export const calcularRequerimientoNutricional = (params: {
  peso_kg:          number;
  altura_cm:        number;
  edad:             number;
  sexo:             string;
  nivel_actividad:  string;
  objetivo:         string;
}): {
  calorias_diarias:             number;
  distribucion_carbohidratos_pct: number;
  distribucion_proteinas_pct:   number;
  distribucion_grasas_pct:      number;
} => {
  // 1. Calcular TMB
  const tmb = calcularTMB(
    params.peso_kg,
    params.altura_cm,
    params.edad,
    params.sexo,
  );

  // 2. Ajustar por nivel de actividad
  const factor = FACTORES_ACTIVIDAD[params.nivel_actividad] ?? FACTORES_ACTIVIDAD.sedentario;
  const calorias = Math.round(tmb * factor);

  // 3. Obtener distribución de macros según objetivo
  const macros = DISTRIBUCION_MACROS[params.objetivo] ?? DISTRIBUCION_MACROS.default;

  return {
    calorias_diarias:               calorias,
    distribucion_carbohidratos_pct: macros.carbs,
    distribucion_proteinas_pct:     macros.proteinas,
    distribucion_grasas_pct:        macros.grasas,
  };
};