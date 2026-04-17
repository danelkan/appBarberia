# Felito Barber Studio

Proyecto en Next.js para la web de Felito Barber Studio.

## Qué incluye

- Home optimizada para mostrar las dos sedes.
- Botones directos a reserva oficial de Cordón y Punta Carretas.
- Ruta de reserva interna en `/reservar`.
- Panel admin existente para agenda, barberos y servicios.
- Agenda calendario diaria/semanal con aislamiento por sede.
- Push notifications dirigidas al barbero asignado a cada reserva.
- SEO base con `robots.ts`, `sitemap.ts` y metadata.
- Estética dark premium, pero liviana.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir en el navegador:

```bash
http://localhost:3000
```

## Push notifications

Para activar push real en producción:

```bash
npx web-push generate-vapid-keys
```

Configurar `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`, y aplicar `supabase-migration-v15.sql`.

Notas de compatibilidad:
- Android Chrome y desktop Chrome/Edge funcionan desde HTTPS.
- iPhone/Safari requiere iOS 16.4+ y que el usuario instale la app en la pantalla de inicio; Safari normal no permite Web Push en pestaña.
- Si el botón muestra que falta preparar la tabla push, aplicar `supabase-migration-v15.sql`.

## Precios por sucursal

Aplicar `supabase-migration-v16.sql`. Los servicios mantienen `services.price` como precio base y los overrides viven en `service_branch_prices`. Cada turno guarda `appointments.service_price` como snapshot para que agenda, caja y comprobantes usen el precio real de la sucursal al momento de reservar.

## Deploy en Vercel

```bash
npm install -g vercel
vercel
```

## Enlaces de reserva usados en la home

- Cordón: `https://book.weibook.co/branch/felito-barber-studio-sede-1`
- Punta Carretas: `https://book.weibook.co/branch/felito-barber-studio-punta-carretas`
