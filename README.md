# Plataforma Barbería — Agencia IA

SaaS multi-tenant para barberías construido con Next.js 14 y Supabase.
Desarrollado por [Agencia IA](https://iadai.tech).

**Cliente activo:** Felito Barber Studio (felitobarber.iadai.tech)

---

## Qué es este proyecto

Panel de administración y sistema de reservas online para barberías. Soporta múltiples
clientes (barberías) desde una sola instancia de la aplicación, con aislamiento de datos
por `company_id` en Supabase.

Funcionalidades principales:
- Reservas online por subdominio personalizado
- Panel de administración para dueños y barberos
- Gestión de agenda, clientes, servicios y caja
- Notificaciones push para barberos (Web Push / VAPID)
- Emails de confirmación de turno (Resend)
- Roles: superadmin (agencia), admin (barbería), barber

---

## Setup local

### Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Resend](https://resend.com) (opcional para emails)

### Pasos

```bash
# 1. Clonar
git clone https://github.com/TiagoFuhrman/plataforma-barberia.git
cd plataforma-barberia

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores reales

# 4. Aplicar el schema de Supabase
# Ir al SQL editor de Supabase y ejecutar en orden:
# supabase/migrations/00001_initial_schema.sql
# supabase/migrations/00002_v2.sql
# ... hasta 00020_barbers_fix.sql
# Ver supabase/README-db.md para más detalles

# 5. Levantar el servidor de desarrollo
npm run dev
```

La app estará disponible en http://localhost:3000.

---

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar los valores.
Ver el archivo `.env.example` para descripciones detalladas de cada variable.

Variables requeridas:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_APP_NAME
SUPERADMIN_UUID
```

Variables opcionales (funciones degradan si no están):
```
RESEND_API_KEY             # emails desactivados si falta
RESEND_FROM_EMAIL
NEXT_PUBLIC_VAPID_PUBLIC_KEY   # push notifications desactivadas si falta
VAPID_PRIVATE_KEY
VAPID_SUBJECT
APP_LOCATION
APP_SUPPORT_EMAIL
APP_TIMEZONE               # default: America/Montevideo
ADMIN_EMAIL                # acceso admin de respaldo
```

**NUNCA commitear `.env.local`, `.env.production` ni ningún archivo con secretos reales.**

---

## Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo (localhost:3000)
npm run build    # Build de producción
npm run start    # Servidor de producción (requiere build previo)
npm run lint     # ESLint
npm test         # Tests con Vitest
```

---

## Deploy en Vercel

### Repositorios git

Este proyecto tiene dos remotes que deben mantenerse sincronizados:

| Remote | Repositorio | Propósito |
|--------|-------------|-----------|
| `vercel` | TiagoFuhrman/plataforma-barberia | **Producción** — conectado a Vercel |
| `origin` | danelkan/appBarberia | Mirror para el cliente felitobarber |

Para pushear a ambos:
```bash
git push vercel main && git push origin main
```

### Variables de entorno en Vercel

Configurar todas las variables de `.env.example` en el dashboard de Vercel:
Settings → Environment Variables

### Agregar un nuevo cliente (barbería)

1. Crear la empresa en el panel superadmin (`/admin/empresas`)
2. Agregar el subdominio al `SUBDOMAIN_MAP` en `middleware.ts`
3. Configurar el dominio/subdominio en Vercel
4. Pushear a ambos remotes y esperar el redeploy

---

## Push notifications

Para activar push en producción:

```bash
npx web-push generate-vapid-keys
```

Configurar `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`.
Aplicar `supabase/migrations/00015_v15.sql` si no está aplicado.

Compatibilidad:
- Android Chrome y desktop Chrome/Edge: funcionan desde HTTPS
- iPhone/Safari: requiere iOS 16.4+ y app instalada en pantalla de inicio

---

## Advertencias de seguridad

- **NUNCA commitear `.env.production` ni `.env.local`** — ver `SECURITY_NOTES.md`
- Las claves `service_role` de Supabase dan acceso irrestricto a la BD — solo server-side
- El `SUPERADMIN_UUID` es un bypass de seguridad — mantener secreto
- Ver `SECURITY_NOTES.md` para historial del incidente de exposición de claves (Abril 2026)

---

## Documentación adicional

- `ARCHITECTURE_NOTES.md` — Arquitectura multi-tenant, roles, routing de subdominios
- `SECURITY_NOTES.md` — Incidentes de seguridad y riesgos conocidos
- `supabase/README-db.md` — Schema de base de datos y migraciones
- `SETUP.md` — Guía de setup inicial del primer cliente
- `DNS-RESEND-SETUP.md` — Configuración DNS para emails con Resend
