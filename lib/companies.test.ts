import { describe, expect, it } from 'vitest'
import { getCompanyPlanDefaults, normalizeOptionalText, normalizePositiveInt, slugifyCompanyName } from '@/lib/companies'

describe('company helpers', () => {
  it('slugifies company names predictably', () => {
    expect(slugifyCompanyName('Felito Barber Studio')).toBe('felito-barber-studio')
    expect(slugifyCompanyName(' Barbería Ñandú ')).toBe('barberia-nandu')
  })

  it('normalizes optional text fields', () => {
    expect(normalizeOptionalText('  hola  ')).toBe('hola')
    expect(normalizeOptionalText('   ')).toBeNull()
    expect(normalizeOptionalText(undefined)).toBeNull()
  })

  it('normalizes positive integers with fallback', () => {
    expect(normalizePositiveInt('5', 1)).toBe(5)
    expect(normalizePositiveInt(0, 3)).toBe(3)
    expect(normalizePositiveInt('abc', 2)).toBe(2)
  })

  it('returns plan defaults for known and unknown tiers', () => {
    expect(getCompanyPlanDefaults('starter')).toEqual({ max_branches: 1, max_barbers: 3 })
    expect(getCompanyPlanDefaults('enterprise')).toEqual({ max_branches: 99, max_barbers: 99 })
    expect(getCompanyPlanDefaults('unknown')).toEqual({ max_branches: 1, max_barbers: 3 })
  })
})
