# Base de datos — Plataforma Barbería

Supabase (PostgreSQL) con un único proyecto para todos los tenants.
El aislamiento de datos se implementa via columna `company_id` en todas las tablas.

---

## Setup inicial

1. Crear un proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor**
3. Ejecutar los scripts en orden desde `supabase/migrations/`

```bash
# Orden de aplicación
00001_initial_schema.sql   # Schema base: barbers, services, clients, appointments, branches
00002_v2.sql               # Mejoras de schema
00003_v3.sql               # ...
...hasta...
00020_barbers_fix.sql      # Fix de barberos huérfanos
```

Cada script es idempotente (`CREATE TABLE IF NOT EXISTS`, etc.) excepto los que
agregan columnas con `ALTER TABLE` — ejecutar en orden la primera vez.

---

## Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `companies` | Registro maestro de tenants (barberías) |
| `branches` | Sucursales de cada empresa |
| `barbers` | Perfiles de barberos (vinculados a `auth.users` via `user_roles`) |
| `services` | Servicios ofrecidos por cada empresa |
| `service_branch_prices` | Precios por sucursal (override de `services.price`) |
| `appointments` | Turnos/reservas |
| `clients` | Clientes que reservaron |
| `payments` | Pagos registrados en caja |
| `cash_registers` | Cajas (apertura/cierre) |
| `cash_movements` | Movimientos individuales de caja |
| `user_roles` | Roles y permisos de usuarios de Supabase Auth |
| `barber_branches` | Relación N:M barbero ↔ sucursal (visibilidad en agenda pública) |
| `push_subscriptions` | Suscripciones Web Push para notificaciones a barberos |

---

## Multi-tenancy

Todas las tablas de negocio tienen `company_id UUID` que referencia `companies.id`.

La lógica de scoping se implementa en `lib/tenant.ts`:
- `resolveCompanyId(auth, supabase)` — resuelve el company_id del usuario autenticado
- `buildCompanyScopeFilter(column, companyId, allowLegacyUnscoped)` — filtra por empresa
- `resolveSingleCompanyLegacyScope(supabase, companyId)` — modo legacy para registros
  con `company_id = NULL` (compatibilidad con datos pre-multi-tenant)

---

## Historial de migraciones

| Versión | Archivo | Descripción |
|---------|---------|-------------|
| v1 | `00001_initial_schema.sql` | Schema inicial: barbers, services, clients, appointments |
| v2 | `00002_v2.sql` | Primeras mejoras post-lanzamiento |
| v3 | `00003_v3.sql` | Mejoras de auth y permisos |
| v4 | `00004_v4.sql` | Actualizaciones de esquema |
| v5 | `00005_v5.sql` | Multi-tenant: columna company_id |
| v6 | `00006_v6.sql` | Sucursales y branches |
| v7 | `00007_v7.sql` | user_roles y permisos |
| v8 | `00008_v8.sql` | barber_branches (N:M) |
| v9 | `00009_v9.sql` | Mejoras de schema |
| v10 | `00010_v10.sql` | Módulo de caja (cash_registers, payments) |
| v11 | `00011_v11.sql` | Índices y performance |
| v12 | `00012_v12.sql` | Ajustes de tipos/columnas |
| v13 | `00013_v13.sql` | RLS policies |
| v14 | `00014_v14.sql` | Módulo de caja completo |
| v15 | `00015_v15.sql` | Push notifications (push_subscriptions) |
| v16 | `00016_v16.sql` | Precios por sucursal (service_branch_prices) |
| v17 | `00017_v17.sql` | Snapshot de precio en appointments.service_price |
| v18 | `00018_v18.sql` | Mejoras del módulo de caja |
| v19 | `00019_v19.sql` | Auditoría y limpieza de company_id=NULL (legado) |
| v20 | `00020_barbers_fix.sql` | Fix de barberos huérfanos sin company_id |

---

## Seeds para desarrollo

Los seeds están en `scripts/`:

```bash
# Seed de Felito Barber Studio (cliente principal)
# Ejecutar en SQL Editor de Supabase
scripts/db-seed-elcorteclasico.sql

# Seed de tenant de prueba (para testing multi-tenant)
scripts/db-seed-tenant2-test.sql

# Seed para onboarding de nueva barbería
scripts/db-seed-new-barbershop.sql

# Script de limpieza antes de entregar a un cliente
scripts/db-clean-for-delivery.sql

# Verificación de aislamiento multi-tenant
scripts/db-verify-multi-tenant-isolation.sql
```

---

## Row Level Security (RLS)

Las tablas tienen RLS habilitado en Supabase. Las políticas se aplican para el anon key
(booking público) y el service role bypasa las políticas (usado en API server-side).

La lógica de autorización principal está en la capa de API (`lib/api-auth.ts`, `lib/tenant.ts`),
con RLS como capa defensiva adicional.

---

## Limpieza de datos legado

Si la plataforma tenía datos antes de implementar multi-tenancy (company_id=NULL):

```sql
-- 1. Verificar cuántos registros tienen company_id=NULL
SELECT 'appointments' AS tbl, count(*) FROM appointments WHERE company_id IS NULL
UNION ALL
SELECT 'clients', count(*) FROM clients WHERE company_id IS NULL
UNION ALL
SELECT 'barbers', count(*) FROM barbers WHERE company_id IS NULL;

-- 2. Si solo hay 1 empresa activa, ejecutar:
-- supabase/migrations/00019_v19.sql (backfill automático)
-- o
-- scripts/db-clean-for-delivery.sql (más completo)
```

Una vez que todos los registros tengan `company_id` asignado, el modo
`allowLegacyUnscoped` en `lib/tenant.ts` dejará de activarse automáticamente
(porque `activeCompanyIds.length` será > 1 cuando haya más de 1 cliente activo).

---

## Backup

Supabase incluye backups automáticos diarios en el plan Pro.
Para exportar manualmente: Dashboard → Settings → Database → Backups.

Para exportar el schema:
```bash
# Requiere Supabase CLI instalado
supabase db dump --linked > backup_$(date +%Y%m%d).sql
```
