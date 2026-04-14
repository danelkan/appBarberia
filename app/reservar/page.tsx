import { unstable_noStore as noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { listVisibleBarbers } from '@/lib/barbers'
import { createSupabaseAdmin, formatSupabaseError } from '@/lib/supabase'
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

  try {
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, address, company_id')
      .eq('id', branchId)
      .eq('active', true)
      .maybeSingle()

    if (!branch?.company_id) {
      redirect('/')
    }

    if (companyParam) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, slug')
        .or(`id.eq.${companyParam},slug.eq.${companyParam}`)
        .maybeSingle()

      if (!company || company.id !== branch.company_id) {
        redirect('/')
      }
    }

    selectedBranch = branch

    const results = await Promise.all([
      supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .eq('company_id', branch.company_id)
        .order('price'),
      listVisibleBarbers(supabase, { branchId, companyId: branch.company_id }),
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
    />
  )
}
