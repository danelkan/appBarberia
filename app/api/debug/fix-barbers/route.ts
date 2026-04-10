import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// One-time migration endpoint — DELETE after running
export async function POST() {
  const supabase = createSupabaseAdmin()

  const kikeId   = '50688a7c-018d-4cec-81ac-12352dd489e1'
  const felitoId = '24c3ef14-a48c-4f13-9406-12a1a77a8b66'
  const duplicateFelitoId = '32adaf31-b3f2-4de0-bbd8-a7f94507ef37'
  const cordonId        = '11111111-1111-1111-1111-111111111111'
  const puntaCarretasId = '22222222-2222-2222-2222-222222222222'

  const rows = [
    { barber_id: kikeId,   branch_id: cordonId        },
    { barber_id: kikeId,   branch_id: puntaCarretasId },
    { barber_id: felitoId, branch_id: cordonId        },
    { barber_id: felitoId, branch_id: puntaCarretasId },
  ]

  const insertResults = await Promise.all(
    rows.map(row =>
      supabase.from('barber_branches').insert(row).select()
    )
  )

  const insertErrors = insertResults
    .map((r, i) => r.error ? { row: rows[i], error: r.error.message } : null)
    .filter(Boolean)

  const { error: deleteError, data: deleteData } = await supabase
    .from('barbers')
    .delete()
    .eq('id', duplicateFelitoId)
    .select()

  return NextResponse.json({
    insert_errors: insertErrors,
    insert_ok: insertResults.filter(r => !r.error).length,
    delete_error: deleteError?.message ?? null,
    deleted_rows: deleteData,
  })
}
