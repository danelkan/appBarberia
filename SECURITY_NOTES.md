# Notas de Seguridad — Plataforma Barbería

**IMPORTANTE:** Este archivo documenta incidentes y riesgos de seguridad conocidos.
No incluir valores reales de claves en este archivo.

---

## Incidente: Exposición de credenciales en repositorio público (Abril 2026)

### Qué ocurrió

Las claves de Supabase (anon key y service role key) estuvieron expuestas en el historial
del repositorio público `danelkan/appBarberia` en GitHub. El archivo `.env.production`
fue commiteado sin estar protegido por el `.gitignore` en algún momento del historial.

### Claves comprometidas y rotación

| Clave | Estado | Rotada |
|-------|--------|--------|
| NEXT_PUBLIC_SUPABASE_ANON_KEY (JWT legacy) | Desactivada | 19-20 Abril 2026 |
| SUPABASE_SERVICE_ROLE_KEY (JWT legacy) | Desactivada | 19-20 Abril 2026 |
| RESEND_API_KEY | Rotar si estuvo expuesta | Verificar |
| VAPID_PRIVATE_KEY | Rotar si estuvo expuesta | Verificar |

Supabase generó nuevas claves con el formato `publishable/secret` (nuevo estilo).
Las claves JWT legacy están desactivadas pero aún pueden aparecer en respuestas de la API
de Supabase — no confundir su presencia en el dashboard con que estén activas.

### Acciones tomadas

- Se actualizó `.gitignore` para excluir `.env.*` (excepto `.env.example`)
- Se verificó que `.env.production` NO está en el índice de git
- El repositorio `danelkan/appBarberia` fue limpiado o marcado como privado
- Las variables de entorno en Vercel fueron actualizadas con las nuevas claves

### Verificación

Para confirmar que no hay secretos en el historial de git:
```bash
git log --all --full-history -- .env.production
git log --all --full-history -- .env.local
```

---

## Riesgos conocidos

### 1. SUBDOMAIN_MAP hardcodeado en middleware.ts

El mapeo subdominio → tenant está hardcodeado en `middleware.ts`. Si se agrega un nuevo
cliente sin actualizar este archivo y hacer redeploy, el cliente no recibirá su slug
correctamente en el flujo de reservas públicas.

**Mitigación actual:** El archivo tiene un TODO explícito.
**Solución a futuro:** Tabla `company_domains` en Supabase con consulta en tiempo de ejecución.

### 2. allowLegacyUnscoped en lib/tenant.ts

Registros con `company_id = NULL` en la base de datos son incluidos en consultas públicas
cuando solo hay un cliente activo en la plataforma. Esto es compatible hacia atrás pero
introduce riesgo si la limpieza de datos no se completa.

**Mitigación actual:** La condición solo se activa con exactamente 1 empresa activa.
**Solución:** Ejecutar `supabase/migrations/00019_v19.sql` o `scripts/db-clean-for-delivery.sql`
para backfillear `company_id` en todos los registros NULL y luego desactivar el modo legacy.

### 3. SUPERADMIN_UUID como bypass de roles

El usuario con UUID igual a `SUPERADMIN_UUID` tiene acceso total a la plataforma
independientemente de la tabla `user_roles`. Si esta variable de entorno se filtra,
el atacante necesitaría también comprometer la contraseña de ese usuario en Supabase Auth,
pero el UUID no debe exponerse públicamente.

### 4. Service Role Key — acceso irrestricto a la base de datos

La `SUPABASE_SERVICE_ROLE_KEY` omite todas las políticas RLS de Supabase. Solo se usa
en rutas server-side (`lib/supabase.ts → createSupabaseAdmin()`). NUNCA debe usarse en
código cliente ni en componentes que corran en el browser.

---

## Checklist post-incidente

- [ ] Confirmar que las nuevas claves están configuradas en Vercel (ambos proyectos)
- [ ] Confirmar que `.env.production` no tiene commits recientes con `git log --all -- .env.production`
- [ ] Rotar RESEND_API_KEY si estuvo expuesta (verificar en resend.com/api-keys)
- [ ] Rotar VAPID_PRIVATE_KEY si estuvo expuesta (regenerar con `npx web-push generate-vapid-keys`)
- [ ] Ejecutar migración v19 para limpiar registros con company_id=NULL
- [ ] Verificar que el repo danelkan/appBarberia es privado o tiene el historial limpiado

---

## Contacto de seguridad

Para reportar vulnerabilidades: tiagofuhrmannn@gmail.com
