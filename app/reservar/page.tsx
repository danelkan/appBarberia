import { redirect } from 'next/navigation'
import { listVisibleBarbers } from '@/lib/barbers'
import { createSupabaseAdmin, formatSupabaseError } from '@/lib/supabase'
import BookingFlow from '@/components/booking/booking-flow'

interface BookingPageProps {
  searchParams: {
    branch?: string
  }
}

export const dynamic = 'force-dynamic'

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const supabase = createSupabaseAdmin()
  const branchId = searchParams.branch

  if (!branchId) {
    redirect('/')
  }

  let branches
  let services
  let branchBarbers

  try {
    const results = await Promise.all([
      supabase.from('branches').select('id, name, address').eq('active', true).order('name'),
      supabase.from('services').select('*').eq('active', true).order('price'),
      listVisibleBarbers(supabase, { branchId }),
    ])

    ;[
      { data: branches },
      { data: services },
      { barbers: branchBarbers },
    ] = results
  } catch (error) {
    console.error('[booking] Failed to load booking data from Supabase:', formatSupabaseError(error))
    throw new Error('Unable to load booking data from Supabase')
  }

  const selectedBranch = (branches ?? []).find(branch => branch.id === branchId)

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
      branch={selectedBranch}
      services={services ?? []}
      barbers={barbersForBranch}
    />
  )
}
