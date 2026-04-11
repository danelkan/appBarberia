import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split(/\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, '')]
      })
  )
}

const env = loadEnvFile('.env.local')
const apply = process.argv.includes('--apply')

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const [
  { data: barbers, error: barbersError },
  { data: roleRows, error: rolesError },
  { data: branchLinks, error: branchLinksError },
  { data: authUsersData, error: authUsersError },
] = await Promise.all([
  supabase.from('barbers').select('id, name, email').order('created_at'),
  supabase.from('user_roles').select('user_id, barber_id, active').not('barber_id', 'is', null),
  supabase.from('barber_branches').select('barber_id, branch_id'),
  supabase.auth.admin.listUsers({ perPage: 1000 }),
])

if (barbersError) throw barbersError
if (rolesError) throw rolesError
if (branchLinksError) throw branchLinksError
if (authUsersError) throw authUsersError

const authUserIds = new Set((authUsersData?.users ?? []).map(user => user.id))
const roleByBarberId = new Map((roleRows ?? []).filter(row => row.barber_id).map(row => [row.barber_id, row]))
const branchIdsByBarberId = new Map()

for (const link of branchLinks ?? []) {
  if (!link.barber_id || !link.branch_id) continue
  const branchIds = branchIdsByBarberId.get(link.barber_id) ?? []
  branchIds.push(link.branch_id)
  branchIdsByBarberId.set(link.barber_id, branchIds)
}

const orphanBarbers = (barbers ?? [])
  .map(barber => {
    const roleRow = roleByBarberId.get(barber.id) ?? null
    const branchIds = branchIdsByBarberId.get(barber.id) ?? []
    const hasValidLinkedUser =
      Boolean(roleRow?.user_id) &&
      authUserIds.has(roleRow.user_id) &&
      roleRow.active !== false

    return {
      ...barber,
      roleRow,
      branchIds,
      isVisibleOrphan: branchIds.length > 0 && !hasValidLinkedUser,
    }
  })
  .filter(barber => barber.isVisibleOrphan)

if (orphanBarbers.length === 0) {
  console.log('No orphan barbers with agenda visibility were found.')
  process.exit(0)
}

console.log('Found orphan barbers with visible barber_branches:')
for (const barber of orphanBarbers) {
  console.log(`- ${barber.name} <${barber.email}> barber_id=${barber.id} branches=${barber.branchIds.join(',')}`)
}

if (!apply) {
  console.log('\nDry run only. Re-run with --apply to delete their barber_branches rows.')
  process.exit(0)
}

const orphanBarberIds = orphanBarbers.map(barber => barber.id)
const { error: deleteError } = await supabase
  .from('barber_branches')
  .delete()
  .in('barber_id', orphanBarberIds)

if (deleteError) throw deleteError

console.log(`Deleted barber_branches for ${orphanBarberIds.length} orphan barber(s).`)
