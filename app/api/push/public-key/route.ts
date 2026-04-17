import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = getVapidPublicKey()
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? null
  const isPlaceholder = Boolean(publicKey?.startsWith('BNxxxx') || privateKey?.startsWith('xxxxxxxx'))

  if (!publicKey || !privateKey || isPlaceholder) {
    return NextResponse.json({
      enabled: false,
      publicKey: null,
      reason: 'missing_vapid_public_key',
      message: 'Falta configurar VAPID_PUBLIC_KEY/NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en producción',
      checks: {
        publicKey: Boolean(publicKey && !publicKey.startsWith('BNxxxx')),
        privateKey: Boolean(privateKey && !privateKey.startsWith('xxxxxxxx')),
      },
    })
  }

  return NextResponse.json({
    enabled: true,
    publicKey,
    reason: null,
    checks: { publicKey: true, privateKey: true },
  })
}
