import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { listVisibleBarbers } from '@/lib/barbers'
import { createSupabaseAdmin, formatSupabaseError } from '@/lib/supabase'
import { buildCompanyScopeFilter, resolveBranchCompanyScope, resolveCompanyRecordByIdentifier } from '@/lib/tenant'
import { attachBranchPrices } from '@/lib/service-pricing'
import BookingFlow from '@/components/booking/booking-flow'

interface BookingPageProps {
  searchParams: {
    branch?: string
    company?: string
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BookingPage({ searchParams }: BookingPageProps) {
  noStore()

  const supabase = createSupabaseAdmin()
  const branchId = searchParams.branch
  const companyParam = searchParams.company?.trim()

  if (!branchId) {
    redirect('/')
  }

  let selectedBranch
  let services
  let branchBarbers
  let publicCompanyKey: string | null = null
  let companyScope = { companyId: null as string | null, allowLegacyUnscoped: false }

  try {
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, address, company_id')
      .eq('id', branchId)
      .eq('active', true)
      .maybeSingle()

    if (!branch) {
      redirect('/')
    }

    companyScope = await resolveBranchCompanyScope(supabase, branch.id)
    const effectiveCompanyId = branch.company_id ?? companyScope.companyId

    if (!effectiveCompanyId) {
      redirect('/')
    }

    if (companyParam) {
      const company = await resolveCompanyRecordByIdentifier(supabase, companyParam)

      if (!company || company.id !== effectiveCompanyId) {
        redirect('/')
      }

      publicCompanyKey = company.slug ?? company.id
    } else {
      const { data: company } = await supabase
        .from('companies')
        .select('id, slug')
        .eq('id', effectiveCompanyId)
        .maybeSingle()

      publicCompanyKey = company?.slug ?? company?.id ?? effectiveCompanyId
    }

    selectedBranch = branch

    const results = await Promise.all([
      (async () => {
        let query = supabase
          .from('services')
          .select('*')
          .eq('active', true)
          .order('price')

        query = query.or(buildCompanyScopeFilter('company_id', effectiveCompanyId, companyScope.allowLegacyUnscoped))
        const result = await query
        if (result.error) return result
        const pricedServices = await attachBranchPrices(supabase, result.data ?? [], branchId)
        return { data: pricedServices, error: null }
      })(),
      listVisibleBarbers(supabase, {
        branchId,
        companyId: effectiveCompanyId,
        allowLegacyUnscoped: companyScope.allowLegacyUnscoped,
      }),
    ])

    ;[
      { data: services },
      { barbers: branchBarbers },
    ] = results
  } catch (error) {
    console.error('[booking] Failed to load booking data from Supabase:', formatSupabaseError(error))
    throw new Error('Unable to load booking data from Supabase')
  }

  if (!selectedBranch) {
    redirect('/')
  }

  const barbersForBranch = (branchBarbers ?? [])
    .map(barber => ({
      ...barber,
      branch_ids: [branchId],
    }))

  return (
    <BookingFlow
      key={selectedBranch.id}
      branch={selectedBranch}
      services={services ?? []}
      barbers={barbersForBranch}
      publicCompanyKey={publicCompanyKey}
    />
  )
}
