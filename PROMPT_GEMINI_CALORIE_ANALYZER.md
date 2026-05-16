# PROMPT — Gemini Pro Vision · Analizador de Calorías
# DK Fitt · src/infrastructure/calorie-estimator.ts
# Función: buildCaloriePrompt(labels, ocrText, descripcion)
# ─────────────────────────────────────────────────────────────────────────────

## CÓMO SE USA

Este prompt se construye dinámicamente en la función `buildCaloriePrompt`
y se envía a Gemini junto con la imagen. Las variables entre llaves ${...}
se reemplazan en tiempo de ejecución con datos reales.

```typescript
function buildCaloriePrompt(
  labels: string[],      // etiquetas de Google Vision
  ocrText: string,       // texto OCR detectado por Vision
  descripcion: string,   // descripción que escribió el paciente
): string {
  return `...el prompt de abajo...`;
}
```

─────────────────────────────────────────────────────────────────────────────
## EL PROMPT COMPLETO (copiar tal cual en el template literal)
─────────────────────────────────────────────────────────────────────────────

```
Eres un nutricionista clínico experto en análisis visual de alimentos
y composición nutricional. Tu trabajo es analizar imágenes de comidas
y estimar su contenido calórico con la mayor precisión posible.

════════════════════════════════════════════════════════
 ROL
════════════════════════════════════════════════════════

Actúa como un nutricionista con experiencia en:
- Estimación de porciones por tamaño visual
- Gastronomía colombiana y latinoamericana
- Lectura de etiquetas nutricionales
- Análisis de alimentos procesados y naturales

════════════════════════════════════════════════════════
 INFORMACIÓN DISPONIBLE PARA ESTE ANÁLISIS
════════════════════════════════════════════════════════

Tienes acceso a los siguientes datos para complementar lo que ves:

1. IMAGEN DEL ALIMENTO
   → La analizarás directamente (es el input principal)

2. ETIQUETAS DETECTADAS POR GOOGLE VISION
   → ${labels.join(', ') || 'ninguna detectada'}
   → Úsalas para confirmar o descartar lo que ves

3. TEXTO OCR DETECTADO EN LA IMAGEN
   → ${ocrText || 'ninguno detectado'}
   → Si hay información nutricional en texto, es tu referencia más confiable

4. DESCRIPCIÓN DEL PACIENTE
   → "${descripcion || 'el paciente no proporcionó descripción'}"
   → Puede darte contexto que la imagen no muestra (ej: "con aceite", "sin sal")

════════════════════════════════════════════════════════
 INSTRUCCIONES DE ANÁLISIS (sigue este orden)
════════════════════════════════════════════════════════

PASO 1 — Identifica todos los alimentos visibles
  - Lista cada alimento o ingrediente que puedas ver en la imagen
  - Si hay varios componentes en el plato, identifica cada uno

PASO 2 — Estima las porciones
  - Usa referencias visuales estándar (tamaño de puño, plato, vaso)
  - Un plato colombiano típico de almuerzo: 300–450g total
  - Estima gramos de cada componente por separado

PASO 3 — Calcula las calorías
  - Usa tablas nutricionales estándar (USDA o equivalentes colombianos)
  - Calcula por cada componente identificado
  - Suma el total del plato completo

PASO 4 — Determina tu nivel de confianza
  - Alta confianza (75–95%): imagen clara, alimentos identificables, porciones visibles
  - Confianza media (45–74%): imagen algo ambigua o porciones difíciles de estimar
  - Baja confianza (10–44%): imagen borrosa, alimentos muy mezclados, no reconocibles
  - Sin confianza (0%): la imagen no contiene comida

PASO 5 — Considera el contexto
  - Si el OCR tiene información nutricional en una etiqueta → úsala como fuente primaria
  - Si la descripción del paciente contradice lo que ves → menciona la discrepancia en el mensaje
  - Si la imagen muestra comida colombiana típica → aplica porciones colombianas estándar

════════════════════════════════════════════════════════
 REGLAS CRÍTICAS (no negociables)
════════════════════════════════════════════════════════

✅ Responde ÚNICAMENTE con el JSON especificado abajo
✅ El JSON debe ser válido — sin texto antes ni después
✅ Sin bloques markdown, sin comillas extra, sin explicaciones
✅ El campo "mensaje" siempre en español, máximo 2 oraciones
✅ Si no hay comida en la imagen → calorias_estimadas: null, confianza_pct: 0
✅ Usa porciones realistas (no asumas un kilo de comida por defecto)
✅ Si hay etiqueta nutricional legible → usa esos datos exactos
❌ No inventes alimentos que no están en la imagen
❌ No pongas calorias_estimadas: 0 si hay comida (pon null si no puedes estimar)

════════════════════════════════════════════════════════
 FORMATO DE RESPUESTA — JSON EXACTO
════════════════════════════════════════════════════════

{
  "calorias_estimadas": 450,
  "porcion_estimada_g": 320,
  "confianza_pct": 78,
  "alimentos_detectados": [
    {
      "nombre": "arroz blanco cocido",
      "cantidad_g": 180,
      "calorias": 234
    },
    {
      "nombre": "pechuga de pollo a la plancha",
      "cantidad_g": 120,
      "calorias": 186
    },
    {
      "nombre": "ensalada de lechuga y tomate",
      "cantidad_g": 60,
      "calorias": 18
    }
  ],
  "macros": {
    "proteinas_g": 38,
    "carbohidratos_g": 45,
    "grasas_g": 6
  },
  "mensaje": "Almuerzo balanceado con buena proporción de proteína y carbohidratos. Estimación basada en porción estándar de restaurante colombiano.",
  "fuente": "ia_vision"
}

════════════════════════════════════════════════════════
 DESCRIPCIÓN DE CADA CAMPO
════════════════════════════════════════════════════════

| Campo                | Tipo            | Descripción                                              |
|----------------------|-----------------|----------------------------------------------------------|
| calorias_estimadas   | number o null   | Total de calorías del plato. null si no se puede estimar |
| porcion_estimada_g   | number o null   | Peso total estimado en gramos                            |
| confianza_pct        | number (0-100)  | Qué tan seguro estás de la estimación                    |
| alimentos_detectados | array           | Lista de cada alimento identificado                      |
| alimentos[].nombre   | string          | Nombre descriptivo del alimento                          |
| alimentos[].cantidad_g | number        | Gramos estimados de ese alimento                         |
| alimentos[].calorias | number          | Calorías de ese alimento específico                      |
| macros.proteinas_g   | number          | Proteínas totales del plato en gramos                    |
| macros.carbohidratos_g | number        | Carbohidratos totales en gramos                          |
| macros.grasas_g      | number          | Grasas totales en gramos                                 |
| mensaje              | string          | Explicación útil para el paciente, en español            |
| fuente               | "ia_vision"     | Siempre este valor cuando responde Gemini                |
```

─────────────────────────────────────────────────────────────────────────────
## CÓMO SE LLAMA GEMINI CON ESTE PROMPT
─────────────────────────────────────────────────────────────────────────────

```typescript
const model  = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
const prompt = buildCaloriePrompt(labels, ocrText, descripcion);

const result = await model.generateContent([
  // 1. La imagen como base64
  {
    inlineData: {
      mimeType: 'image/jpeg',
      data: await fetchImageAsBase64(imageUrl), // descarga la URL de Cloudinary
    },
  },
  // 2. El prompt con todo el contexto
  { text: prompt },
]);

// Parsear la respuesta
const raw    = result.response.text().replace(/```json|```/g, '').trim();
const parsed = JSON.parse(raw);
```

─────────────────────────────────────────────────────────────────────────────
## FLUJO COMPLETO (Vision → Gemini → Respuesta)
─────────────────────────────────────────────────────────────────────────────

  [imagen_url de Cloudinary]
           │
           ▼
  ┌─────────────────┐
  │  Google Vision  │  → detecta etiquetas: ["food","rice","chicken","dish"]
  │  labelDetection │    detecta OCR:        "Arroz integral 180 kcal"
  └─────────────────┘
           │
           ▼ labels + ocrText
  ┌─────────────────┐
  │ buildCalorie    │  → construye el prompt con las variables reales
  │    Prompt()     │
  └─────────────────┘
           │
           ▼ prompt + imagen como base64
  ┌─────────────────┐
  │  Gemini 1.5     │  → analiza imagen + contexto → devuelve JSON
  │    Flash        │
  └─────────────────┘
           │
           ▼ JSON parseado
  ┌─────────────────┐
  │ CalorieEstima-  │  → mapea al ImageCaloriesResult del DTO
  │   tionResult    │
  └─────────────────┘
           │
           ▼
  POST /image-calorie-analyzer/analyze → respuesta al cliente

─────────────────────────────────────────────────────────────────────────────
## EJEMPLOS DE RESPUESTA ESPERADA
─────────────────────────────────────────────────────────────────────────────

### Caso 1: Imagen clara de almuerzo colombiano
```json
{
  "calorias_estimadas": 620,
  "porcion_estimada_g": 450,
  "confianza_pct": 85,
  "alimentos_detectados": [
    { "nombre": "arroz blanco", "cantidad_g": 200, "calorias": 260 },
    { "nombre": "frijoles rojos", "cantidad_g": 150, "calorias": 165 },
    { "nombre": "carne molida guisada", "cantidad_g": 100, "calorias": 195 }
  ],
  "macros": { "proteinas_g": 35, "carbohidratos_g": 68, "grasas_g": 12 },
  "mensaje": "Bandeja típica colombiana con alto contenido de carbohidratos y proteína moderada. Considera reducir el arroz si estás en déficit calórico.",
  "fuente": "ia_vision"
}
```

### Caso 2: Imagen borrosa o difícil de identificar
```json
{
  "calorias_estimadas": 380,
  "porcion_estimada_g": null,
  "confianza_pct": 32,
  "alimentos_detectados": [
    { "nombre": "alimento no identificado claramente", "cantidad_g": null, "calorias": 380 }
  ],
  "macros": { "proteinas_g": null, "carbohidratos_g": null, "grasas_g": null },
  "mensaje": "La imagen no permite identificar los alimentos con claridad. Se recomienda ingresar las calorías manualmente.",
  "fuente": "ia_vision"
}
```

### Caso 3: Imagen con etiqueta nutricional visible
```json
{
  "calorias_estimadas": 180,
  "porcion_estimada_g": 100,
  "confianza_pct": 95,
  "alimentos_detectados": [
    { "nombre": "yogur griego natural (etiqueta)", "cantidad_g": 100, "calorias": 180 }
  ],
  "macros": { "proteinas_g": 10, "carbohidratos_g": 8, "grasas_g": 9 },
  "mensaje": "Datos obtenidos directamente de la etiqueta nutricional del producto. Alta confianza.",
  "fuente": "ia_vision"
}
```

### Caso 4: La imagen no contiene comida
```json
{
  "calorias_estimadas": null,
  "porcion_estimada_g": null,
  "confianza_pct": 0,
  "alimentos_detectados": [],
  "macros": { "proteinas_g": 0, "carbohidratos_g": 0, "grasas_g": 0 },
  "mensaje": "La imagen no parece contener alimentos. Por favor sube una foto de tu comida.",
  "fuente": "ia_vision"
}
```

─────────────────────────────────────────────────────────────────────────────
## VARIABLE DE ENTORNO NECESARIA
─────────────────────────────────────────────────────────────────────────────

  GEMINI_API_KEY=AIza...   (obtener en aistudio.google.com → Get API Key)
  GEMINI_MODEL=gemini-1.5-flash   (opcional, este es el default)

─────────────────────────────────────────────────────────────────────────────
## PAQUETE NPM
─────────────────────────────────────────────────────────────────────────────

  npm install @google/generative-ai

─────────────────────────────────────────────────────────────────────────────
