import { redirect } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import BookingFlow from '@/components/booking/booking-flow'

interface BookingPageProps {
  searchParams: {
    branch?: string
  }
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const supabase = createSupabaseAdmin()
  const branchId = searchParams.branch

  if (!branchId) {
    redirect('/')
  }

  const [{ data: branches }, { data: services }, { data: barbers }, { data: links }] = await Promise.all([
    supabase.from('branches').select('id, name, address').eq('active', true).order('name'),
    supabase.from('services').select('*').eq('active', true).order('price'),
    supabase.from('barbers').select('*').order('name'),
    supabase.from('barber_branches').select('barber_id, branch_id').eq('branch_id', branchId),
  ])

  const selectedBranch = (branches ?? []).find(branch => branch.id === branchId)

  if (!selectedBranch) {
    redirect('/')
  }

  const branchBarberIds = new Set((links ?? []).map(link => link.barber_id))
  const branchBarbers = (barbers ?? [])
    .filter(barber => branchBarberIds.has(barber.id))
    .map(barber => ({
      ...barber,
      branch_ids: [branchId],
    }))

  return (
    <BookingFlow
      branch={selectedBranch}
      services={services ?? []}
      barbers={branchBarbers}
    />
  )
}
