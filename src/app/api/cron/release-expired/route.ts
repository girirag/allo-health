import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(req: Request) {
  // In production, you would typically check for an Authorization header with a secret cron key
  // to prevent external callers from triggering this endpoint manually.
  // const authHeader = req.headers.get('authorization');
  // if (authHeader !== \`Bearer \${process.env.CRON_SECRET}\`) { ... }

  try {
    const releasedCount = await prisma.$transaction(async (tx) => {
      // 1. Find all expired PENDING reservations, locking them
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

      // 2. Update their status to RELEASED
      await tx.reservation.updateMany({
        where: { id: { in: reservationIds } },
        data: { status: 'RELEASED' }
      })

      // 3. Decrement reservedStock for each affected inventory
      // We can iterate or do it via raw queries.
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
