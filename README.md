# Allo Engineering Take-Home Exercise - Inventory & Reservations

This is a Next.js application implementing an inventory reservation system that is robust against concurrent checkout race conditions.

## Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (via Prisma ORM)
- **Caching/Locking:** Redis (Upstash)
- **UI:** Tailwind CSS, shadcn/ui, Framer Motion

## How to run the app locally

1. **Clone and Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory (refer to `.env.example`). You will need:
   - A hosted PostgreSQL instance (e.g., Supabase, Neon). Local databases are not recommended for this exercise's strict concurrency requirements, but any Postgres connection string will work.
   - A Redis connection string (e.g., Upstash).

   ```env
   DATABASE_URL="postgresql://user:password@host:5432/db?schema=public"
   DIRECT_URL="postgresql://user:password@host:5432/db?schema=public"
   REDIS_URL="rediss://default:password@host:port"
   ```

3. **Database Setup & Seeding:**
   Push the schema to your database and run the seed script to populate products and warehouses:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Correctness under Concurrency

Handling the race condition where multiple users try to buy the last item simultaneously is the core of this challenge.

**My Approach:**
Instead of relying purely on application-level locks which can be brittle across distributed servers, I pushed the concurrency check down to the **PostgreSQL ACID engine**.

When a user clicks "Reserve", the `POST /api/reservations` endpoint executes a raw Prisma `$transaction`:
```sql
UPDATE "Inventory"
SET "reservedStock" = "reservedStock" + 1
WHERE "productId" = $1 AND "warehouseId" = $2
  AND ("totalStock" - "reservedStock") >= 1
RETURNING id;
```
This is an **Atomic Update with an Optimistic Condition**. 
- Postgres guarantees that concurrent updates to the same row are serialized.
- The `("totalStock" - "reservedStock") >= 1` condition ensures that if User A and User B concurrently attempt to reserve the last item, only the first transaction to acquire the row lock will succeed. 
- The second transaction will evaluate the condition as false, update 0 rows, and return nothing.
- The server detects the 0 returned rows and safely throws a `409 Conflict` (Out of Stock), rolling back the entire transaction so no orphaned `Reservation` records are created.

During `POST /api/reservations/:id/confirm` and `release`, I use `SELECT ... FOR UPDATE` to lock the specific reservation row to prevent a race condition where a cron job attempts to expire the reservation at the exact millisecond the user is paying.

## Reservation Expiry Mechanism

Reservations that are not confirmed before their `expiresAt` timestamp must be released back into the available pool.

**Production Approach:**
I implemented a `GET /api/cron/release-expired` endpoint.
- In a production environment, this endpoint would be called every minute using **Vercel Cron** (or AWS EventBridge, etc.).
- It queries for all `PENDING` reservations where `expiresAt < NOW()`, locking them with `FOR UPDATE SKIP LOCKED` to prevent lock contention if multiple cron workers run simultaneously.
- It then batch-updates their status to `RELEASED` and atomically decrements `reservedStock` in the `Inventory` table, making the stock immediately available to the frontend (which polls every 5s via SWR).

*Note: For security, in production, this endpoint should be protected by an Authorization header validating a `CRON_SECRET`.*

## Bonus: Idempotency

Both the `reserve` and `confirm` endpoints implement idempotency to safely handle network retries from clients.
- The frontend generates a unique UUID `Idempotency-Key` and sends it as an HTTP header.
- The server checks Redis `GET idempotency:{key}` before processing the request.
- If a cached response exists, the server immediately returns the cached JSON without executing any database queries or side effects.
- If it's a new request, the server proceeds with the transaction and caches the successful (or 409/410 expected error) response in Redis with an expiration of 24 hours.

## Trade-offs and Future Improvements

If I had more time, I would consider the following:

1. **Lazy Evaluation for Expiry:** Instead of just relying on a Cron job (which can have up to a 1-minute delay), I would implement lazy calculation on the `GET /api/products` endpoint. It could dynamically calculate `availableStock = totalStock - activeReservations` on the fly, meaning an expired reservation is instantly ignored by the frontend even before the cron job officially releases it. However, keeping the `reservedStock` materialized column and using a cron job is often more performant for read-heavy product pages.
2. **Postgres Functions/Triggers:** The atomic updates could be encapsulated entirely inside a Postgres Stored Procedure for even tighter guarantees and less network overhead between the Node server and the database.
3. **Queueing System (e.g., BullMQ):** Instead of a polling cron job, scheduling a delayed job exactly at the `expiresAt` time using a Redis-backed queue would ensure the hold is released at the exact millisecond it expires.
4. **Enhanced UI:** Add skeleton loaders during the checkout mutation, and perhaps a more complex cart system holding multiple items across different warehouses.
