const PLAN_DEFAULTS: Record<string, { max_branches: number; max_barbers: number }> = {
  starter: { max_branches: 1, max_barbers: 3 },
  pro: { max_branches: 3, max_barbers: 10 },
  enterprise: { max_branches: 99, max_barbers: 99 },
}

export const COMPANY_PLAN_TIERS = Object.keys(PLAN_DEFAULTS)

export function slugifyCompanyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function normalizeOptionalBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.trunc(parsed)
  return normalized > 0 ? normalized : fallback
}

export function getCompanyPlanDefaults(planTier: string | null | undefined) {
  return PLAN_DEFAULTS[planTier ?? 'starter'] ?? PLAN_DEFAULTS.starter
}
