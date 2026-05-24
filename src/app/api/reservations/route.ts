import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import redis from '@/lib/redis'
import { z } from 'zod'

const reserveSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().int().positive().default(1),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { productId, warehouseId, quantity } = reserveSchema.parse(body)

    // Idempotency Check
    const idempotencyKey = req.headers.get('Idempotency-Key')
    if (idempotencyKey) {
      const cachedResponse = await redis.get(`idempotency:${idempotencyKey}`)
      if (cachedResponse) {
        return NextResponse.json(JSON.parse(cachedResponse))
      }
    }

    try {
      const reservation = await prisma.$transaction(async (tx) => {
        // 1. Atomically update reserved stock if available
        // Using $queryRaw to utilize Postgres RETURNING clause
        const inventoryRecords = await tx.$queryRaw<{ id: string }[]>`
          UPDATE "Inventory"
          SET "reservedStock" = "reservedStock" + ${quantity}
          WHERE "productId" = ${productId} 
            AND "warehouseId" = ${warehouseId}
            AND ("totalStock" - "reservedStock") >= ${quantity}
          RETURNING id;
        `

        if (!inventoryRecords || inventoryRecords.length === 0) {
          throw new Error('OUT_OF_STOCK')
        }

        const inventoryId = inventoryRecords[0].id

        // 2. Create the reservation record
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now

        const newReservation = await tx.reservation.create({
          data: {
            inventoryId,
            quantity,
            status: 'PENDING',
            expiresAt,
            idempotencyKey,
          },
        })

        return newReservation
      })

      const responsePayload = { success: true, reservation }

      // Cache response for idempotency
      if (idempotencyKey) {
        await redis.set(`idempotency:${idempotencyKey}`, JSON.stringify(responsePayload), 'EX', 60 * 60 * 24) // 24 hours
      }

      return NextResponse.json(responsePayload)
    } catch (e: any) {
      if (e.message === 'OUT_OF_STOCK') {
        const errPayload = { error: 'Not enough stock available' }
        if (idempotencyKey) {
           await redis.set(`idempotency:${idempotencyKey}`, JSON.stringify(errPayload), 'EX', 60 * 60 * 24)
        }
        return NextResponse.json(errPayload, { status: 409 })
      }
      throw e
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: (error as any).errors }, { status: 400 })
    }
    console.error('Reservation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
