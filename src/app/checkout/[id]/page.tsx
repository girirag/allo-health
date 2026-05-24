'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Clock, CheckCircle2, XCircle, ChevronLeft, Zap, Shield, AlertTriangle, CreditCard } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function TimerRing({ seconds, total = 600 }: { seconds: number; total?: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, seconds / total)
  const dash = circumference * progress
  const isLow = seconds < 60
  const color = isLow ? '#ff4060' : seconds < 180 ? '#f59e0b' : '#00d4ff'

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        {}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="4"
        />
        {}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            filter: `drop-shadow(0 0 8px ${color})`,
            transition: 'stroke-dasharray 1s linear, stroke 0.5s ease',
          }}
        />
      </svg>
      {}
      <div className="absolute flex flex-col items-center">
        <Clock className="w-4 h-4 mb-1" style={{ color, opacity: 0.7 }} />
        <div className={`text-3xl font-black font-mono tabular-nums ${isLow ? 'animate-countdown' : ''}`}
          style={{ color, textShadow: `0 0 20px ${color}60` }}>
          {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
        </div>
        <div className="text-[10px] font-mono tracking-widest mt-0.5" style={{ color: `${color}80` }}>
          TIME LEFT
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const reservationId = resolvedParams.id
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processAction, setProcessAction] = useState<'confirm' | 'release' | null>(null)

  const { data: reservation, error, mutate } = useSWR(
    `/api/reservations/${reservationId}`,
    fetcher
  )

  useEffect(() => {
    if (!reservation || reservation.status !== 'PENDING') return

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const expiry = new Date(reservation.expiresAt).getTime()
      const distance = expiry - now

      if (distance <= 0) {
        clearInterval(interval)
        setTimeLeft(0)
        mutate()
      } else {
        setTimeLeft(Math.floor(distance / 1000))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [reservation, mutate])

  const handleAction = async (action: 'confirm' | 'release') => {
    setIsProcessing(true)
    setProcessAction(action)
    const idempotencyKey = uuidv4()

    try {
      const res = await fetch(`/api/reservations/${reservationId}/${action}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
      })

      const data = await res.json()

      if (res.status === 410) {
        toast.error('RESERVATION EXPIRED', {
          description: 'Your hold time ran out. Please reserve again.',
        })
        mutate()
      } else if (!res.ok) {
        toast.error(`FAILED TO ${action.toUpperCase()}`, {
          description: data.error || 'An unexpected error occurred',
        })
      } else {
        toast.success(action === 'confirm' ? 'PURCHASE CONFIRMED' : 'RESERVATION RELEASED')
        mutate()
      }
    } catch {
      toast.error('CONNECTION ERROR', { description: 'Failed to reach server.' })
    } finally {
      setIsProcessing(false)
      setProcessAction(null)
    }
  }

  if (!reservation && !error) {
    return (
      <main className="relative min-h-screen z-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <p className="font-mono text-sm text-slate-500 tracking-widest">LOADING RESERVATION...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="relative min-h-screen z-10 flex items-center justify-center">
        <div className="text-center p-8 rounded-xl" style={{ background: 'rgba(255,64,96,0.08)', border: '1px solid rgba(255,64,96,0.2)' }}>
          <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#ff4060' }} />
          <p className="font-mono text-lg font-bold" style={{ color: '#ff4060' }}>FAILED TO LOAD</p>
          <p className="text-slate-500 text-sm mt-2">Could not retrieve reservation data.</p>
        </div>
      </main>
    )
  }

  const product = reservation.inventory?.product
  const isPending = reservation.status === 'PENDING' && timeLeft !== 0
  const isConfirmed = reservation.status === 'CONFIRMED'
  const isExpired = reservation.status === 'RELEASED' || timeLeft === 0

  const statusColor = isConfirmed ? '#10b981' : isExpired ? '#ff4060' : '#00d4ff'
  const statusLabel = isConfirmed ? 'CONFIRMED' : isExpired ? 'EXPIRED' : 'PENDING'

  return (
    <main className="relative min-h-screen z-10 flex flex-col">
      {}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ borderColor: 'rgba(0,212,255,0.1)', background: 'rgba(10,10,15,0.85)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <motion.button
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm font-mono transition-colors"
            style={{ color: '#5a5f7a' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#00d4ff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#5a5f7a')}
          >
            <ChevronLeft className="w-4 h-4" />
            BACK TO STORE
          </motion.button>

          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <Shield className="w-3.5 h-3.5" style={{ color: '#00d4ff' }} />
            </div>
            <span className="font-mono text-sm font-bold text-white">CHECKOUT</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <span className="font-mono text-xs tracking-widest" style={{ color: '#5a5f7a' }}>
              RESERVATION · #{reservationId.slice(-12).toUpperCase()}
            </span>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={reservation.status + (timeLeft === 0 ? '-exp' : '')}
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -20 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="cyber-card cyber-corner"
            >
              {}
              <div className="h-1 w-full rounded-t-xl"
                style={{ background: `linear-gradient(90deg, ${statusColor}80, ${statusColor})` }} />

              <div className="p-6 space-y-6">
                {}
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-black text-slate-800 tracking-tight">
                    {isConfirmed ? 'PURCHASE CONFIRMED' : isExpired ? 'RESERVATION EXPIRED' : 'COMPLETE YOUR ORDER'}
                  </h1>
                  <span className="px-2.5 py-1 rounded font-mono text-[10px] font-bold tracking-widest"
                    style={{ background: `${statusColor}15`, border: `1px solid ${statusColor}40`, color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>

                {}
                <div className="flex flex-col items-center py-4">
                  {isPending && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="animate-float"
                    >
                      <TimerRing seconds={timeLeft ?? 0} />
                      <p className="text-center text-xs font-mono text-slate-500 tracking-wider mt-3">
                        COMPLETE PURCHASE BEFORE HOLD EXPIRES
                      </p>
                    </motion.div>
                  )}

                  {isConfirmed && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.4)', boxShadow: '0 0 40px rgba(16,185,129,0.2)' }}>
                        <CheckCircle2 className="w-10 h-10" style={{ color: '#10b981' }} />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-xl text-slate-800">Payment Successful</p>
                        <p className="text-slate-500 text-sm mt-1">Your item is on its way! 🚀</p>
                      </div>
                    </motion.div>
                  )}

                  {isExpired && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 150 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,64,96,0.1)', border: '2px solid rgba(255,64,96,0.3)', boxShadow: '0 0 40px rgba(255,64,96,0.15)' }}>
                        <XCircle className="w-10 h-10" style={{ color: '#ff4060' }} />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-xl text-slate-800">Hold Expired</p>
                        <p className="text-slate-500 text-sm mt-1">This unit has been released to other shoppers.</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {}
                <div className="cyber-divider" />

                {}
                {product && (
                  <div className="rounded-lg p-4 bg-slate-50 border border-slate-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">QTY: {reservation.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black font-mono text-cyan-600">
                          ${(product.price * reservation.quantity).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          ${product.price.toFixed(2)} × {reservation.quantity}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {}
                {isPending && timeLeft !== null && timeLeft < 60 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg"
                    style={{ background: 'rgba(255,64,96,0.08)', border: '1px solid rgba(255,64,96,0.2)' }}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#ff4060' }} />
                    <span className="text-xs font-mono" style={{ color: '#ff4060' }}>
                      CRITICAL: HOLD EXPIRES IN {timeLeft}s — ACT NOW
                    </span>
                  </motion.div>
                )}

                {}
                <div className="flex flex-col gap-3">
                  {isPending && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isProcessing}
                        onClick={() => handleAction('confirm')}
                        className="w-full py-3.5 rounded-lg font-bold font-mono tracking-wider text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))',
                          border: '1px solid rgba(0,212,255,0.4)',
                          color: '#00d4ff',
                          boxShadow: '0 0 20px rgba(0,212,255,0.15)',
                        }}
                      >
                        {processAction === 'confirm' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            PROCESSING...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            CONFIRM PURCHASE
                          </>
                        )}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isProcessing}
                        onClick={() => handleAction('release')}
                        className="w-full py-3 rounded-lg font-bold font-mono tracking-wider text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#5a5f7a',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ff4060'
                          e.currentTarget.style.borderColor = 'rgba(255,64,96,0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#5a5f7a'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                        }}
                      >
                        {processAction === 'release' ? 'RELEASING...' : 'CANCEL RESERVATION'}
                      </motion.button>
                    </>
                  )}

                  {(isConfirmed || isExpired) && (
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push('/')}
                      className="w-full py-3.5 rounded-lg font-bold font-mono tracking-wider text-sm transition-all flex items-center justify-center gap-2"
                      style={{
                        background: 'rgba(0,212,255,0.1)',
                        border: '1px solid rgba(0,212,255,0.25)',
                        color: '#00d4ff',
                      }}
                    >
                      <Zap className="w-4 h-4" />
                      BACK TO STORE
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center"
          >
            <p className="text-xs font-mono tracking-widest" style={{ color: '#2a2f45' }}>
              🔒 SECURED WITH IDEMPOTENT RESERVATION LOCKS
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  )
}
