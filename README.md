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

## Deploy en Vercel

```bash
npm install -g vercel
vercel
```

## Enlaces de reserva usados en la home

- Cordón: `https://book.weibook.co/branch/felito-barber-studio-sede-1`
- Punta Carretas: `https://book.weibook.co/branch/felito-barber-studio-punta-carretas`
