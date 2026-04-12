# Setup Guide — Barbershop Platform

This guide explains how to deploy and configure a new barbershop instance.

## Requirements

- Node.js 18+
- A Supabase project (free tier is enough to start)
- A Resend account for email (free tier: 100 emails/day)
- Vercel or similar for hosting

---

## 1. Clone and install

```bash
git clone <repo-url>
cd appBarberia-v2
npm install
```

## 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run migrations in order:
   - `supabase-schema.sql`
   - `supabase-migration-v2.sql`
   - `supabase-migration-v3.sql`
   - `supabase-migration-v4.sql`
   - `supabase-migration-v5.sql`
   - `supabase-migration-v6.sql`
   - `supabase-migration-v7.sql`
   - `supabase-migration-v8.sql`
   - `supabase-migration-v9.sql`
   - `supabase-migration-v10.sql`
   - `supabase-migration-v11.sql`
   - `supabase-migration-v12.sql`
3. In **Authentication > Providers**, enable Email provider

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials and app config.

Key variables:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Settings > API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Settings > API
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Settings > API (keep secret)
- `SUPERADMIN_UUID` — your Supabase auth user UUID (see step 5)
- `NEXT_PUBLIC_APP_NAME` — the barbershop name

## 4. Seed the first barbershop

Edit `scripts/db-seed-new-barbershop.sql`, replace all `{{PLACEHOLDERS}}`, then run it in the Supabase SQL Editor.

## 5. Create the admin user

1. Go to **Supabase Dashboard > Authentication > Users > Add user**
2. Create a user with your email and a strong password
3. Copy the generated UUID
4. Set `SUPERADMIN_UUID=<uuid>` in `.env.local`
5. You can also link the user to a company:
   ```sql
   INSERT INTO user_roles (user_id, company_id, role, active)
   VALUES ('<UUID>', '<COMPANY_UUID>', 'admin', true);
   ```

## 6. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000/login](http://localhost:3000/login)

## 7. Deploy to production

```bash
# Vercel (recommended)
vercel --prod
```

Set environment variables in the Vercel dashboard.

---

## Delivering to a client

1. **Clean the database**: Run `scripts/db-clean-for-delivery.sql` in the SQL Editor
   - This removes all clients, appointments, caja data and demo data
   - Keeps: company structure, branches, services, users
2. **Create the client's admin user** in Supabase Auth
3. **Link them to the company** via user_roles
4. **Update env vars** with their domain and branding
5. **Deploy** to their hosting environment

## Creating a new barbershop instance

Option A — **Shared database** (multi-tenant, recommended):
1. Run `scripts/db-seed-new-barbershop.sql` with the new barbershop's data
2. Create their admin user in the same Supabase project
3. Deploy the same app with their domain and `NEXT_PUBLIC_APP_NAME`

Option B — **Separate Supabase project** (full isolation):
1. Create a new Supabase project
2. Run all migrations
3. Run the seed script
4. Deploy the app pointed at the new project

---

## Architecture overview

```
Platform (you)
└── Supabase project
    ├── companies            ← one per barbershop
    │   ├── branches         ← locations
    │   ├── services         ← priced services
    │   ├── barbers          ← linked to auth users
    │   └── user_roles       ← admin/barber access
    ├── clients              ← end customers
    ├── appointments         ← bookings
    └── cash_registers       ← caja
```

### Your platform access

Your `SUPERADMIN_UUID` always gives you full access regardless of any company settings. Clients cannot remove your access.

From `/admin/empresas` you can:
- See all companies on the platform
- Manage plan tiers and limits
- Create/deactivate companies
- Access any company's data

---

## Environment variables reference

See `.env.example` for full documentation.
