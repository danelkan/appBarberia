import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function legacyRouteResponse() {
  return NextResponse.json(
    { error: 'La gestión de barberos se centralizó en /api/users' },
    { status: 410 }
  )
}

export async function PUT() {
  return legacyRouteResponse()
}

export async function DELETE() {
  return legacyRouteResponse()
}
