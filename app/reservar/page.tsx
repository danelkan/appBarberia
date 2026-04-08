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

  const [
    { data: branches },
    { data: services },
    { data: barbers },
    { data: links },
    { data: userRoles },
    { data: authUsersData },
  ] = await Promise.all([
    supabase.from('branches').select('id, name, address').eq('active', true).order('name'),
    supabase.from('services').select('*').eq('active', true).order('price'),
    supabase.from('barbers').select('*').order('name'),
    supabase.from('barber_branches').select('barber_id, branch_id').eq('branch_id', branchId),
    supabase.from('user_roles').select('user_id, barber_id, active').not('barber_id', 'is', null),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const selectedBranch = (branches ?? []).find(branch => branch.id === branchId)

  if (!selectedBranch) {
    redirect('/')
  }

  const validAuthIds = new Set((authUsersData?.users ?? []).map((u: any) => u.id))
  const validBarberIds = new Set(
    (userRoles ?? [])
      .filter((r: any) => r.active !== false && r.barber_id && validAuthIds.has(r.user_id))
      .map((r: any) => r.barber_id as string)
  )

  const branchBarberIds = new Set((links ?? []).map(link => link.barber_id))
  const branchBarbers = (barbers ?? [])
    .filter(barber => branchBarberIds.has(barber.id) && validBarberIds.has(barber.id))
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
