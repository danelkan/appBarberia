# Agency Hub — Spec

## Objetivo

Cuando el superadmin entra al panel, ve su hub de agencia (lista de clientes) en vez del dashboard de un cliente específico. Puede entrar al panel de cualquier cliente desde ahí.

## Cambios

### 1. Redirección automática del superadmin

En `app/admin/layout.tsx`, después del bootstrap, si el usuario es `superadmin` y el pathname es `/admin` o `/admin/dashboard`, redirigir a `/admin/empresas`.

**Comportamiento:**
- Superadmin entra → va a `/admin/empresas`
- Admin de Felito entra → va a `/admin/dashboard` (sin cambios)
- Barbero entra → va a `/admin/dashboard` (sin cambios)

### 2. Botón "Entrar al panel" en cada card de empresa

En `app/admin/empresas/page.tsx`, agregar un botón por empresa que navega a `/admin/agenda?company={slug}` en la misma tab.

El botón solo aparece para superadmin (ya tienen el chequeo `isSuperadmin`).

### 3. Scoping de branches por company en el layout

En `app/admin/layout.tsx`, cuando el superadmin tiene el param `?company=slug` en la URL:
- Filtrar `branches` para mostrar solo las de esa empresa
- Mostrar un botón "← Mis clientes" en el sidebar que navega a `/admin/empresas`

El param `company` se lee de la URL con `useSearchParams()`.

**Comportamiento:**
- Sin `?company=`: superadmin ve "Todas las sucursales" → su hub
- Con `?company=felitobarber`: superadmin ve solo sucursales de Felito + botón de volver

## Lo que NO cambia

- El diseño del panel admin de cada cliente: exactamente igual
- El flujo de login/logout
- Los permisos y roles
- La página `/admin/empresas` existente (solo se agrega el botón)

## Archivos a modificar

1. `app/admin/layout.tsx` — redirección + scoping por company param + botón volver
2. `app/admin/empresas/page.tsx` — agregar botón "Entrar al panel"
