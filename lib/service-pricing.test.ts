import { describe, expect, it } from 'vitest'
import { applyBranchPrice } from '@/lib/service-pricing'

describe('branch service pricing', () => {
  it('uses a branch override when one exists', () => {
    const service = applyBranchPrice({
      id: 's1',
      name: 'Corte',
      price: 500,
      duration_minutes: 30,
      active: true,
      created_at: '2026-01-01',
      branch_prices: [{ branch_id: 'punta', price: 650 }],
    }, 'punta')

    expect(service.price).toBe(650)
    expect(service.base_price).toBe(500)
    expect(service.effective_price).toBe(650)
  })

  it('falls back to the base price when a branch has no override', () => {
    const service = applyBranchPrice({
      id: 's1',
      name: 'Corte',
      price: 500,
      duration_minutes: 30,
      active: true,
      created_at: '2026-01-01',
      branch_prices: [{ branch_id: 'cordon', price: 550 }],
    }, 'punta')

    expect(service.price).toBe(500)
    expect(service.base_price).toBe(500)
    expect(service.effective_price).toBe(500)
  })
})
