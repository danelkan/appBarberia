import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCompanyScopeFilter } from '@/lib/tenant'
import type { Service } from '@/types'

export interface ServiceBranchPrice {
  branch_id: string
  price: number
}

export interface ServiceWithBranchPrices extends Service {
  base_price: number
  branch_prices?: ServiceBranchPrice[]
  effective_price?: number
}

export function applyBranchPrice<T extends { price: number; branch_prices?: ServiceBranchPrice[] }>(
  service: T,
  branchId?: string | null
): T & { base_price: number; effective_price: number } {
  const branchPrice = branchId
    ? service.branch_prices?.find(price => price.branch_id === branchId)
    : undefined
  const effectivePrice = Number(branchPrice?.price ?? service.price)

  return {
    ...service,
    base_price: Number(service.price),
    price: effectivePrice,
    effective_price: effectivePrice,
  }
}

export async function listServiceBranchPrices(
  supabase: SupabaseClient,
  serviceIds: string[],
  branchId?: string | null
) {
  if (serviceIds.length === 0) return new Map<string, ServiceBranchPrice[]>()

  let query = supabase
    .from('service_branch_prices')
    .select('service_id, branch_id, price')
    .in('service_id', serviceIds)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query
  if (error) {
    if (error.message.toLowerCase().includes('service_branch_prices')) {
      return new Map<string, ServiceBranchPrice[]>()
    }
    throw error
  }

  const map = new Map<string, ServiceBranchPrice[]>()
  ;(data ?? []).forEach((row: any) => {
    const current = map.get(row.service_id) ?? []
    current.push({
      branch_id: row.branch_id,
      price: Number(row.price),
    })
    map.set(row.service_id, current)
  })

  return map
}

export async function attachBranchPrices<T extends Service>(
  supabase: SupabaseClient,
  services: T[],
  branchId?: string | null
) {
  const branchPricesByService = await listServiceBranchPrices(
    supabase,
    services.map(service => service.id),
    branchId
  )

  return services.map(service => applyBranchPrice({
    ...service,
    branch_prices: branchPricesByService.get(service.id) ?? [],
  }, branchId))
}

export async function resolveServiceForBranch(
  supabase: SupabaseClient,
  input: {
    serviceId: string
    branchId: string
    companyId: string
    allowLegacyUnscoped?: boolean
  }
) {
  let query = supabase
    .from('services')
    .select('*')
    .eq('id', input.serviceId)

  query = query.or(buildCompanyScopeFilter('company_id', input.companyId, input.allowLegacyUnscoped))

  const { data: service, error } = await query.single()
  if (error || !service) return { service: null, error }

  const priced = await attachBranchPrices(supabase, [service as Service], input.branchId)
  return { service: priced[0], error: null }
}
