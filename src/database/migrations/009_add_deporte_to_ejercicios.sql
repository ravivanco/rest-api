-- Migración 009: Agregar columna deporte a la tabla ejercicios y clasificar los 150 ejercicios existentes.
-- Fecha: 2026-05-24

ALTER TABLE ejercicios
ADD COLUMN IF NOT EXISTS deporte VARCHAR(50);

-- Agregar check constraint para los deportes válidos si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ejercicios_deporte'
  ) THEN
    ALTER TABLE ejercicios
    ADD CONSTRAINT chk_ejercicios_deporte CHECK (deporte IN ('gimnasio', 'running', 'futbol', 'basquet', 'ciclismo', 'natacion'));
  END IF;
END
$$;

COMMENT ON COLUMN ejercicios.deporte IS 'Deporte asociado al ejercicio (gimnasio, running, futbol, basquet, ciclismo, natacion)';

-- ============================================================
-- 1. GIMNASIO (25 ejercicios)
-- ============================================================
UPDATE ejercicios SET deporte = 'gimnasio' WHERE nombre IN (
  'Sentadilla con barra',
  'Press de banca plano',
  'Peso muerto convencional',
  'Dominadas en barra',
  'Press militar con barra',
  'Curl de bíceps con mancuernas',
  'Extensión de tríceps en polea',
  'Remo con barra',
  'Sentadilla goblet con kettlebell',
  'Hip thrust con barra',
  'Zancadas con mancuernas',
  'Face pull en polea',
  'Plancha abdominal isométrica',
  'Crunches abdominales',
  'Rueda abdominal (ab wheel)',
  'Jalón al pecho en polea',
  'Press de hombros con mancuernas sentado',
  'Elevaciones laterales con mancuernas',
  'Prensa de piernas',
  'Extensión de piernas en máquina',
  'Curl femoral en máquina',
  'Elevación de pantorrillas de pie',
  'Fondos en paralelas',
  'Remo en polea baja sentado',
  'HIIT en cinta — intervalos'
);

-- ============================================================
-- 2. RUNNING (25 ejercicios)
-- ============================================================
UPDATE ejercicios SET deporte = 'running' WHERE nombre IN (
  'Trote suave continuo',
  'Carrera a ritmo moderado',
  'Intervalos cortos 400m',
  'Intervalos largos 1000m',
  'Carrera de tempo 20 min',
  'Rodaje largo lento',
  'Cuestas — hill repeats',
  'Strides — aceleraciones',
  'Fartlek libre',
  'Carrera descalzo en césped',
  'Drills de técnica — skipping alto',
  'Drills — talones a glúteos',
  'Sentadilla búlgara — fuerza runner',
  'Zancadas nórdicas — isquiotibiales',
  'Elevación de talón unilateral',
  'Puente de glúteos unilateral',
  'Carrera en arena',
  'Sprint máximo 60m',
  'Carrera en escaleras',
  'Core running — plancha dinámica',
  'Movilidad de cadera — círculos',
  'Estiramiento de psoas en zancada',
  'Rodaje de recuperación activa',
  'Test de Cooper 12 min',
  'Carrera con chaleco de peso'
);

-- ============================================================
-- 3. CICLISMO (25 ejercicios)
-- ============================================================
UPDATE ejercicios SET deporte = 'ciclismo' WHERE nombre IN (
  'Pedaleo suave en llano',
  'Intervalos de potencia 30/30',
  'Subida de puerto en bicicleta',
  'Sprints en bici — 10 segundos',
  'Cadencia alta en llano (100+ RPM)',
  'Tempo ciclista — zona 3',
  'Fuerza en pedaleo — big gear',
  'Rodada larga de fondo',
  'Indoor cycling — clase grupal',
  'Bajada técnica controlada',
  'One-leg drill — pedaleo unilateral',
  'Sentadilla con barra — ciclista',
  'Prensa de piernas — ciclista',
  'Extensión de rodilla en máquina',
  'Plancha lateral — ciclista',
  'Yoga para ciclistas — apertura de cadera',
  'Estiramiento de isquiotibiales tumbado',
  'Movilidad torácica en foam roller',
  'Escalada en bicicleta de montaña',
  'Sesión de recuperación activa en bici',
  'Ciclismo en trail — terreno mixto',
  'Elevación de cadera en bicicleta',
  'Series cortas en velódromo',
  'Resistencia en viento — rodillo',
  'Test FTP — umbral de potencia'
);

-- ============================================================
-- 4. FÚTBOL (25 ejercicios)
-- ============================================================
UPDATE ejercicios SET deporte = 'futbol' WHERE nombre IN (
  'Rondo 4 vs 2',
  'Conducción con cambios de dirección',
  'Sprint de 15m — arranque explosivo',
  'Cambio de dirección con cono — COD',
  'Partido de posesión 3 vs 3',
  'Disparo a puerta desde fuera del área',
  'Cabeceo en salto con oposición',
  'Juego de pies rápidos — escalera de agilidad',
  'Carrera de resistencia intermitente',
  'Sentadilla explosiva — salto',
  'Pliometría — saltos en cajón',
  'Prensa de piernas unilateral — futbolista',
  'Nórdico de isquiotibiales',
  'Abductor en máquina — groin',
  'Plancha con desestabilización',
  'Control de balón en pared — 1000 toques',
  'Pressing y recuperación defensiva',
  'Recepción orientada y pase',
  'Trabajo de portero — reflejos',
  'Fuerza de tobillo — bosu',
  'Circuito metabólico futbolístico',
  'Coordinación ojo-pie con balón',
  'Test Yo-Yo de resistencia intermitente',
  'Stretch activo de cadera — futbolista',
  'Partido de fútbol 5 completo'
);

-- ============================================================
-- 5. BÁSQUETBOL (25 ejercicios)
-- ============================================================
UPDATE ejercicios SET deporte = 'basquet' WHERE nombre IN (
  'Tiro libre repetido — 50 lanzamientos',
  'Dribble en zigzag con cono',
  'Tiro en bandeja — layup',
  'Tiro en suspensión — jump shot',
  'Defensa lateral en slide',
  'Sprint de cancha completa — transition',
  'Salto vertical — counter movement jump',
  'Tabata de saltos al aro',
  'Pick and roll — jugada de 2',
  '1 vs 1 en poste bajo',
  'Ejercicio de rebote ofensivo — tip drill',
  'Sentadilla con salto — jugador de básquet',
  'Press de banca — fuerza de tren superior',
  'Dominadas — fuerza de tracción',
  'Core antirotación con cable',
  'Velocidad de manos — wall ball',
  'Agilidad en escalera + finalización',
  'Pase de pecho con oposición',
  'Circuito de defensa — shell drill',
  'Estiramiento de tobillo y pantorrilla',
  'Fortalecimiento de muñeca con pelota medicinal',
  'Partido de 3 vs 3 cancha reducida',
  'Tiro de 3 puntos — 100 lanzamientos',
  'Trabajo de pívot y finta',
  'Partido completo 5 vs 5'
);

-- ============================================================
-- 6. NATACIÓN (25 ejercicios)
-- ============================================================
UPDATE ejercicios SET deporte = 'natacion' WHERE nombre IN (
  'Técnica de crol — brazada completa',
  'Técnica de espalda',
  'Técnica de braza',
  'Técnica de mariposa — butterfly',
  'Series de velocidad 25m',
  'Series de fondo 400m continuo',
  'Pateo de crol con tabla',
  'Pateo de mariposa con tabla',
  'Pull de crol con pull buoy',
  'Intervalos de natación 8x50m',
  'Nado con palas y aletas',
  'Viraje en T — flip turn',
  'Nado lateral de equilibrio',
  'Aquagym — ejercicios en agua poco profunda',
  'Natación con snorkel central',
  'Fuerza de hombros en seco — rotación externa',
  'Jalón al pecho — fuerza específica nadador',
  'Core acuático — plancha en agua',
  'Respiración bilateral en crol',
  'Nado en aguas abiertas',
  'Salida de bloque — start training',
  'Recuperación activa — nado suave mixto',
  'Elongación de hombros en pared de piscina',
  'Test de 1500m — marca personal',
  'Circuito combinado 4 estilos — medley'
);
