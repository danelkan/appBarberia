import { redirect } from 'next/navigation'

/**
 * /staff — entry point for barbershop staff.
 * Authenticated → forwarded to admin panel.
 * Unauthenticated → middleware redirects to /login.
 */
export default function StaffPage() {
  redirect('/admin/agenda')
}
