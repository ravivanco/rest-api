const ACTIVITY_FACTORS: Record<string, number> = {
  sedentario: 1.2,
  bajo: 1.375,
  medio: 1.55,
  alto: 1.725,
};

const DEFAULT_ACTIVITY_FACTOR = ACTIVITY_FACTORS.sedentario;

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeActivityLevel = (level: string): keyof typeof ACTIVITY_FACTORS => {
  const normalized = normalizeText(level);

  if (normalized in ACTIVITY_FACTORS) {
    return normalized as keyof typeof ACTIVITY_FACTORS;
  }

  return 'sedentario';
};

const normalizeGoal = (goal: string): 'bajar_peso' | 'ganar_masa' | 'mantener' => {
  const normalized = normalizeText(goal);

  if (
    normalized.includes('reducir') ||
    normalized.includes('disminuir') ||
    normalized.includes('bajar') ||
    normalized.includes('perder')
  ) {
    return 'bajar_peso';
  }

  if (
    normalized.includes('ganar') ||
    normalized.includes('masa') ||
    normalized.includes('musculo')
  ) {
    return 'ganar_masa';
  }

  return 'mantener';
};

const estimateExpectedTmbByAge = (edad: number): number => {
  if (edad <= 25) return 1700;
  if (edad <= 35) return 1600;
  if (edad <= 45) return 1520;
  if (edad <= 55) return 1450;
  if (edad <= 65) return 1380;
  return 1320;
};

const round2 = (value: number): number => Number(value.toFixed(2));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const NutritionCalculatorService = {
  calcularIMC(peso: number, altura: number): number {
    const alturaMetros = altura / 100;
    return round2(peso / (alturaMetros * alturaMetros));
  },

  calcularTMB(peso: number, altura: number, edad: number, sexo: string): number {
    const base = (10 * peso) + (6.25 * altura) - (5 * edad);
    const sexoNormalizado = sexo.trim().toUpperCase();

    if (sexoNormalizado === 'M') {
      return round2(base + 5);
    }

    if (sexoNormalizado === 'F') {
      return round2(base - 161);
    }

    return round2(base - 78);
  },

  calcularGET(tmb: number, nivel_actividad: string): number {
    const normalizedLevel = normalizeActivityLevel(nivel_actividad);
    const factor = ACTIVITY_FACTORS[normalizedLevel] ?? DEFAULT_ACTIVITY_FACTOR;
    return round2(tmb * factor);
  },

  calcularCaloriasObjetivo(get: number, objetivo: string): number {
    const normalizedGoal = normalizeGoal(objetivo);

    if (normalizedGoal === 'bajar_peso') {
      return Math.round(get - 400);
    }

    if (normalizedGoal === 'ganar_masa') {
      return Math.round(get + 300);
    }

    return Math.round(get);
  },

  calcularEdadMetabolica(
    tmb: number,
    porcentaje_grasa: number,
    masa_muscular: number,
    edad: number,
  ): number {
    const tmbEsperada = estimateExpectedTmbByAge(edad);
    const diferenciaTmbPct = ((tmbEsperada - tmb) / tmbEsperada) * 100;

    const ajustePorTmb = diferenciaTmbPct * 0.25;
    const ajustePorGrasa = (porcentaje_grasa - 25) * 0.35;
    const ajustePorMusculo = (32 - masa_muscular) * 0.20;

    const edadMetabolica = edad + ajustePorTmb + ajustePorGrasa + ajustePorMusculo;

    return Math.round(clamp(edadMetabolica, 12, 95));
  },

  calcularDistribucionMacros(objetivo: string): {
    distribucion_carbohidratos_pct: number;
    distribucion_proteinas_pct: number;
    distribucion_grasas_pct: number;
  } {
    const normalizedGoal = normalizeGoal(objetivo);

    if (normalizedGoal === 'bajar_peso') {
      return {
        distribucion_carbohidratos_pct: 40,
        distribucion_proteinas_pct: 35,
        distribucion_grasas_pct: 25,
      };
    }

    if (normalizedGoal === 'ganar_masa') {
      return {
        distribucion_carbohidratos_pct: 45,
        distribucion_proteinas_pct: 30,
        distribucion_grasas_pct: 25,
      };
    }

    return {
      distribucion_carbohidratos_pct: 50,
      distribucion_proteinas_pct: 25,
      distribucion_grasas_pct: 25,
    };
  },
};
