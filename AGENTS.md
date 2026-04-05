# AGENTS.md

This document provides guidelines for AI agents working in the Felito Barber Studio codebase.

## Project Overview

Next.js 14.2.5 App Router application for a barber shop booking system with:
- **Frontend**: React 18, Tailwind CSS, Lucide icons
- **Backend**: Supabase (auth, PostgreSQL database)
- **Email**: Resend for transactional emails
- **Styling**: Dark premium aesthetic (black/gold/cream palette)

## Build & Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Linting (ESLint not yet configured - run next lint to setup)
npm run lint
```

### Running Single Tests

No test framework is currently configured. To add testing:
1. Install vitest or jest with React Testing Library
2. Create test files as `*.test.ts` or `*.spec.ts`
3. Run: `npx vitest run path/to/file.test.ts`

## Code Style Guidelines

### Imports

```typescript
// 1. External packages
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

// 2. Internal imports using @/ alias
import { Button, Spinner } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import type { Appointment, Barber } from '@/types'
```

### TypeScript

- **Strict mode enabled** in tsconfig.json
- Always define interfaces/types for props and data structures
- Use `type` imports for type-only imports: `import type { ... }`
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use path alias `@/*` for all internal imports (maps to project root)

### Component Patterns

```typescript
// Server component (default)
export default function PageName() {
  return <div>...</div>
}

// Client component - add directive at top
'use client'
export function InteractiveComponent() {
  const [state, setState] = useState()
  // ...
}
```

### Styling

- Use Tailwind utility classes exclusively
- Custom CSS classes defined in `app/globals.css` (`@layer components`)
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Color palette:
  - `black` (#0f0f0f), `cream` (#fafaf8), `gold` (#c9a84c)
  - `surface`, `surface-2`, `surface-3` for dark layers
  - `border` (#2e2e2e) for borders
- Fonts: `font-sans` (DM Sans), `font-serif` (DM Serif Display)

### UI Components

Available in `components/ui/index.tsx`:
- `Button` - variants: gold, outline, ghost, danger; sizes: sm, md, lg
- `Badge` - for status indicators
- `Input` - with label and error support
- `Spinner` - loading indicator
- `Modal` - dialog with title and close
- `EmptyState` - placeholder for empty lists

### API Routes

Located in `app/api/[resource]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  // Handle GET request
}

export async function POST(req: NextRequest) {
  // Handle POST request
}
```

- Use `createSupabaseAdmin()` for admin operations (bypasses RLS)
- Return `NextResponse.json({ data })` for success
- Return `NextResponse.json({ error: 'message' }, { status: 400 })` for errors
- Query params: `new URL(req.url).searchParams`

### Database & Types

- Types defined in `types/index.ts`
- Supabase client variants:
  - `createSupabaseBrowserClient()` - client-side, uses anon key
  - `createSupabaseServerClient()` - server components (server-only)
  - `createSupabaseAdmin()` - API routes, bypasses RLS

### Error Handling

- API routes: return appropriate HTTP status codes (400, 404, 500)
- Client-side: catch fetch errors, display via state
- Form validation: check required fields before submission
- Use `console.error()` for logging (avoid in production UI)

### Naming Conventions

- **Files**: lowercase, kebab-case for multi-word (`appointment-card.tsx`)
- **Components**: PascalCase (`AppointmentCard`)
- **Functions**: camelCase (`formatDate`, `generateTimeSlots`)
- **Constants**: UPPER_SNAKE_CASE for config objects (`STATUS_CONFIG`)
- **Types/Interfaces**: PascalCase (`Appointment`, `BookingStep`)

### Form Handling

- Use controlled components with `useState`
- Validate with manual checks or Zod schemas
- Show inline errors below inputs
- Use `loading` state for async submissions
- Pattern from `app/reservar/page.tsx` and `app/login/page.tsx`

### Dates & Formatting

- Use `date-fns` with Spanish locale (`import { es } from 'date-fns/locale'`)
- Utility functions in `lib/utils.ts`: `formatDate`, `formatPrice`, `generateTimeSlots`
- Database dates: `YYYY-MM-DD` format, times: `HH:mm`

## Environment Variables

Required (see `.env.local.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_EMAIL`

## Key Files Reference

- `lib/utils.ts` - Shared utilities (cn, date formatting, time slot generation)
- `lib/supabase.ts` - Supabase client factories
- `lib/emails.ts` - Email templates and sending
- `types/index.ts` - All TypeScript interfaces
- `components/ui/index.tsx` - Reusable UI components
- `app/globals.css` - Tailwind config and custom classes
- `middleware.ts` - Auth guard for `/admin/*` routes

## Common Patterns

### Creating a new page
1. Create `app/[route]/page.tsx`
2. Import needed UI components from `@/components/ui`
3. Use existing utilities from `@/lib/utils`
4. For client interactions, add `'use client'` directive

### Creating an API endpoint
1. Create `app/api/[resource]/route.ts`
2. Import `createSupabaseAdmin` from `@/lib/supabase`
3. Implement GET/POST/PATCH/DELETE handlers
4. Return proper JSON responses with error handling

### Adding a new form
1. Use controlled state for form fields
2. Validate required fields before submission
3. Show loading state during async operations
4. Display errors inline or as toast
5. Reset/redirect on success

## Notes

- No ESLint configured - run `next lint` to set up
- No test framework - needs setup for vitest/jest
- Email sending is non-blocking (fire-and-forget with `.catch(console.error)`)
- Admin routes protected by middleware (redirects to `/login` if no session)
- Booking flow: Service → Barber → DateTime → Client data → Confirmation
