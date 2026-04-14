import MisTurnosClient from '@/app/mis-turnos/mis-turnos-client'

export const dynamic = 'force-dynamic'

interface MisTurnosPageProps {
  searchParams: {
    branch?: string
    company?: string
  }
}

export default function MisTurnosPage({ searchParams }: MisTurnosPageProps) {
  return (
    <MisTurnosClient
      branchId={searchParams.branch ?? null}
      company={searchParams.company ?? null}
    />
  )
}
