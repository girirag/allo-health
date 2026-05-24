import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(req: Request) {

  try {
    const releasedCount = await prisma.$transaction(async (tx) => {

      const expiredReservations = await tx.$queryRaw<any[]>`
        SELECT id, "inventoryId", quantity 
        FROM "Reservation" 
        WHERE status = 'PENDING' 
          AND "expiresAt" < NOW() 
        FOR UPDATE SKIP LOCKED;
      `

      if (!expiredReservations || expiredReservations.length === 0) {
        return 0
      }

      const reservationIds = expiredReservations.map(r => r.id)

      await tx.reservation.updateMany({
        where: { id: { in: reservationIds } },
        data: { status: 'RELEASED' }
      })

      for (const res of expiredReservations) {
        await tx.$executeRaw`
          UPDATE "Inventory"
          SET "reservedStock" = "reservedStock" - ${res.quantity}
          WHERE id = ${res.inventoryId}
        `
      }

      return expiredReservations.length
    })

    return NextResponse.json({ success: true, releasedCount })
  } catch (error) {
    console.error('Cron release error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
