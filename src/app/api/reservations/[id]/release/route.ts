import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    try {
      const releasedReservation = await prisma.$transaction(async (tx) => {
        // 1. Find the reservation with a lock
        const reservations = await tx.$queryRaw<any[]>`
          SELECT * FROM "Reservation" 
          WHERE id = ${id} 
          FOR UPDATE;
        `
        
        if (!reservations || reservations.length === 0) {
          throw new Error('NOT_FOUND')
        }

        const reservation = reservations[0]

        // Check if already released or confirmed
        if (reservation.status !== 'PENDING') {
          return reservation
        }

        // 2. Update reservation status
        const updatedReservation = await tx.reservation.update({
          where: { id },
          data: { status: 'RELEASED' }
        })

        // 3. Decrement reservedStock (making it available again)
        await tx.$executeRaw`
          UPDATE "Inventory"
          SET "reservedStock" = "reservedStock" - ${reservation.quantity}
          WHERE id = ${reservation.inventoryId}
        `

        return updatedReservation
      })

      return NextResponse.json({ success: true, reservation: releasedReservation })
    } catch (e: any) {
      if (e.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
      }
      throw e
    }
  } catch (error) {
    console.error('Release error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
