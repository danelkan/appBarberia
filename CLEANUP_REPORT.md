# Reporte de Limpieza y Hardening — Plataforma Barbería

**Fecha:** 20 Abril 2026
**Rama:** main
**Ejecutado por:** Claude Code (claude-sonnet-4-6)

---

## Resumen ejecutivo

Se auditó y endureció el repositorio de producción de la plataforma barbería.
La aplicación construye, pasa todos los tests y el linter sin errores nuevos.
Se documentaron los riesgos de seguridad conocidos y se centralizó la lógica
de resolución de subdominio → tenant en middleware.ts.

---

## STEP 1 — Inspección inicial

### Hallazgos

| Ítem | Estado | Acción |
|------|--------|--------|
| `.env.production` en disco | Presente (no en git index) | .gitignore lo cubre |
| `node_modules/` en git index | No está | OK |
| `.next/` en git index | No está | OK |
| `tsconfig.tsbuildinfo` en git index | No está | OK |
| `.DS_Store` en git index | No está | OK |
| Migraciones SQL en raíz del proyecto | 20 archivos | Movidos a `supabase/migrations/` |
| Scripts `npm run lint` | 3 warnings (no errores) | Documentados |
| Scripts `npm test` | 54/54 tests OK | OK |
| Scripts `npm run build` | Build exitoso | OK |

### Archivos rastreados que no deberían estar

Ninguno. El `git ls-files` mostró solo archivos de código fuente y ejemplos.

---

## STEP 2 — .gitignore

**Cambios realizados:**
- `node_modules` → `node_modules/` (trailing slash más explícita)
- `coverage` → `coverage/`
- Agregado: `dist/`
- Agregado: `__MACOSX/`
- Consolidado: `.env.*` (cubre todos los archivos de entorno)
- Agregado: `!.env.example` y `!.env.local.example` (whitelist explícita)
- `.vercel` → `.vercel/`

**Archivos removidos del índice con `git rm --cached`:**
Ninguno era necesario — los archivos problemáticos ya no estaban en el índice.

---

## STEP 3 — Integridad del índice de git

**Resultado:** Todos los archivos rastreados existen en disco.
Ningún archivo faltante encontrado.

---

## STEP 4 — .env.example

**Cambios realizados:**
- Agregada variable `APP_TIMEZONE` (usada en `lib/booking-availability.ts` pero faltaba en el ejemplo)
- Todas las demás variables requeridas ya estaban documentadas con valores placeholder

---

## STEP 5 — Lint, Tests y Build

### Lint (`npm run lint`)

**Warnings (no errores):**
1. `app/admin/agenda/page.tsx:210` — `react-hooks/exhaustive-deps`: inicialización de `barbers` debería estar en su propio `useMemo()`
2. `app/admin/layout.tsx:197` — `react-hooks/exhaustive-deps`: `pathname` falta en array de dependencias

**Decisión:** No se corrigieron. Son warnings de optimización en componentes complejos.
Corregirlos sin tests de integración del flujo de agenda podría romper comportamiento en producción.
Documentados aquí para resolver en una sesión de refactoring dedicada.

### Tests (`npm test`)

```
Test Files: 7 passed (7)
Tests:      54 passed (54)
Duration:   180ms
```

Todos los tests pasan. Archivos de test:
- `lib/admin-shell.test.ts`
- `lib/barbers.test.ts`
- `lib/booking-availability.test.ts`
- `lib/companies.test.ts`
- `lib/multi-tenant-audit.test.ts`
- `lib/service-pricing.test.ts`
- `lib/tenant.test.ts`

### Build (`npm run build`)

Build exitoso. 51 rutas generadas (22 estáticas + 29 dinámicas).
Los mismos 3 warnings de lint aparecen durante el build — no son errores.

---

## STEP 6 — Multi-tenant hardening

### a) SUBDOMAIN_MAP en middleware.ts

Se agregó comentario TODO explícito en español explicando que el mapa hardcodeado
es una solución temporal del MVP y debe reemplazarse con una tabla `company_domains`
en Supabase cuando escale a más de ~5 clientes.

### b) resolveTenantFromHost() centralizado

Se extrajo la lógica inline de resolución subdominio → slug a una función
`resolveTenantFromHost(host: string): string | null` en `middleware.ts`.
La función está documentada con JSDoc. El comportamiento es idéntico al anterior.

### c) allowLegacyUnscoped en lib/tenant.ts

Se agregó comentario TODO en `getSingleCompanyLegacyScope()` explicando:
- Qué es el modo legacy (registros con company_id=NULL)
- El riesgo de cross-tenant data leakage si la condición de un solo tenant se violar
- La acción correctiva: ejecutar `scripts/db-clean-for-delivery.sql`

### d) TODO en rutas API con modo legacy

Se agregaron comentarios TODO en tres rutas API que usan `resolveSingleCompanyLegacyScope`
para el flujo público (sin autenticación):
- `app/api/barbers/route.ts`
- `app/api/services/route.ts`
- `app/api/branches/route.ts`

### Evaluación de rutas API sin scope

Se revisaron todas las rutas API. Resultado:
- `/api/appointments` — correctamente scoped (requiere auth o branch_id)
- `/api/appointments/list` — requiere auth, scoped por company
- `/api/appointments/slots` — público pero requiere branchId → resuelve companyId
- `/api/barbers` — TODO agregado (path público con legacyScope)
- `/api/branches` — TODO agregado (path público con legacyScope)
- `/api/services` — TODO agregado (path público con legacyScope)
- `/api/clients` — requiere auth, scoped por company
- `/api/companies` — requiere auth superadmin
- `/api/users` — requiere auth, scoped por company
- `/api/payments` — requiere auth, scoped
- `/api/cash-registers` — requiere auth, scoped
- `/api/push/subscriptions` — scoped por user_id (no por company, correcto)
- `/api/push/public-key` — no accede a datos de usuario

---

## STEP 7 — Migraciones de Supabase

**Situación inicial:** 20 archivos SQL en el directorio raíz del proyecto.

**Acción:**
- Creado directorio `supabase/migrations/`
- Copiados todos los archivos con nombres numerados secuenciales (00001–00020)
- Los archivos originales en la raíz se mantienen por compatibilidad con referencias existentes

**Archivos movidos:**
- `supabase-schema.sql` → `supabase/migrations/00001_initial_schema.sql`
- `supabase-migration-v2.sql` → `supabase/migrations/00002_v2.sql`
- ... (v3 a v19 siguiendo el mismo patrón)
- `supabase-migration-barbers-fix.sql` → `supabase/migrations/00020_barbers_fix.sql`

**Nota:** Los originales en la raíz no se eliminaron para no romper referencias en
`SETUP.md` y `DNS-RESEND-SETUP.md` que los mencionan por nombre.

---

## STEP 8 — Documentación creada

| Archivo | Descripción |
|---------|-------------|
| `README.md` | Reemplazado con documentación completa del proyecto |
| `ARCHITECTURE_NOTES.md` | Arquitectura multi-tenant, stack, routing, roles |
| `SECURITY_NOTES.md` | Incidente de claves expuestas, riesgos, checklist |
| `supabase/README-db.md` | Schema de BD, migraciones, seeds, RLS |
| `CLEANUP_REPORT.md` | Este archivo |

---

## Deuda técnica identificada (no corregida en esta sesión)

| # | Área | Descripción | Prioridad |
|---|------|-------------|-----------|
| 1 | `middleware.ts` | SUBDOMAIN_MAP debe venir de tabla `company_domains` en Supabase | Media |
| 2 | `lib/tenant.ts` | Limpiar registros con company_id=NULL para desactivar `allowLegacyUnscoped` | Alta |
| 3 | `app/admin/agenda/page.tsx` | 2 warnings de react-hooks/exhaustive-deps | Baja |
| 4 | `app/admin/layout.tsx` | Warning de react-hooks/exhaustive-deps (pathname) | Baja |
| 5 | Rate limiting | Usar Redis (Upstash) para rate limiting compartido entre instancias Vercel | Media |
| 6 | Pre-commit hook | Verificar que el hook esté instalado en todos los entornos de desarrollo | Alta |

---

## Comandos ejecutados

```bash
git status                    # estado inicial
git ls-files                  # archivos rastreados
npm run lint                  # 3 warnings, 0 errores
npm test                      # 54/54 OK
npm run build                 # build exitoso
```
