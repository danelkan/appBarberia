# Notas de Arquitectura — Plataforma Barbería

## Visión general

SaaS multi-tenant para barberías. Una sola instancia de Next.js + un solo proyecto de
Supabase sirven a múltiples clientes (barberías). Cada cliente tiene su propio subdominio
y sus datos están aislados por `company_id` en todas las tablas.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend + API | Next.js 14 (App Router), TypeScript, TailwindCSS |
| Base de datos | Supabase (PostgreSQL + Auth + Storage) |
| Hosting | Vercel |
| Email transaccional | Resend |
| Push notifications | Web Push API (VAPID) |
| Validación | Zod |

---

## Multi-tenancy

### Modelo de datos

- Todas las tablas de negocio (`appointments`, `clients`, `barbers`, `services`,
  `branches`, `payments`, `cash_registers`) tienen una columna `company_id` (UUID).
- La tabla `companies` es el registro maestro de cada tenant.
- Las Row Level Security (RLS) policies de Supabase son la última línea de defensa,
  pero la lógica de scoping principal se hace en la capa de API (`lib/tenant.ts`).

### Resolución de tenant

El tenant se resuelve en dos contextos:

**1. Rutas públicas (reservas, landing):**
- El middleware de Next.js lee el subdominio del Host header.
- `resolveTenantFromHost()` mapea el subdominio a un slug en `SUBDOMAIN_MAP`.
- El slug se inyecta como query param `?company=felitobarber` en la URL.
- Las rutas de API públicas (`/api/barbers`, `/api/services`, `/api/appointments/slots`)
  usan ese param para resolver el `company_id` desde la tabla `companies`.

**2. Rutas autenticadas (admin, staff):**
- El `company_id` se deriva del contexto de autenticación del usuario (`auth.company_id`
  o via sus `branch_ids` → `branches.company_id`).
- Ver `lib/tenant.ts → resolveCompanyId()`.

---

## Routing de subdominios

| Host | Destino |
|------|---------|
| `iadai.tech` | Panel superadmin (Agencia IA) |
| `felitobarber.iadai.tech` | Landing + reservas de Felito Barber Studio |
| `reservar.felitobarber.iadai.tech` | Flujo de reservas de Felito Barber Studio |
| `www.felitobarber.iadai.tech` | Landing estática de Felito Barber Studio |
| `*.iadai.tech/admin` | Panel de administración del cliente correspondiente |

El routing de subdominios está definido en `middleware.ts` con `SUBDOMAIN_MAP` (hardcodeado,
ver `SECURITY_NOTES.md` y los TODOs en el código para la versión dinámica futura).

---

## Roles y permisos

| Rol | Descripción |
|-----|-------------|
| `superadmin` | Agencia IA — acceso total a todas las empresas |
| `admin` | Dueño/manager de una barbería — acceso a su empresa |
| `barber` | Barbero — acceso limitado a su agenda y sucursal |

Los permisos granulares se almacenan en `user_roles.permissions` (array de strings).
La tabla de permisos disponibles está en `lib/permissions.ts`.

El superadmin puede definirse por UUID (`SUPERADMIN_UUID` env var) como bypass de
emergencia, independiente de la tabla `user_roles`.

---

## Estructura de directorios

```
app/
  admin/          — Panel de administración (Next.js pages)
  api/            — API routes (server-side, todas requieren auth excepto booking)
  reservar/       — Flujo público de reservas
  mis-turnos/     — Consulta de turnos por cliente
  login/          — Autenticación
components/
  booking/        — Componentes del flujo de reservas
  ui/             — Componentes UI reutilizables
lib/
  tenant.ts       — Lógica de resolución de company_id y scoping
  api-auth.ts     — Autenticación y autorización de rutas API
  barbers.ts      — Lógica de negocio de barberos
  booking-availability.ts — Cálculo de disponibilidad y slots
  emails.ts       — Envío de emails con Resend
  push.ts         — Push notifications VAPID
  cash.ts         — Módulo de caja registradora
  permissions.ts  — Definición de permisos por rol
  rate-limit.ts   — Rate limiting en memoria
  validations.ts  — Schemas Zod para API routes
supabase/
  migrations/     — Scripts SQL versionados (v1→v20)
scripts/
  db-*.sql        — Scripts de mantenimiento y seeds
  normalize-orphan-barbers.mjs — Script de migración de datos
```

---

## Repositorios git

| Repositorio | Propósito |
|-------------|-----------|
| `TiagoFuhrman/plataforma-barberia` | Repositorio de producción (Vercel) |
| `danelkan/appBarberia` | Mirror para el cliente Felito Barber Studio |

Ambos remotes deben mantenerse sincronizados en cada push.
Ver `README.md` para el workflow de push.

---

## Componentes reutilizables (core)

Estos módulos son independientes del cliente y reutilizables para nuevas barberías:

- `lib/tenant.ts` — Multi-tenant scope resolution
- `lib/api-auth.ts` — Auth middleware para API routes
- `lib/booking-availability.ts` — Motor de disponibilidad
- `lib/rate-limit.ts` — Rate limiting
- `lib/validations.ts` — Schemas de validación
- `components/booking/booking-flow.tsx` — Flujo de reservas
- `supabase/migrations/` — Schema completo

## Componentes específicos del cliente (Felito Barber Studio)

- `public/felito-*.{svg,png}` — Marca visual
- `NEXT_PUBLIC_APP_NAME`, `APP_LOCATION`, `APP_SUPPORT_EMAIL` — Config en env vars
- Seeds en `scripts/db-seed-*.sql`

---

## Consideraciones de escalado

1. **SUBDOMAIN_MAP:** Reemplazar con tabla `company_domains` en Supabase cuando haya
   más de 5 clientes activos (el redeploy manual no escala).
2. **Rate limiting en memoria:** El rate limiter actual usa un Map en memoria de Node.js.
   En producción con múltiples instancias de Vercel, cada instancia tiene su propio estado.
   Para limitar correctamente entre instancias, migrar a Redis (Upstash, etc.).
3. **Registros legacy con company_id=NULL:** Ejecutar la migración v19 para eliminar
   la dependencia del modo `allowLegacyUnscoped` antes de agregar más clientes.
