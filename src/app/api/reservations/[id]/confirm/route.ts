import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import redis from '@/lib/redis'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const idempotencyKey = req.headers.get('Idempotency-Key')
    if (idempotencyKey) {
      const cachedResponse = await redis.get(`idempotency:confirm:${idempotencyKey}`)
      if (cachedResponse) {
        return NextResponse.json(JSON.parse(cachedResponse))
      }
    }

    try {
      const confirmedReservation = await prisma.$transaction(async (tx) => {

        const reservations = await tx.$queryRaw<any[]>`
          SELECT * FROM "Reservation" 
          WHERE id = ${id} 
          FOR UPDATE;
        `

        if (!reservations || reservations.length === 0) {
          throw new Error('NOT_FOUND')
        }

        const reservation = reservations[0]

        if (reservation.status === 'CONFIRMED') {
          return reservation
        }

        if (reservation.status === 'RELEASED' || new Date(reservation.expiresAt) < new Date()) {
          throw new Error('EXPIRED')
        }

        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: 'CONFIRMED' }
        })

        await tx.$executeRaw`
          UPDATE "Inventory"
          SET "totalStock" = "totalStock" - ${reservation.quantity},
              "reservedStock" = "reservedStock" - ${reservation.quantity}
          WHERE id = ${reservation.inventoryId}
        `

        return updatedReservation
      })

      const responsePayload = { success: true, reservation: confirmedReservation }

      if (idempotencyKey) {
        await redis.set(`idempotency:confirm:${idempotencyKey}`, JSON.stringify(responsePayload), 'EX', 60 * 60 * 24)
      }

      return NextResponse.json(responsePayload)
    } catch (e: any) {
      if (e.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }
      if (e.message === 'EXPIRED') {
        const errPayload = { error: 'Reservation has expired' }
        if (idempotencyKey) {
          await redis.set(`idempotency:confirm:${idempotencyKey}`, JSON.stringify(errPayload), 'EX', 60 * 60 * 24)
        }
        return NextResponse.json(errPayload, { status: 410 })
      }
      throw e
    }
  } catch (error) {
    console.error('Confirm error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
