import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        Inventory: {
          include: {
            warehouse: true,
          },
        },
      },
    })

    // Map the products to include availableStock per warehouse
    const formattedProducts = products.map((product) => {
      const inventory = product.Inventory.map((inv) => ({
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        totalStock: inv.totalStock,
        reservedStock: inv.reservedStock,
        availableStock: inv.totalStock - inv.reservedStock,
      }))

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        inventory,
      }
    })

    return NextResponse.json(formattedProducts)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
