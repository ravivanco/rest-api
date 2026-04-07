# 🚀 CHECKLIST FASE 6, 7 y 8 — Producción

**Fecha análisis:** 06 Abril 2026  
**Estado del proyecto:** REST API DK Fitt — En configuración para producción

---

## 📋 FASE 6 — Ajustes para Producción

### ✅ PASO 1 — Puerto dinámico (process.env.PORT)
- **Estado:** ✅ **COMPLETADO**
- **Dificultad:** Muy Simple
- **Detalles:**
  - ✅ `src/config/env.ts` línea 11: `PORT: parseInt(process.env.PORT || '3000')`
  - ✅ `src/server.ts` línea 22: `app.listen(env.PORT, '0.0.0.0'...)`
  - ✅ Correcto para Render (detectará automáticamente puerto 10000)

---

### ⚠️ PASO 2 — CORS para producción
- **Estado:** ⚠️ **PARCIALMENTE COMPLETADO**
- **Dificultad:** Simple
- **Qué está bien:**
  - ✅ CORS instalado en `package.json`
  - ✅ Chequeo de `env.NODE_ENV === 'production'`
- **Qué FALTA:**
  - ❌ La guía requiere lista detallada de `allowedOrigins` con dominios específicos
  - ❌ Falta manejador `callback` más sofisticado para origen undefined
  - ❌ Falta `credentials: true` y `maxAge: 86400`
  - ❌ Actualizar array de métodos y headers según guía

**Acción:** Actualizar `src/app.ts` linea ~27 con estructura callback más robusta

---

### ✅ PASO 3 — Manejo de errores en producción
- **Estado:** ✅ **COMPLETADO**
- **Dificultad:** Simple
- **Detalles:**
  - ✅ `src/middlewares/errorHandler.ts` línea 45: Solo expone debug en desarrollo
  - ✅ No revela stack traces en producción
  - ✅ Mensajes genéricos: "Ocurrió un error interno..."

---

### ⚠️ PASO 4 — Logger HTTP (morgan)
- **Estado:** ⚠️ **PARCIALMENTE COMPLETADO**
- **Dificultad:** Simple
- **Qué está bien:**
  - ✅ Morgan instalado en `package.json`
  - ✅ Actualmente usa `morgan('dev')`
- **Qué FALTA:**
  - ❌ No hay condicional para cambiar según `NODE_ENV`
  - ❌ En test debería NO loguear nada
  - ❌ En producción debería usar `morgan('combined')`
  - ❌ Actualmente solo chequea `if (env.NODE_ENV !== 'test')`

**Acción:** Actualizar `src/app.ts` línea ~50 con lógica de 3 entornos

---

### ⚠️ PASO 5 — Swagger solo en desarrollo
- **Estado:** ⚠️ **PARCIALMENTE COMPLETADO**
- **Dificultad:** Simple
- **Qué está bien:**
  - ✅ Swagger está en desarrollo
  - ✅ Intenta verificar `env.NODE_ENV !== 'test'`
- **Qué FALTA:**
  - ❌ La guía especifica `if (env.NODE_ENV === 'development')`
  - ❌ Debe bloquear en PRODUCCIÓN específicamente
  - ❌ Nota: Render lo resolverá como 404 automáticamente si no existe

**Acción:** Cambiar lógica a `if (env.NODE_ENV === 'development')`

---

### ⚠️ PASO 6 — Helmet (cabeceras de seguridad)
- **Estado:** ⚠️ **PARCIALMENTE COMPLETADO**
- **Dificultad:** Simple
- **Qué está bien:**
  - ✅ Helmet está instalado y activo en `app.ts` línea 23
  - ✅ Usa `app.disable('x-powered-by')`
- **Qué FALTA:**
  - ❌ Falta configuración explícita: `contentSecurityPolicy: false`
  - ❌ No hay comentario explicando por qué

**Acción:** Reemplazar `app.use(helmet())` por versión configurada expl

ícita

---

### ❌ PASO 7 — Compresión de respuestas
- **Estado:** ❌ **NO IMPLEMENTADO**
- **Dificultad:** Simple
- **Qué FALTA:**
  - ❌ Package `compression` NO está en `package.json`
  - ❌ No hay import en `src/app.ts`
  - ❌ No hay middleware de compresión

**Acciones requeridas:**
1. Instalar: `npm install compression` y `npm install -D @types/compression`
2. Agregar import en `src/app.ts`
3. Usar después de `app.disable('x-powered-by')`

**Beneficio:** Reduce respuestas JSON hasta 70% en tamaño

---

### ✅ PASO 8 — Rate limiting específico
- **Estado:** ✅ **COMPLETADO (con mejoras menores)**
- **Dificultad:** Muy Simple
- **Qué está bien:**
  - ✅ `globalLimiter`: 200 peticiones por 15 min
  - ✅ `authLimiter`: 5 intentos fallidos por 15 min
  - ✅ USA `env.RATE_LIMIT_*` variables
  - ✅ `skipSuccessfulRequests: true` para auth
- **Qué podría mejorarse:**
  - ⚠️ La guía sugiere agregar `uploadLimiter` (10 imágenes por minuto)
  - ⚠️ La guía sugiere usar variables de `env.` en lugar de process.env directo

**Acción OPCIONAL:** Agregar `uploadLimiter` si hay módilo de imágenes

---

### ⚠️ PASO 9 — Git & Commit
- **Estado:** Depende del usuario
- **Dificultad:** Muy Simple
- **Comandos recomendados:**
  ```bash
  git add .
  git commit -m "feat: ajustes de produccion - cors, logs, compresion, seguridad"
  git push origin main
  ```

---

## 📋 FASE 7 — Verificación del Deploy

### 🔍 PASO 1 — URL Pública
- **URL asignada:** `https://dk-fitt-api.onrender.com`
- **Estado:** Pendiente primera vez (debes verificar en Render)

---

### 🔍 PASO 2 — Monitoreo de Logs en Render
- **Cómo:** Render → tu servicio → Logs (menú izquierdo)
- **Qué esperar:** Output similar a `src/server.ts` línea 23-30
- **Pendiente:** Hacer primer deploy

---

### 🧪 Pruebas de Verificación (8 tests)

| # | Endpoint | Método | Estado | Notas |
|---|----------|--------|--------|-------|
| 1 | `/api/health` | GET | ⏳ Pendiente | Debería retornar 200 + database: connected |
| 2 | `/api/ruta-que-no-existe` | GET | ⏳ Pendiente | Debería retornar 404 con formato correcto |
| 3 | `/api/patient-profile/medical-conditions` | GET | ⏳ Pendiente | Debería retornar 5 condiciones públicas |
| 4 | `/api/auth/register` | POST | ⏳ Pendiente | Debería retornar 201 con id_usuario |
| 5 | `/api/auth/login` (paciente) | POST | ⏳ Pendiente | Debería retornar 200 + access_token |
| 6 | `/api/auth/me` | GET + token | ⏳ Pendiente | Requiere header Authorization |
| 7 | `/api/auth/login` (nutricionista) | POST | ⏳ Pendiente | Debería retornar rol: nutricionista |
| 8 | Logs en Render | - | ⏳ Pendiente | Verificar sin errores 500 |

---

## 📋 FASE 8 — Dominio, Seguridad y Mejoras

### ✅ PASO 1 — HTTPS (SSL)
- **Estado:** ✅ **AUTOMÁTICO EN RENDER**
- **Dificultad:** N/A (ya incluido)
- **Nota:** El dominio gratuito de Render ya tiene SSL. No necesita configuración.

---

### ⏳ PASO 2 — Dominio personalizado (OPCIONAL)
- **Estado:** ⏳ **Pendiente**
- **Dificultad:** Simple
- **Dominio target:** `api.dkfitt.decokasas.com`
- **Pasos:**
  1. Render → Settings → Custom Domains
  2. Agregar CNAME en DNS del proveedor
  3. Verificar propagación (24 horas)

---

### ⏳ PASO 3 — Backups de BD
- **Estado:** ⏳ **Pendiente (plan gratuito)**
- **Dificultad:** Simple (manual)
- **Plan gratuito:** Sin backups automáticos
- **Solución:** Backup manual periódico desde pgAdmin

**Cuando subas a plan de pago:**
- ✅ Backups automáticos diarios (7 días retención)

---

### ⏳ PASO 4 — Migraciones de BD
- **Estado:** ⏳ **Pendiente (cuando sea necesario)**
- **Dificultad:** Simple
- **Estructura propuesta:**
  ```
  src/database/migrations/
  ├── 001_initial_schema.sql (ya aplicado)
  ├── 002_add_foto_perfil.sql (cuando se necesite)
  └── ...
  ```
- **Regla:** Nunca modificar un archivo ya aplicado. Crear uno nuevo numerado.

---

### ⏳ PASO 5 — Escalar el servicio (OPCIONAL)
- **Estado:** ⏳ **Pendiente quando sea necesario**
- **Dificultad:** Muy Simple
- **Plan actual:** Free (512MB, 1 instancia, duerme en inactividad)
- **Opciones de upgrade:**
  - **Starter:** $7/mes (512MB, sin sleep)
  - **Standard:** $25/mes (2GB)
  - **Pro:** $85/mes (4GB, múltiples instancias)

---

### ⏳ PASO 6 — Variables por Entorno (OPCIONAL)
- **Estado:** ⏳ **Pendiente (avanzado)**
- **Dificultad:** Simple (pero no urgente)
- **Benefit:** Separar staging de producción
- **Render feeature:** Environment Groups

---

### ⏳ PASO 7 — Monitoreo básico (RECOMENDADO)
- **Estado:** ⏳ **Pendiente (recomendado)**
- **Dificultad:** Simple
- **Opción 1:** Render Metrics (gratuito, básico)
  - CPU, Memory, Requests, Response time
- **Opción 2:** UptimeRobot (gratuito, recomendado)
  - Verifica health cada 5 minutos
  - Notifica por email si cae

---

### ⏳ PASO 8 — Configurar UptimeRobot (RECOMENDADO)
- **Estado:** ⏳ **Pendiente (recomendado)**
- **Dificultad:** Muy Simple
- **Beneficio adicional:** Evita que Render durmaMT el servicio (ping cada 5 min)
- **Pasos:**
  1. uptimerobot.com → New Monitor
  2. URL: `https://dk-fitt-api.onrender.com/api/health`
  3. Interval: 5 minutes
  4. Recibir alertas por email

---

### ⏳ PASO 9 — Preparación para producción real
- **Estado:** ⏳ **Pendiente (cuando sea productivo)**
- **Dificultad:** Variable
- **Checklist de seguridad:**
  - [ ] Rotar JWT_SECRET cada 3 meses
  - [ ] Revisar logs semanalmente
  - [ ] Actualizar dependencias: `npm audit` mensualmente
  - [ ] Backup BD manual mensualmente
- **Checklist de performa:**
  - [ ] Agregar índices a BD (si necesario)
  - [ ] Considerar Redis para caché (si > 10k usuarios)
  - [ ] Compresión (ya configurada en Paso 7)
- **Checklist de confiabilidad:**
  - [ ] Configurar UptimeRobot
  - [ ] Ambiente staging separado
  - [ ] Documentar deploy process

---

## 🎯 PRIORIDAD DE ACCIONES

### 🔴 CRÍTICO (Hacer antes de cualquier deploy a Render)
1. ❌ **Instalar `compression`** — Paso 7
2. ⚠️ **Actualizar CORS** — Paso 2
3. ⚠️ **Actualizar morgan logger** — Paso 4

### 🟡 IMPORTANTE (Después del primer deploy)
4. ⚠️ **Actualizar Swagger (if development)** — Paso 5
5. ⚠️ **Configurar Helmet explícitamente** — Paso 6
6. ✅ **Rate limiting** — Paso 8 (ya está)

### 🟢 RECOMENDADO (Una semana después del deploy)
7. ⏳ **Configurar UptimeRobot** — Fase 8, Paso 8
8. ⏳ **Configurar backups manuales** — Fase 8, Paso 3

### ⚪ OPCIONAL (Cuando cresca el proyecto)
9. ⏳ Escalar a plan de pago
10. ⏳ Dominio personalizado
11. ⏳ Staging separado

---

## 📊 SUMARIO RÁPIDO

| Fase/Paso | Descripción | Estado | Dificultad | Urgencia |
|-----------|-------------|--------|-----------|----------|
| 6.1 | Puerto dinámico | ✅ | — | — |
| 6.2 | CORS producción | ⚠️ | Simple | 🔴 |
| 6.3 | Errores producción | ✅ | — | — |
| 6.4 | Logger HTTP | ⚠️ | Simple | 🔴 |
| 6.5 | Swagger desarrollo | ⚠️ | Simple | 🟡 |
| 6.6 | Helmet | ⚠️ | Simple | 🟡 |
| 6.7 | Compresión | ❌ | Simple | 🔴 |
| 6.8 | Rate limiting | ✅ | — | — |
| 6.9 | Git commit | ⏳ | — | 🔴 |
| 7 | Tests deploy | ⏳ | — | 🔴 |
| 8 | Seguridad avanz | ⏳ | Variable | 🟢 |

---

## 💾 ARCHIVOS A MODIFICAR

```
src/
├── app.ts                           ← PRINCIPAL (CORS, Helmet, Morgan, Swagger, Compression)
├── config/
│   └── env.ts                       ← Verificar (ya está bien)
├── server.ts                        ← Verificar (ya está bien)
└── middlewares/
    ├── errorHandler.ts              ← Verificar (ya está bien)
    └── rateLimiter.ts               ← Verificar (ya está bien)

package.json                        ← AGREGAR compression
```

---

## 🚀 PRÓXIMOS PASOS

### Inmediatos (antes de Render deploy)
```bash
# 1. Instalar compression
npm install compression
npm install -D @types/compression

# 2. Actualizar src/app.ts (4 cambios)
# 3. Verificar src/config/env.ts ✅
# 4. Build y test local
npm run build
npm run dev

# 5. Commit y push
git add .
git commit -m "feat: phase-6 production adjustments"
git push origin main
```

### Después del deploy a Render
```
1. Monitorear logs en Render (5-10 minutos)
2. Ejecutar tests de Fase 7 (8 tests)
3. Configurar UptimeRobot si todo OK
4. Celebrar 🎉
```

---

**Última actualización:** 06 Abril 2026  
**Próxima revisión:** Después del primer deploy a Render
