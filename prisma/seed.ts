import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  await prisma.reservation.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.product.deleteMany()
  await prisma.warehouse.deleteMany()

  const warehouse1 = await prisma.warehouse.create({
    data: { name: 'East Coast Fulfillment (NY)' },
  })

  const warehouse2 = await prisma.warehouse.create({
    data: { name: 'West Coast Fulfillment (CA)' },
  })

  const product1 = await prisma.product.create({
    data: {
      name: 'Ergonomic Developer Chair',
      description: 'The ultimate chair for long coding sessions.',
      price: 399.99,
    },
  })

  const product2 = await prisma.product.create({
    data: {
      name: 'Mechanical Keyboard (Cherry MX Brown)',
      description: 'Tactile and quiet enough for the office.',
      price: 149.50,
    },
  })

  const product3 = await prisma.product.create({
    data: {
      name: 'Noise-Cancelling Headphones',
      description: 'Block out the noise, focus on the code.',
      price: 249.00,
    },
  })

  const product4 = await prisma.product.create({
    data: {
      name: 'Limited Edition Desk Mat',
      description: 'Premium surface with an aesthetic design. Very limited stock!',
      price: 34.99,
    },
  })

  await prisma.inventory.create({
    data: {
      productId: product1.id,
      warehouseId: warehouse1.id,
      totalStock: 50,
      reservedStock: 0,
    },
  })
  await prisma.inventory.create({
    data: {
      productId: product1.id,
      warehouseId: warehouse2.id,
      totalStock: 30,
      reservedStock: 0,
    },
  })

  await prisma.inventory.create({
    data: {
      productId: product2.id,
      warehouseId: warehouse1.id,
      totalStock: 100,
      reservedStock: 0,
    },
  })
  await prisma.inventory.create({
    data: {
      productId: product2.id,
      warehouseId: warehouse2.id,
      totalStock: 15,
      reservedStock: 0,
    },
  })

  await prisma.inventory.create({
    data: {
      productId: product3.id,
      warehouseId: warehouse2.id, 
      totalStock: 40,
      reservedStock: 0,
    },
  })

  await prisma.inventory.create({
    data: {
      productId: product4.id,
      warehouseId: warehouse1.id,
      totalStock: 2, 
      reservedStock: 0,
    },
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
