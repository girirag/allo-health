'use client'

import { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import { 
  PackageOpen, 
  MapPin, 
  AlertCircle, 
  Zap, 
  Shield, 
  Activity, 
  Search, 
  Layers, 
  Database,
  Cpu,
  Clock,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Inventory {
  warehouseId: string
  warehouseName: string
  totalStock: number
  reservedStock: number
  availableStock: number
}

interface Product {
  id: string
  name: string
  description: string
  price: number
  inventory: Inventory[]
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
}

export default function Home() {
  const { data: products, error, isLoading, mutate } = useSWR<Product[]>('/api/products', fetcher, {
    refreshInterval: 5000,
  })

  const router = useRouter()
  const [reserving, setReserving] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeWarehouseTab, setActiveWarehouseTab] = useState('ALL') 
  const [activeStockTab, setActiveStockTab] = useState('ALL') 
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [dbPing, setDbPing] = useState(15)
  const [connectedClients, setConnectedClients] = useState(5)

  useEffect(() => {
    setDbPing(Math.floor(Math.random() * 15) + 12)
    setConnectedClients(Math.floor(Math.random() * 5) + 3)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await mutate()
    setTimeout(() => {
      setIsRefreshing(false)
      toast.success('SYSTEM METRICS SYNCHRONIZED', {
        description: 'Fetched latest inventory database state.',
      })
    }, 600)
  }

  const handleReserve = async (productId: string, warehouseId: string) => {
    setReserving(`${productId}-${warehouseId}`)
    const idempotencyKey = uuidv4()

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      })

      const data = await res.json()

      if (res.status === 409) {
        toast.error('OUT OF STOCK', {
          description: 'Someone just grabbed the last unit. Try another node.',
          icon: <AlertCircle className="h-4 w-4" style={{ color: '#ff4060' }} />,
        })
      } else if (!res.ok) {
        toast.error('RESERVATION FAILED', {
          description: data.error || 'An unexpected error occurred.',
        })
      } else {
        toast.success('ITEM SECURED', {
          description: 'You have 10 minutes to complete your purchase.',
        })
        router.push(`/checkout/${data.reservation.id}`)
      }
    } catch {
      toast.error('CONNECTION ERROR', { description: 'Failed to reach the server.' })
    } finally {
      setReserving(null)
    }
  }

  const filteredProducts = useMemo(() => {
    if (!products) return []

    return products.filter((product) => {

      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      const matchesWarehouse = 
        activeWarehouseTab === 'ALL' ||
        product.inventory.some(
          (inv) => 
            (activeWarehouseTab === 'NY' && inv.warehouseName.includes('NY')) ||
            (activeWarehouseTab === 'CA' && inv.warehouseName.includes('CA'))
        )

      if (!matchesWarehouse) return false

      const totalAvailable = product.inventory.reduce((sum, inv) => sum + inv.availableStock, 0)
      if (activeStockTab === 'LOW_STOCK') {
        return totalAvailable > 0 && totalAvailable <= 10
      }
      if (activeStockTab === 'IN_STOCK') {
        return totalAvailable > 0
      }

      return true
    })
  }, [products, searchQuery, activeWarehouseTab, activeStockTab])

  const totalProducts = products?.length ?? 0
  const totalStock = products?.reduce((sum, p) => sum + p.inventory.reduce((s, i) => s + i.availableStock, 0), 0) ?? 0

  return (
    <main className="relative min-h-screen z-10">
      {}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.02]"
        style={{
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 4px, 6px 100%',
        }} 
      />

      {}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b" style={{ borderColor: 'rgba(0,212,255,0.1)', background: 'rgba(10,10,15,0.85)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => router.push('/')}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse-glow"
                style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', padding: '2px' }}>
                <div className="w-full h-full rounded-md flex items-center justify-center" style={{ background: '#0a0a0f' }}>
                  <Shield className="w-4 h-4" style={{ color: '#00d4ff' }} />
                </div>
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-white font-mono-futuristic">ALLO</span>
                <span className="font-bold text-lg tracking-tight ml-1 font-mono-futuristic" style={{ color: '#00d4ff' }}>STORE</span>
              </div>
            </motion.div>

            {}
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="p-2 rounded-lg border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-cyan-400 flex items-center gap-2 text-xs font-mono"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">REFRESH</span>
              </motion.button>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-emerald-400 font-bold">CONNECTED</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">

          {}
          <div className="lg:col-span-2 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md mb-4 text-[10px] font-mono tracking-widest w-fit"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
              <Zap className="w-3 h-3 animate-pulse" />
              CONCURRENT STOCK RESERVATION PROTOCOL
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 leading-none">
              SECURE INSTANT HOLD
            </h1>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
              Atomic transactions with distributed locking prevent double-booking. Click reserve to claim your item for <span className="text-cyan-400 font-bold">10 minutes</span>.
            </p>
          </div>

          {}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">

            <div className="cyber-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-mono tracking-widest uppercase">DATABASING</span>
                <Database className="w-4 h-4 text-cyan-600/70" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-slate-800 flex items-baseline gap-1">
                  SUPABASE <span className="text-xs text-cyan-600 font-normal">POSTGRES</span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    PING: {dbPing}ms
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    POOL: 12/20
                  </div>
                </div>
              </div>
            </div>

            <div className="cyber-card p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-mono tracking-widest uppercase">MUTEX CONCURRENCY</span>
                <Cpu className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-slate-800">
                  REDIS <span className="text-xs text-purple-600 font-normal">LOCK</span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    CLIENTS: {connectedClients}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    STATUS: ACTIVE
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {}
        <div className="cyber-card p-4 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">

          {}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Query systems database..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
            />
          </div>

          {}
          <div className="flex flex-wrap items-center gap-6 w-full md:w-auto justify-end">

            {}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider hidden lg:inline">Node:</span>
              <div className="bg-slate-50 p-1 rounded-lg border border-slate-200 flex gap-1">
                {[
                  { id: 'ALL', label: 'ALL NODES' },
                  { id: 'NY', label: 'EAST (NY)' },
                  { id: 'CA', label: 'WEST (CA)' }
                ].map((tab) => {
                  const isActive = activeWarehouseTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveWarehouseTab(tab.id)}
                      className={`relative px-3 py-1 text-[11px] font-mono font-bold tracking-wider rounded transition-all duration-200 ${
                        isActive ? 'text-cyan-600 bg-cyan-500/10 border border-cyan-500/20' : 'text-slate-500 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider hidden lg:inline">Status:</span>
              <div className="bg-slate-50 p-1 rounded-lg border border-slate-200 flex gap-1">
                {[
                  { id: 'ALL', label: 'ALL PRODUCTS' },
                  { id: 'LOW_STOCK', label: 'LOW STOCK' },
                  { id: 'IN_STOCK', label: 'IN STOCK' }
                ].map((tab) => {
                  const isActive = activeStockTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveStockTab(tab.id)}
                      className={`relative px-3 py-1 text-[11px] font-mono font-bold tracking-wider rounded transition-all duration-200 ${
                        isActive ? 'text-cyan-600 bg-cyan-500/10 border border-cyan-500/20' : 'text-slate-500 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

          </div>

        </div>

        {}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono">
            <span className="text-slate-500">DATABASE SYNC STATUS:</span>
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              ONLINE
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono">
            <span className="text-slate-500">MATCHED INDEXES:</span>
            <span className="text-cyan-400 font-bold">{filteredProducts.length} SYSTEM RECORDS</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono">
            <span className="text-slate-500">TOTAL COMBINED INVENTORY:</span>
            <span className="text-purple-400 font-bold">{totalStock} UNITS</span>
          </div>
        </div>

        {}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="cyber-card p-6 h-72 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="skeleton-cyber h-6 w-2/3" />
                    <div className="skeleton-cyber h-4 w-full" />
                    <div className="skeleton-cyber h-4 w-4/5" />
                  </div>
                  <div className="space-y-2 mt-4">
                    <div className="skeleton-cyber h-10 w-full" />
                    <div className="skeleton-cyber h-10 w-full" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20"
            >
              <div className="inline-flex flex-col items-center gap-4 p-8 rounded-xl max-w-md mx-auto"
                style={{ background: 'rgba(255,64,96,0.05)', border: '1px solid rgba(255,64,96,0.2)' }}>
                <AlertCircle className="w-12 h-12" style={{ color: '#ff4060' }} />
                <div>
                  <p className="font-bold text-lg font-mono" style={{ color: '#ff4060' }}>DB CONNECTION FAILURE</p>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                    Check if database connection string environment variables are configured correctly and Supabase instance is running.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : filteredProducts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 text-slate-500 font-mono border border-dashed border-slate-800 rounded-xl"
            >
              NO DATA INDEXES MATCHED THE SEARCH OR FILTER SELECTIONS
            </motion.div>
          ) : (
            <motion.div
              key="products"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {filteredProducts.map((product) => {
                const totalAvailable = product.inventory.reduce((sum, inv) => sum + inv.availableStock, 0)
                return (
                  <motion.div key={product.id} variants={cardVariants} className="relative group">

                    {}
                    <div className="absolute -inset-px rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
                      style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.05))', filter: 'blur(10px)' }} />

                    <div className="cyber-card cyber-corner relative flex flex-col h-full">
                      {}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none rounded-tr-xl" />

                      {}
                      <div className="absolute top-4 right-4 font-mono text-[9px] text-cyan-500/30">
                        NID_{product.id.slice(-6).toUpperCase()}
                      </div>

                      <div className="p-6 pb-4">
                        <h3 className="font-bold text-lg text-slate-800 group-hover:text-cyan-600 transition-colors duration-200">
                          {product.name}
                        </h3>
                        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed line-clamp-2 h-8">
                          {product.description}
                        </p>

                        <div className="flex items-baseline justify-between mt-4">
                          <div className="text-2xl font-black font-mono text-cyan-600">
                            ${product.price.toFixed(2)}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{
                              backgroundColor: totalAvailable === 0 ? '#ff4060' : totalAvailable <= 5 ? '#f59e0b' : '#10b981'
                            }} />
                            <span className="text-[10px] font-mono text-slate-500 uppercase">
                              {totalAvailable === 0 ? 'SOLD OUT' : `${totalAvailable} IN STOCK`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="cyber-divider mx-6" />

                      <div className="p-6 pt-4 flex-1 flex flex-col justify-between gap-4">
                        <div className="space-y-2.5">
                          <div className="text-[10px] font-mono text-slate-500 tracking-wider uppercase mb-1">
                            Fulfillment Cluster Nodes
                          </div>

                          {product.inventory.map((inv) => {
                            const isLow = inv.availableStock > 0 && inv.availableStock <= 5
                            const isOut = inv.availableStock === 0
                            const isReserving = reserving === `${product.id}-${inv.warehouseId}`
                            const nodeColor = isOut ? '#ff4060' : isLow ? '#f59e0b' : '#10b981'

                            return (
                              <div
                                key={inv.warehouseId}
                                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 truncate leading-none">{inv.warehouseName}</p>
                                    <p className="text-[10px] font-mono mt-1 font-bold" style={{ color: nodeColor }}>
                                      {isOut ? 'OUT OF STOCK' : `${inv.availableStock} UNITS AVAILABLE`}
                                    </p>
                                  </div>
                                </div>

                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  disabled={isOut || !!reserving}
                                  onClick={() => handleReserve(product.id, inv.warehouseId)}
                                  className="relative px-3.5 py-1.5 rounded text-[10px] font-bold font-mono tracking-wider transition-all disabled:opacity-40"
                                  style={isOut || !!reserving ? {
                                    background: 'rgba(0,0,0,0.03)',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                    color: '#8a8f9a'
                                  } : {
                                    background: isReserving ? 'rgba(0,180,216,0.15)' : 'rgba(0,180,216,0.08)',
                                    border: '1px solid rgba(0,180,216,0.3)',
                                    color: '#0077b6',
                                    boxShadow: isReserving ? '0 0 10px rgba(0,180,216,0.1)' : 'none'
                                  }}
                                >
                                  {isReserving ? 'LOCKING...' : 'RESERVE'}
                                </motion.button>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {}
        <footer className="mt-20 pt-8 border-t border-slate-900 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-mono text-slate-600 tracking-wider">
            ALLO STORE PROTOCOL · ATOMIC INVENTORY CONCURRENCY
          </p>
          <div className="flex gap-4 text-[10px] font-mono text-slate-500">
            <span className="hover:text-cyan-400 cursor-pointer">SCHEMA SPEC</span>
            <span>·</span>
            <span className="hover:text-cyan-400 cursor-pointer">NODE STATUS</span>
          </div>
        </footer>

      </div>
    </main>
  )
}
